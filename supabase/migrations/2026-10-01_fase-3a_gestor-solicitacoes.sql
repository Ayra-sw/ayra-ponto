-- ============================================================================
-- Ayra Ponto — Fase 3A: gestor da equipe, central de solicitações e atestado
--
-- O que esta migração faz (tudo é ACRESCENTADO; nenhum dado existente é
-- alterado ou apagado):
--   1. Gestores por departamento: em cada departamento, o administrador ou o
--      RH escolhe quem é o gestor (pode ser mais de um). A equipe do gestor é
--      quem está nos departamentos dele (menos ele mesmo).
--   2. O gestor VÊ a equipe (espelho, marcações, banco de horas, escala,
--      afastamentos e pedidos) e APROVA ou RECUSA os pedidos dela, menos os
--      de abono, que ficam com o RH e o administrador. O gestor não mexe em
--      cadastro nenhum e não vê CPF, telefone nem outros dados pessoais.
--   3. Solicitações: a pessoa pode cancelar um pedido que ainda está
--      esperando; quem analisa pode deixar um comentário (obrigatório para
--      recusar).
--   4. Atestado: o pedido de abono e o afastamento podem ter um arquivo
--      anexado (PDF ou foto). Ele fica num armazenamento privado e só é
--      aberto pela própria pessoa, pelo RH e pelo administrador.
--
-- Pode ser executada mais de uma vez sem problema.
-- Para desligar: 2026-10-01_fase-3a_gestor-solicitacoes_DESFAZER.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Só roda se a Fase 2D já estiver no banco
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.turnos') is null or to_regclass('public.escala_dias') is null then
    raise exception 'Antes desta migração é preciso aplicar a Fase 2D.';
  end if;
end $$;

-- Novo status "cancelado" (pedido desistido pela própria pessoa)
alter type public.status_ajuste add value if not exists 'cancelado';

-- ---------------------------------------------------------------------------
-- 1. Gestores dos departamentos
-- ---------------------------------------------------------------------------
create table if not exists public.departamento_gestores (
  departamento_id uuid not null references public.departamentos(id) on delete cascade,
  perfil_id       uuid not null references public.perfis(id) on delete cascade,
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  criado_por      uuid references public.perfis(id) on delete set null,
  criado_em       timestamptz not null default now(),
  primary key (departamento_id, perfil_id)
);
create index if not exists departamento_gestores_perfil_idx on public.departamento_gestores (perfil_id);

create or replace function public.validar_departamento_gestor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp_dep  uuid;
  v_emp_pes  uuid;
  v_status   status_funcionario;
begin
  select empresa_id into v_emp_dep from departamentos where id = new.departamento_id;
  select empresa_id, status into v_emp_pes, v_status from perfis where id = new.perfil_id;
  if v_emp_dep is null or v_emp_pes is null or v_emp_dep <> v_emp_pes then
    raise exception 'A pessoa e o departamento precisam ser da mesma empresa.';
  end if;
  if v_status = 'desligado' then
    raise exception 'Uma pessoa desligada não pode ser gestora.';
  end if;
  new.empresa_id := v_emp_dep;
  new.criado_em := now();
  if auth.uid() is not null then
    new.criado_por := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists validar_departamento_gestor on public.departamento_gestores;
create trigger validar_departamento_gestor before insert or update on public.departamento_gestores
  for each row execute function public.validar_departamento_gestor();

alter table public.departamento_gestores enable row level security;
drop policy if exists "gestores: ver da empresa" on public.departamento_gestores;
drop policy if exists "gestores: admin/rh definem" on public.departamento_gestores;
drop policy if exists "gestores: admin/rh removem" on public.departamento_gestores;
create policy "gestores: ver da empresa" on public.departamento_gestores
  for select to authenticated
  using (empresa_id = (select public.empresa_do_usuario()));
create policy "gestores: admin/rh definem" on public.departamento_gestores
  for insert to authenticated
  with check (empresa_id = (select public.empresa_do_usuario())
              and (select public.tipo_do_usuario()) in ('administrador', 'rh'));
create policy "gestores: admin/rh removem" on public.departamento_gestores
  for delete to authenticated
  using (empresa_id = (select public.empresa_do_usuario())
         and (select public.tipo_do_usuario()) in ('administrador', 'rh'));
revoke all on public.departamento_gestores from anon;

-- ---------------------------------------------------------------------------
-- 2. Quem é a equipe de quem está logado
--    (funções com acesso próprio: leem o cadastro sem abrir os dados pessoais)
-- ---------------------------------------------------------------------------
create or replace function public.equipe_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.id
    from departamento_gestores dg
    join perfis g on g.id = dg.perfil_id and g.status <> 'desligado'
    join perfis p on p.departamento_id = dg.departamento_id and p.empresa_id = dg.empresa_id
   where dg.perfil_id = auth.uid()
     and p.id <> auth.uid()
     and p.status <> 'desligado';
$$;

create or replace function public.eh_gestor_de(p_perfil_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.equipe_ids() e where e = p_perfil_id);
$$;

-- A equipe, só com o que o gestor precisa ver (sem CPF, telefone etc.)
create or replace function public.minha_equipe()
returns table (
  perfil_id        uuid,
  nome_completo    text,
  matricula        text,
  cargo            text,
  departamento_id  uuid,
  departamento     text,
  status           status_funcionario,
  tipo_escala      text,
  filial_id        uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nome_completo, p.matricula, p.cargo, p.departamento_id, d.nome, p.status, p.tipo_escala, p.filial_id
    from perfis p
    left join departamentos d on d.id = p.departamento_id
   where p.id in (select public.equipe_ids())
   order by p.nome_completo;
$$;

-- Dados do cadastro que o cálculo das horas precisa, para quem pode ver a pessoa
create or replace function public.dados_para_apuracao(p_perfil_id uuid)
returns table (
  empresa_id         uuid,
  filial_id          uuid,
  modelo_jornada_id  uuid,
  data_admissao      date,
  tipo_escala        text,
  escala_turno_id    uuid,
  escala_referencia  date
)
language sql
stable
security definer
set search_path = public
as $$
  select p.empresa_id, p.filial_id, p.modelo_jornada_id, p.data_admissao,
         p.tipo_escala, p.escala_turno_id, p.escala_referencia
    from perfis p
   where p.id = p_perfil_id
     and (auth.uid() is null                                  -- rotinas do sistema
          or p.id = auth.uid()
          or (p.empresa_id = public.empresa_do_usuario()
              and public.tipo_do_usuario() in ('administrador', 'rh'))
          or public.eh_gestor_de(p.id));
$$;

-- ---------------------------------------------------------------------------
-- 3. O gestor vê o que é da equipe (só leitura)
-- ---------------------------------------------------------------------------
drop policy if exists "registros: gestor vê a equipe" on public.registros_ponto;
create policy "registros: gestor vê a equipe" on public.registros_ponto
  for select to authenticated
  using (perfil_id in (select public.equipe_ids()));

drop policy if exists "ajustes: gestor vê a equipe" on public.ajustes_ponto;
create policy "ajustes: gestor vê a equipe" on public.ajustes_ponto
  for select to authenticated
  using (perfil_id in (select public.equipe_ids()));

drop policy if exists "afastamentos: gestor vê a equipe" on public.afastamentos;
create policy "afastamentos: gestor vê a equipe" on public.afastamentos
  for select to authenticated
  using (perfil_id in (select public.equipe_ids()));

drop policy if exists "banco: gestor vê a equipe" on public.banco_horas_lancamentos;
create policy "banco: gestor vê a equipe" on public.banco_horas_lancamentos
  for select to authenticated
  using (perfil_id in (select public.equipe_ids()));

drop policy if exists "escala: gestor vê a equipe" on public.escala_dias;
create policy "escala: gestor vê a equipe" on public.escala_dias
  for select to authenticated
  using (perfil_id in (select public.equipe_ids()));

-- nomes de quem pediu e de quem analisou aparecem nas listas de pedidos
create or replace function public.nome_da_pessoa(p_perfil_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.nome_completo from perfis p
   where p.id = p_perfil_id and p.empresa_id = public.empresa_do_usuario();
$$;

-- ---------------------------------------------------------------------------
-- 4. Solicitações: comentário da análise, cancelamento e anexo
-- ---------------------------------------------------------------------------
alter table public.ajustes_ponto
  add column if not exists comentario_analise text,
  add column if not exists anexo_path         text;
alter table public.afastamentos
  add column if not exists anexo_path text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ajustes_comentario_tamanho') then
    alter table public.ajustes_ponto
      add constraint ajustes_comentario_tamanho check (comentario_analise is null or char_length(comentario_analise) <= 500);
  end if;
end $$;

-- o arquivo existe, está na pasta da pessoa e tem um formato aceito?
create or replace function public.anexo_valido(p_path text, p_perfil_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_empresa uuid;
begin
  if p_path is null then
    return true;
  end if;
  select empresa_id into v_empresa from perfis where id = p_perfil_id;
  if v_empresa is null
     or p_path !~ ('^' || v_empresa::text || '/' || p_perfil_id::text || '/[A-Za-z0-9_-]+\.(pdf|jpg|jpeg|png|webp)$') then
    return false;
  end if;
  return exists (select 1 from storage.objects o where o.bucket_id = 'atestados' and o.name = p_path);
end;
$$;

-- regras da análise (roda depois das regras das fases anteriores)
create or replace function public.regras_solicitacao_fase3()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.comentario_analise := null;
    if new.anexo_path is not null then
      if new.tipo <> 'abono' then
        raise exception 'Só o pedido de abono pode ter atestado anexado.';
      end if;
      if not public.anexo_valido(new.anexo_path, new.perfil_id) then
        raise exception 'O arquivo anexado não foi encontrado. Envie o arquivo de novo.';
      end if;
    end if;
    return new;
  end if;

  -- alteração
  if new.anexo_path is distinct from old.anexo_path then
    raise exception 'O anexo de um pedido não pode ser trocado. Cancele e envie outro pedido.';
  end if;
  new.comentario_analise := nullif(btrim(new.comentario_analise), '');

  if old.perfil_id = v_uid then
    -- a própria pessoa só pode cancelar
    if new.status::text <> 'cancelado' then
      raise exception 'Você não pode analisar o seu próprio pedido. Você só pode cancelá-lo.';
    end if;
    new.comentario_analise := null;
    return new;
  end if;

  if new.status::text = 'cancelado' then
    raise exception 'Só quem fez o pedido pode cancelá-lo.';
  end if;
  if new.status::text = 'rejeitado' and new.comentario_analise is null then
    raise exception 'Para recusar, explique o motivo no comentário. A pessoa vai ler a resposta.';
  end if;
  if old.tipo = 'abono' and public.tipo_do_usuario() not in ('administrador', 'rh') then
    raise exception 'Pedidos de abono são analisados pelo RH ou pelo administrador.';
  end if;
  return new;
end;
$$;

drop trigger if exists regras_solicitacao_fase3 on public.ajustes_ponto;
create trigger regras_solicitacao_fase3 before insert or update on public.ajustes_ponto
  for each row execute function public.regras_solicitacao_fase3();

-- quem fez o pedido pode cancelá-lo enquanto espera análise
drop policy if exists "ajustes: dono cancela o pendente" on public.ajustes_ponto;
create policy "ajustes: dono cancela o pendente" on public.ajustes_ponto
  for update to authenticated
  using (perfil_id = (select auth.uid()) and status = 'pendente')
  with check (perfil_id = (select auth.uid()));

-- o gestor analisa os pedidos da equipe (menos abono e menos os próprios)
drop policy if exists "ajustes: gestor analisa a equipe" on public.ajustes_ponto;
create policy "ajustes: gestor analisa a equipe" on public.ajustes_ponto
  for update to authenticated
  using (perfil_id in (select public.equipe_ids()) and tipo <> 'abono')
  with check (perfil_id in (select public.equipe_ids()) and tipo <> 'abono');

-- afastamento: o anexo entra no registro e não muda depois
create or replace function public.regras_anexo_afastamento()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.anexo_path is not null and not public.anexo_valido(new.anexo_path, new.perfil_id) then
      raise exception 'O arquivo anexado não foi encontrado. Envie o arquivo de novo.';
    end if;
  elsif new.anexo_path is distinct from old.anexo_path then
    raise exception 'O anexo de um afastamento não pode ser trocado. Cancele e registre de novo.';
  end if;
  return new;
end;
$$;

drop trigger if exists regras_anexo_afastamento on public.afastamentos;
create trigger regras_anexo_afastamento before insert or update on public.afastamentos
  for each row execute function public.regras_anexo_afastamento();

-- ---------------------------------------------------------------------------
-- 5. Armazenamento privado dos atestados
--    Caminho: <empresa>/<pessoa>/<arquivo>.pdf (ou .jpg, .png, .webp)
--    Abrem o arquivo: a própria pessoa, o RH e o administrador. Ninguém
--    altera nem apaga pelo app (é documento do pedido).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('atestados', 'atestados', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
   set public = false,
       file_size_limit = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "atestados: enviar o próprio" on storage.objects;
create policy "atestados: enviar o próprio" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'atestados'
              and (storage.foldername(name))[1] = (select public.empresa_do_usuario())::text
              and (storage.foldername(name))[2] = (select auth.uid())::text);

drop policy if exists "atestados: admin/rh enviam da empresa" on storage.objects;
create policy "atestados: admin/rh enviam da empresa" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'atestados'
              and (storage.foldername(name))[1] = (select public.empresa_do_usuario())::text
              and (select public.tipo_do_usuario()) in ('administrador', 'rh'));

drop policy if exists "atestados: ver o próprio" on storage.objects;
create policy "atestados: ver o próprio" on storage.objects
  for select to authenticated
  using (bucket_id = 'atestados'
         and (storage.foldername(name))[1] = (select public.empresa_do_usuario())::text
         and (storage.foldername(name))[2] = (select auth.uid())::text);

drop policy if exists "atestados: admin/rh veem da empresa" on storage.objects;
create policy "atestados: admin/rh veem da empresa" on storage.objects
  for select to authenticated
  using (bucket_id = 'atestados'
         and (storage.foldername(name))[1] = (select public.empresa_do_usuario())::text
         and (select public.tipo_do_usuario()) in ('administrador', 'rh'));

drop policy if exists "atestados: leitura pelas funções do sistema" on storage.objects;
create policy "atestados: leitura pelas funções do sistema" on storage.objects
  for select to postgres
  using (bucket_id = 'atestados');


-- ---------------------------------------------------------------------------
-- 6. Espelho e banco de horas: o gestor também pode ver os da equipe
--    (as contas são as mesmas das fases 2C e 2D; só muda quem pode ver)
-- ---------------------------------------------------------------------------
create or replace function public.apurar_periodo(
  p_perfil_id uuid,
  p_inicio    date,
  p_fim       date
)
returns table (
  data            date,
  dia_semana      smallint,
  situacao        text,
  feriado_nome    text,
  previsto_min    integer,
  trabalhado_min  integer,
  atraso_min      integer,
  extra_min       integer,
  falta_min       integer,
  abonado_min     integer,
  saldo_min       integer,
  marcacoes       jsonb,
  alertas         text[],
  afastamento_tipo text,
  turno           text
)
language plpgsql
stable
set search_path = public
set jit = off   -- a compilação JIT do Postgres só atrapalha consultas curtas como esta
as $$
#variable_conflict use_column
declare
  v_empresa   uuid;
  v_filial    uuid;
  v_modelo    uuid;
  v_admissao  date;
  v_fuso      text;
  v_tol       integer;
  v_hoje      date;
  v_tipo      text;
  v_turno     uuid;
  v_ref       date;
begin
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'Período inválido.';
  end if;
  if p_fim - p_inicio > 92 then
    raise exception 'O período pode ter no máximo 93 dias.';
  end if;

  select p.empresa_id, p.filial_id, p.modelo_jornada_id, p.data_admissao,
         p.tipo_escala, p.escala_turno_id, p.escala_referencia
    into v_empresa, v_filial, v_modelo, v_admissao, v_tipo, v_turno, v_ref
    from public.dados_para_apuracao(p_perfil_id) p;
  if v_empresa is null then
    raise exception 'Pessoa não encontrada.';
  end if;

  -- Quem entra pelo app só vê o próprio espelho, o da empresa (administrador/RH)
  -- ou o da própria equipe (gestor)
  if current_user in ('authenticated', 'anon') then
    if not (p_perfil_id = (select auth.uid())
            or (v_empresa = (select empresa_do_usuario())
                and (select tipo_do_usuario()) in ('administrador', 'rh'))
            or public.eh_gestor_de(p_perfil_id)) then
      raise exception 'Você não tem acesso ao espelho desta pessoa.';
    end if;
  end if;

  select coalesce(f.fuso_horario, 'America/Sao_Paulo') into v_fuso
    from (select 1) x left join filiais f on f.id = v_filial;
  v_fuso := coalesce(v_fuso, 'America/Sao_Paulo');
  v_hoje := (now() at time zone v_fuso)::date;
  -- quem está em escala (12x36 ou calendário) sem jornada usa tolerância de 10 minutos
  select case when v_tipo <> 'semanal' then coalesce(m.tolerancia_minutos, 10)
              else coalesce(m.tolerancia_minutos, 0) end into v_tol
    from (select 1) x left join modelos_jornada m on m.id = v_modelo;

  return query
  with eventos_brutos as (
    -- marcações reais (com o horário corrigido, se houver ajuste aprovado)
    select r.id, r.nsr, r.tipo,
           coalesce(c.marcacao_solicitada, r.marcado_em) as em,
           r.marcado_em as em_original,
           case when c.id is not null then 'corrigida' else 'real' end as origem,
           c.id as ajuste_id
      from registros_ponto r
      left join lateral (
        select a.id, a.marcacao_solicitada
          from ajustes_ponto a
         where a.registro_original_id = r.id
           and a.status = 'aprovado'
           and a.tipo = 'correcao_marcacao'
           and a.marcacao_solicitada is not null
         order by a.analisado_em desc nulls last, a.criado_em desc
         limit 1) c on true
     where r.perfil_id = p_perfil_id
    union all
    -- marcações esquecidas, incluídas por ajuste aprovado
    select a.id, null::bigint, a.tipo_marcacao, a.marcacao_solicitada, null::timestamptz,
           'incluida', a.id
      from ajustes_ponto a
     where a.perfil_id = p_perfil_id
       and a.status = 'aprovado'
       and a.tipo = 'inclusao_esquecida'
       and a.tipo_marcacao is not null
       and a.marcacao_solicitada is not null
  ),
  eventos as (
    select e.*,
           lag(e.tipo)  over w as tipo_anterior,
           lead(e.tipo) over w as tipo_seguinte,
           lead(e.em)   over w as em_seguinte,
           lag(e.em)    over w as em_anterior,
           -- a entrada mais recente até aqui: define de que "dia de trabalho" é cada marcação
           max(case when e.tipo = 'entrada' then e.em end)
             over (w rows between unbounded preceding and current row) as ult_entrada
      from eventos_brutos e
     where e.em >= ((p_inicio - 2)::timestamp at time zone v_fuso)
       and e.em <  ((p_fim + 3)::timestamp at time zone v_fuso)
    window w as (order by e.em, e.nsr nulls last, e.id)
  ),
  classificados as (
    select e.*,
           (e.tipo in ('entrada', 'fim_intervalo')) as abre,
           (e.tipo in ('entrada', 'fim_intervalo')
              and coalesce(e.tipo_seguinte::text, '') in ('saida', 'inicio_intervalo')) as abre_com_par,
           (e.tipo in ('saida', 'inicio_intervalo')
              and coalesce(e.tipo_anterior::text, '') in ('entrada', 'fim_intervalo')) as fecha_com_par,
           case when e.tipo = 'inicio_intervalo' and coalesce(e.tipo_seguinte::text, '') = 'fim_intervalo'
                then floor(extract(epoch from (e.em_seguinte - e.em)) / 60)::integer end as int_min,
           (e.em at time zone v_fuso)::date as dia_proprio,
           -- o dia de trabalho é o dia da entrada (turno da noite, com intervalo antes
           -- ou depois da meia-noite, fica inteiro no dia em que começou)
           (case when e.ult_entrada is not null and e.em - e.ult_entrada <= interval '20 hours'
                 then (e.ult_entrada at time zone v_fuso)::date
                 else (e.em at time zone v_fuso)::date end) as dia_ref
      from eventos e
  ),
  por_dia as (
    select c.dia_ref as dia,
           coalesce(sum(case when c.abre_com_par
                             then floor(extract(epoch from (c.em_seguinte - c.em)) / 60)::integer end), 0) as trabalhado,
           count(*) filter (where c.abre and not c.abre_com_par)                          as abertas,
           count(*) filter (where not c.abre and not c.fecha_com_par)                     as sem_par,
           count(*) filter (where c.tipo = 'inicio_intervalo')                            as n_intervalos,
           coalesce(sum(c.int_min), 0)                                                    as intervalo_total,
           count(*)                                                                       as n_marcacoes,
           jsonb_agg(jsonb_build_object(
             'id', c.id, 'nsr', c.nsr, 'tipo', c.tipo, 'em', c.em,
             'origem', c.origem, 'em_original', c.em_original, 'ajuste_id', c.ajuste_id)
             order by c.em, c.nsr nulls last) as marcacoes
      from classificados c
     group by c.dia_ref
  ),
  dias as (
    -- turno do dia: 12x36 = de dois em dois dias a partir do primeiro dia de trabalho;
    -- calendário = o que foi marcado na grade; semanal = usa a jornada (sem turno)
    select d::date as dia,
           case v_tipo
             when '12x36' then
               case when ((d::date - v_ref) % 2 + 2) % 2 = 0 then v_turno end
             when 'calendario' then
               (select ed.turno_id from escala_dias ed
                 where ed.perfil_id = p_perfil_id and ed.data = d::date)
           end as turno_id
      from generate_series(p_inicio::timestamp, p_fim::timestamp, interval '1 day') d
  ),
  base as (
    select d.dia,
           extract(dow from d.dia)::smallint as dow,
           case when v_tipo = 'semanal' then coalesce(jd.trabalha, false)
                else t.id is not null end as jd_trabalha,
           case when v_tipo = 'semanal' then jd.intervalo_inicio
                else t.intervalo_inicio end as jd_intervalo,
           case when v_tipo = 'semanal' then
                  case when jd.trabalha
                       then minutos_previstos_dia(jd.entrada, jd.saida, jd.intervalo_inicio, jd.intervalo_fim)
                       else 0 end
                when t.id is not null
                then minutos_previstos_dia(t.entrada, t.saida, t.intervalo_inicio, t.intervalo_fim)
                else 0 end as previsto_base,
           d.turno_id,
           case when t.id is not null
                then t.nome || ' ' || to_char(t.entrada, 'HH24:MI') || '–' || to_char(t.saida, 'HH24:MI')
                end as turno_txt,
           (select f.nome from feriados f
             where f.empresa_id = v_empresa and f.data = d.dia
               and (f.filial_id is null or f.filial_id = v_filial)
             order by (f.filial_id is null), f.nome limit 1) as feriado,
           exists (select 1 from ajustes_ponto a
                    where a.perfil_id = p_perfil_id and a.status = 'aprovado' and a.tipo = 'folga'
                      and d.dia between a.data_referencia and coalesce(a.data_fim, a.data_referencia)) as folga,
           exists (select 1 from ajustes_ponto a
                    where a.perfil_id = p_perfil_id and a.status = 'aprovado' and a.tipo = 'abono'
                      and d.dia between a.data_referencia and coalesce(a.data_fim, a.data_referencia)) as abono,
           coalesce(pd.trabalhado, 0) as trabalhado,
           coalesce(pd.abertas, 0)    as abertas,
           coalesce(pd.sem_par, 0)    as sem_par,
           coalesce(pd.n_intervalos, 0) as n_intervalos,
           coalesce(pd.intervalo_total, 0) as intervalo_total,
           (select af.tipo from afastamentos af
             where af.perfil_id = p_perfil_id and af.cancelado_em is null
               and d.dia between af.data_inicio and af.data_fim
             order by af.data_inicio limit 1) as afast_tipo,
           coalesce(pd.n_marcacoes, 0)  as n_marcacoes,
           coalesce(pd.marcacoes, '[]'::jsonb) as marcacoes
      from dias d
      left join modelos_jornada_dias jd
        on v_tipo = 'semanal' and jd.modelo_id = v_modelo
       and jd.dia_semana = extract(dow from d.dia)::smallint
      left join turnos t on t.id = d.turno_id
      left join por_dia pd on pd.dia = d.dia
  ),
  com_situacao as (
    select b.*,
           case
             when v_admissao is not null and b.dia < v_admissao                     then 'antes_admissao'
             when b.afast_tipo is not null                                          then 'afastado'
             when b.folga                                                           then 'folga'
             when b.feriado is not null
                  and not (v_tipo = '12x36' and b.turno_id is not null)             then 'feriado'
             when b.dia > v_hoje                                                    then 'futuro'
             when b.abono                                                           then 'abonado'
             when (b.abertas > 0 or b.sem_par > 0) and b.dia = v_hoje               then 'em_andamento'
             when b.abertas > 0 or b.sem_par > 0                                    then 'incompleto'
             when v_modelo is null and v_tipo = 'semanal' and b.trabalhado = 0     then 'sem_jornada'
             when b.previsto_base = 0 and b.trabalhado = 0 and v_tipo <> 'semanal'  then 'folga_escala'
             when b.previsto_base = 0 and b.trabalhado = 0                          then 'dia_livre'
             when b.previsto_base > 0 and b.trabalhado = 0 and b.dia = v_hoje       then 'em_andamento'
             when b.previsto_base > 0 and b.trabalhado = 0                          then 'falta'
             else 'trabalhado'
           end as sit
      from base b
  ),
  contas as (
    select s.*,
           -- previsto que vale para o dia
           case when s.sit in ('antes_admissao', 'afastado', 'folga', 'feriado', 'sem_jornada', 'dia_livre', 'folga_escala') then 0
                else s.previsto_base end as prev,
           -- trabalhado que vale (antes da admissão nada vale)
           case when s.sit = 'antes_admissao' then 0 else s.trabalhado end as trab
      from com_situacao s
  ),
  final as (
    select c.*,
           case
             when c.sit in ('afastado', 'folga', 'feriado') then c.trab
             when c.sit = 'trabalhado' and c.prev = 0 then c.trab
             when c.sit in ('trabalhado', 'abonado') and c.trab - c.prev > v_tol then c.trab - c.prev
             else 0 end as extra,
           case
             when c.sit = 'trabalhado' and c.prev > 0 and c.prev - c.trab > v_tol then c.prev - c.trab
             else 0 end as atraso,
           case when c.sit = 'falta' then c.prev else 0 end as falta,
           case when c.sit = 'abonado' then greatest(c.prev - c.trab, 0) else 0 end as abonado
      from contas c
  )
  select f.dia,
         f.dow,
         f.sit,
         f.feriado,
         f.prev::integer,
         f.trab::integer,
         f.atraso::integer,
         f.extra::integer,
         f.falta::integer,
         f.abonado::integer,
         (f.extra - f.atraso - f.falta)::integer,
         f.marcacoes,
         array_remove(array[
           case when f.abertas > 0 or f.sem_par > 0
                then 'Marcação sem par: falta uma entrada ou uma saída. Peça o ajuste.' end,
           case when f.sit = 'trabalhado' and f.jd_intervalo is not null and f.n_intervalos = 0
                     and f.abertas = 0 and f.sem_par = 0
                then 'Sem marcação de intervalo. O intervalo não foi descontado das horas.' end,
           case when f.sit = 'trabalhado' and f.jd_intervalo is null and f.n_intervalos = 0
                     and f.abertas = 0 and f.sem_par = 0 and f.trab > 360
                then 'Sem intervalo registrado em jornada de mais de 6 horas (a lei pede 1 hora de intervalo).' end,
           case when f.sit in ('trabalhado', 'abonado') and f.n_intervalos > 0 and f.abertas = 0 and f.sem_par = 0
                     and f.trab > 360 and f.intervalo_total < 60
                then 'Intervalo de menos de 1 hora em jornada de mais de 6 horas.' end,
           case when f.sit in ('trabalhado', 'abonado') and f.n_intervalos > 0 and f.abertas = 0 and f.sem_par = 0
                     and f.trab > 240 and f.trab <= 360 and f.intervalo_total < 15
                then 'Intervalo de menos de 15 minutos em jornada de mais de 4 horas.' end,
           case when f.sit = 'afastado' and f.trab > 0 then 'Trabalhou durante um afastamento.' end,
           case when f.sit = 'feriado' and f.trab > 0 then 'Trabalhou em feriado.' end,
           case when f.sit = 'folga' and f.trab > 0 then 'Trabalhou em dia de folga aprovada.' end,
           case when f.sit = 'trabalhado' and f.prev = 0 and f.trab > 0 and f.jd_trabalha is not true
                then case when v_tipo = 'semanal' then 'Trabalhou em dia sem jornada prevista.'
                          else 'Trabalhou em dia de folga da escala.' end end,
           case when f.sit = 'trabalhado' and f.feriado is not null and v_tipo = '12x36' and f.trab > 0
                then 'Trabalhou em feriado. Na escala 12x36 o feriado já está compensado pela própria escala, então não vira hora extra.' end,
           case when f.sit = 'antes_admissao' and f.n_marcacoes > 0
                then 'Há marcações antes da data de admissão.' end
         ], null),
         f.afast_tipo,
         f.turno_txt
    from final f
   order by f.dia;
end;
$$;

comment on function public.apurar_periodo(uuid, date, date) is
  'Espelho de ponto: dia a dia, horas previstas (jornada semanal, 12x36 ou escala por calendário), trabalhadas, atrasos, extras, faltas, abonos e afastamentos. Ajustes aprovados entram só no cálculo.';

create or replace function public.banco_horas(
  p_perfil_id uuid,
  p_ate       date default null
)
returns jsonb
language plpgsql
stable
set search_path = public
set jit = off
as $$
#variable_conflict use_column
declare
  v_empresa    uuid;
  v_filial     uuid;
  v_modelo     uuid;
  v_admissao   date;
  v_fuso       text;
  v_hoje       date;
  v_usa        boolean;
  v_meses      integer;
  v_inicio     date;
  v_ini        date;
  v_fim        date;
  d0           date;
  d1           date;
  r            record;
  cred_d       date[]   := '{}';
  cred_m       integer[] := '{}';
  v_head       integer  := 1;
  v_saldo      integer  := 0;
  v_divida     integer  := 0;
  v_vencido    integer  := 0;
  v_incompletos integer := 0;
  v_need       integer;
  v_take       integer;
  v_venc       date;
  v_movs       jsonb    := '[]'::jsonb;
  v_a_vencer   integer  := 0;
  v_prox       jsonb    := null;
  v_desc       text;
  i            integer;
begin
  select p.empresa_id, p.filial_id, p.modelo_jornada_id, p.data_admissao
    into v_empresa, v_filial, v_modelo, v_admissao
    from public.dados_para_apuracao(p_perfil_id) p;
  if v_empresa is null then
    raise exception 'Pessoa não encontrada.';
  end if;

  if current_user in ('authenticated', 'anon') then
    if not (p_perfil_id = (select auth.uid())
            or (v_empresa = (select empresa_do_usuario())
                and (select tipo_do_usuario()) in ('administrador', 'rh'))
            or public.eh_gestor_de(p_perfil_id)) then
      raise exception 'Pessoa não encontrada.';
    end if;
  end if;

  select m.usa_banco_horas, m.banco_horas_validade_meses, m.banco_horas_inicio
    into v_usa, v_meses, v_inicio
    from (select 1) x left join modelos_jornada m on m.id = v_modelo;

  if v_usa is not true then
    return jsonb_build_object('usa_banco', false);
  end if;

  select coalesce(f.fuso_horario, 'America/Sao_Paulo') into v_fuso
    from (select 1) x left join filiais f on f.id = v_filial;
  v_fuso := coalesce(v_fuso, 'America/Sao_Paulo');
  v_hoje := (now() at time zone v_fuso)::date;

  v_ini := greatest(v_inicio, coalesce(v_admissao, v_inicio));
  v_fim := least(coalesce(p_ate, v_hoje), v_hoje);

  if v_ini > v_fim then
    return jsonb_build_object(
      'usa_banco', true, 'ainda_nao_comecou', true, 'inicio', v_ini, 'ate', v_fim,
      'validade_meses', v_meses, 'saldo_min', 0, 'vencido_min', 0, 'a_vencer_min', 0,
      'proximo_vencimento', null, 'dias_incompletos', 0, 'movimentos', '[]'::jsonb);
  end if;
  if v_fim - v_ini > 1830 then
    raise exception 'O banco de horas desta pessoa começa há mais de 5 anos. Peça ao suporte para fechar os períodos antigos.';
  end if;

  d0 := v_ini;
  while d0 <= v_fim loop
    d1 := least(d0 + 91, v_fim);

    for r in
      with ap as materialized (select * from apurar_periodo(p_perfil_id, d0, d1))
      select a.data as dia,
             case when a.situacao = 'incompleto' then 'incompleto' else 'dia' end as tipo,
             a.saldo_min as minutos, null::text as motivo, 0 as ordem, null::timestamptz as criado_em
        from ap a
       where a.saldo_min <> 0 or a.situacao = 'incompleto'
      union all
      select greatest(l.data, d0), l.tipo, l.minutos, l.motivo, 1, l.criado_em
        from banco_horas_lancamentos l
       where l.perfil_id = p_perfil_id
         and l.data <= d1
         and (l.data >= d0 or d0 = v_ini)
      order by 1, 5, 6
    loop
      -- 1. vence o que já passou do prazo
      while v_head <= coalesce(array_length(cred_d, 1), 0)
            and (cred_d[v_head] + make_interval(months => v_meses))::date <= r.dia loop
        v_venc := (cred_d[v_head] + make_interval(months => v_meses))::date;
        if cred_m[v_head] > 0 then
          v_saldo   := v_saldo - cred_m[v_head];
          v_vencido := v_vencido + cred_m[v_head];
          v_movs := v_movs || jsonb_build_object(
            'data', v_venc, 'tipo', 'vencimento', 'minutos', -cred_m[v_head],
            'saldo_apos', v_saldo, 'vencido_apos', v_vencido,
            'descricao', 'Horas de ' || to_char(cred_d[v_head], 'DD/MM/YYYY') || ' passaram do prazo e ficam a pagar');
        end if;
        v_head := v_head + 1;
      end loop;

      if r.tipo = 'incompleto' then
        v_incompletos := v_incompletos + 1;
        continue;
      end if;

      -- 2. aplica o movimento
      if r.minutos > 0 then
        v_saldo := v_saldo + r.minutos;
        v_need  := r.minutos;
        if v_divida > 0 then
          v_take   := least(v_need, v_divida);
          v_divida := v_divida - v_take;
          v_need   := v_need - v_take;
        end if;
        if v_need > 0 then
          cred_d := cred_d || r.dia;
          cred_m := cred_m || v_need;
        end if;
      else
        v_need := -r.minutos;
        if r.tipo = 'pagamento' and v_vencido > 0 then
          v_take    := least(v_need, v_vencido);
          v_vencido := v_vencido - v_take;
          v_need    := v_need - v_take;
        end if;
        while v_need > 0 and v_head <= coalesce(array_length(cred_d, 1), 0) loop
          v_take := least(v_need, cred_m[v_head]);
          cred_m[v_head] := cred_m[v_head] - v_take;
          v_need  := v_need - v_take;
          v_saldo := v_saldo - v_take;
          if cred_m[v_head] = 0 then
            v_head := v_head + 1;
          end if;
        end loop;
        if v_need > 0 then
          v_divida := v_divida + v_need;
          v_saldo  := v_saldo - v_need;
        end if;
      end if;

      v_desc := case r.tipo
        when 'dia'           then 'Saldo do dia'
        when 'saldo_inicial' then 'Saldo inicial: ' || coalesce(r.motivo, '')
        when 'compensacao'   then 'Compensação: ' || coalesce(r.motivo, '')
        when 'pagamento'     then 'Pagamento: ' || coalesce(r.motivo, '')
        else                      'Ajuste: ' || coalesce(r.motivo, '')
      end;
      v_movs := v_movs || jsonb_build_object(
        'data', r.dia, 'tipo', r.tipo, 'minutos', r.minutos,
        'saldo_apos', v_saldo, 'vencido_apos', v_vencido, 'descricao', v_desc);
    end loop;

    d0 := d1 + 1;
  end loop;

  -- vencimentos até o último dia
  while v_head <= coalesce(array_length(cred_d, 1), 0)
        and (cred_d[v_head] + make_interval(months => v_meses))::date <= v_fim loop
    v_venc := (cred_d[v_head] + make_interval(months => v_meses))::date;
    if cred_m[v_head] > 0 then
      v_saldo   := v_saldo - cred_m[v_head];
      v_vencido := v_vencido + cred_m[v_head];
      v_movs := v_movs || jsonb_build_object(
        'data', v_venc, 'tipo', 'vencimento', 'minutos', -cred_m[v_head],
        'saldo_apos', v_saldo, 'vencido_apos', v_vencido,
        'descricao', 'Horas de ' || to_char(cred_d[v_head], 'DD/MM/YYYY') || ' passaram do prazo e ficam a pagar');
    end if;
    v_head := v_head + 1;
  end loop;

  -- o que vence nos próximos 30 dias
  i := v_head;
  while i <= coalesce(array_length(cred_d, 1), 0) loop
    v_venc := (cred_d[i] + make_interval(months => v_meses))::date;
    if cred_m[i] > 0 then
      if v_venc <= v_fim + 30 then
        v_a_vencer := v_a_vencer + cred_m[i];
      end if;
      if v_prox is null then
        v_prox := jsonb_build_object('data', v_venc, 'minutos', cred_m[i]);
      end if;
    end if;
    i := i + 1;
  end loop;

  return jsonb_build_object(
    'usa_banco', true, 'inicio', v_ini, 'ate', v_fim, 'validade_meses', v_meses,
    'saldo_min', v_saldo, 'vencido_min', v_vencido, 'a_vencer_min', v_a_vencer,
    'proximo_vencimento', v_prox, 'dias_incompletos', v_incompletos,
    'movimentos', v_movs);
end;
$$;

comment on function public.banco_horas(uuid, date) is
  'Saldo do banco de horas (com vencimento por ordem de chegada) e extrato, a partir do espelho e dos lançamentos.';

-- Horas do mês da equipe do gestor (uma linha por pessoa)
create or replace function public.resumo_minha_equipe(p_inicio date, p_fim date)
returns table (
  perfil_id        uuid,
  nome_completo    text,
  matricula        text,
  departamento_id  uuid,
  previsto_min     bigint,
  trabalhado_min   bigint,
  atraso_min       bigint,
  extra_min        bigint,
  falta_min        bigint,
  dias_falta       bigint,
  dias_com_alerta  bigint,
  pedidos_pendentes bigint
)
language plpgsql
stable
security definer
set search_path = public
set jit = off
as $$
#variable_conflict use_column
begin
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'Período inválido.';
  end if;
  if p_fim - p_inicio > 61 then
    raise exception 'O resumo da equipe pode ter no máximo 62 dias.';
  end if;

  return query
  select p.id, p.nome_completo, p.matricula, p.departamento_id,
         coalesce(sum(a.previsto_min) filter (where a.situacao <> 'futuro'), 0)::bigint,
         coalesce(sum(a.trabalhado_min), 0)::bigint,
         coalesce(sum(a.atraso_min), 0)::bigint,
         coalesce(sum(a.extra_min), 0)::bigint,
         coalesce(sum(a.falta_min), 0)::bigint,
         count(*) filter (where a.situacao = 'falta')::bigint,
         count(*) filter (where cardinality(a.alertas) > 0)::bigint,
         (select count(*) from ajustes_ponto aj
           where aj.perfil_id = p.id and aj.status = 'pendente' and aj.tipo <> 'abono')::bigint
    from perfis p
    cross join lateral apurar_periodo(p.id, p_inicio, p_fim) a
   where p.id in (select public.equipe_ids())
   group by p.id, p.nome_completo, p.matricula, p.departamento_id
   order by p.nome_completo;
end;
$$;
comment on function public.resumo_minha_equipe(date, date) is
  'Totais do período de cada pessoa da equipe de quem está logado (gestor).';

-- ---------------------------------------------------------------------------
-- 7. Quem pode chamar (só quem está logado)
-- ---------------------------------------------------------------------------
revoke execute on function public.equipe_ids()                         from public, anon;
revoke execute on function public.eh_gestor_de(uuid)                   from public, anon;
revoke execute on function public.minha_equipe()                       from public, anon;
revoke execute on function public.dados_para_apuracao(uuid)            from public, anon;
revoke execute on function public.nome_da_pessoa(uuid)                 from public, anon;
revoke execute on function public.anexo_valido(text, uuid)             from public, anon;
revoke execute on function public.resumo_minha_equipe(date, date)      from public, anon;
revoke execute on function public.apurar_periodo(uuid, date, date)     from public, anon;
revoke execute on function public.banco_horas(uuid, date)              from public, anon;
revoke execute on function public.validar_departamento_gestor()        from public, anon, authenticated;
grant  execute on function public.equipe_ids()                         to authenticated;
grant  execute on function public.eh_gestor_de(uuid)                   to authenticated;
grant  execute on function public.minha_equipe()                       to authenticated;
grant  execute on function public.dados_para_apuracao(uuid)            to authenticated;
grant  execute on function public.nome_da_pessoa(uuid)                 to authenticated;
grant  execute on function public.anexo_valido(text, uuid)             to authenticated;
grant  execute on function public.resumo_minha_equipe(date, date)      to authenticated;
grant  execute on function public.apurar_periodo(uuid, date, date)     to authenticated;
grant  execute on function public.banco_horas(uuid, date)              to authenticated;

notify pgrst, 'reload schema';
