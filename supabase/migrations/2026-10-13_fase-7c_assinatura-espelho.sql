-- ============================================================================
-- Ayra Ponto — Fase 7C: o colaborador confere e assina o espelho
--
-- O que esta migração faz (nenhuma marcação, pedido ou cálculo antigo muda):
--   1. espelho_conferencias: a assinatura (ou o "encontrei um problema") de
--      cada pessoa sobre a foto do espelho guardada no fechamento (Fase 7B).
--      Guarda o código de integridade da foto assinada, o jeito de confirmar
--      (digital ou senha), quando, o endereço de internet e o aparelho.
--   2. Assinar exige ter confirmado a identidade há pouco (digital ou senha):
--      o banco confere isso no próprio login, não só na tela.
--   3. Pedido de ajuste feito para um dia de mês fechado marca o espelho como
--      "com problema" e avisa o administrador e o RH.
--   4. Avisos no sininho: espelho pronto para conferir, lembrete do RH e
--      problema encontrado.
--   5. Reabrir o mês guarda as assinaturas antigas como substituídas. Ao fechar
--      de novo, quem assinou e cujo espelho não mudou continua assinado.
--
-- Pode ser executada mais de uma vez sem problema.
-- Para desligar: 2026-10-13_fase-7c_assinatura-espelho_DESFAZER.sql
-- ============================================================================

do $$
begin
  if to_regprocedure('public.fechar_mes(date,boolean)') is null then
    raise exception 'Antes desta migração é preciso aplicar a Fase 7B.';
  end if;
end $$;

begin;

-- ---------------------------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------------------------
create table if not exists public.espelho_conferencias (
  id              uuid primary key default gen_random_uuid(),
  fechamento_id   uuid not null references public.fechamentos(id) on delete cascade,
  perfil_id       uuid not null references public.perfis(id) on delete cascade,
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  competencia     date not null,
  status          text not null,
  hash            text,
  assinado_em     timestamptz,
  metodo          text,
  ip              text,
  aparelho        text,
  ajuste_id       uuid references public.ajustes_ponto(id) on delete set null,
  problema_data   date,
  problema_texto  text,
  problema_em     timestamptz,
  substituida_em  timestamptz,
  criado_em       timestamptz not null default now(),
  constraint espelho_conferencias_status check (status in ('assinado', 'com_problema')),
  constraint espelho_conferencias_assinado check (status <> 'assinado' or (assinado_em is not null and hash is not null))
);
-- uma conferência valendo por pessoa e fechamento (as substituídas ficam guardadas)
create unique index if not exists espelho_conferencias_atual
  on public.espelho_conferencias (fechamento_id, perfil_id) where substituida_em is null;
create index if not exists espelho_conferencias_perfil_idx on public.espelho_conferencias (perfil_id, competencia);

alter table public.espelho_conferencias enable row level security;

drop policy if exists "conferencias: a própria pessoa vê" on public.espelho_conferencias;
create policy "conferencias: a própria pessoa vê" on public.espelho_conferencias
  for select to authenticated
  using (perfil_id = (select auth.uid()));

drop policy if exists "conferencias: admin/rh veem a empresa" on public.espelho_conferencias;
create policy "conferencias: admin/rh veem a empresa" on public.espelho_conferencias
  for select to authenticated
  using (empresa_id = (select public.empresa_do_usuario())
         and (select public.tipo_do_usuario()) in ('administrador', 'rh'));

-- ninguém grava pelo app: só as funções abaixo
revoke all on public.espelho_conferencias from public, anon, authenticated;
grant select on public.espelho_conferencias to authenticated;

drop trigger if exists historico on public.espelho_conferencias;
create trigger historico after insert or update on public.espelho_conferencias
  for each row execute function public.registrar_historico();

-- ---------------------------------------------------------------------------
-- 2. Novos tipos de aviso
-- ---------------------------------------------------------------------------
alter table public.avisos drop constraint if exists avisos_tipo_check;
alter table public.avisos add constraint avisos_tipo_check check (tipo in (
  'pedido_novo', 'pedido_respondido', 'dia_incompleto', 'banco_vencendo', 'pessoa_nova', 'foto_para_aprovar',
  'foto_analisada', 'espelho_para_assinar', 'espelho_com_problema'));

-- ---------------------------------------------------------------------------
-- 3. Ao fechar: avisa cada pessoa (ou mantém a assinatura de quem não mudou)
-- ---------------------------------------------------------------------------
create or replace function public.conferencia_ao_fechar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antiga espelho_conferencias;
begin
  -- reaberto e fechado de novo: se a pessoa já tinha assinado exatamente este
  -- espelho (mesmo código de integridade), a assinatura continua valendo
  select * into v_antiga
    from espelho_conferencias c
   where c.fechamento_id = new.fechamento_id and c.perfil_id = new.perfil_id
     and c.status = 'assinado' and c.hash = new.hash and c.substituida_em is not null
   order by c.substituida_em desc
   limit 1;
  if v_antiga.id is not null
     and not exists (select 1 from espelho_conferencias c
                      where c.fechamento_id = new.fechamento_id and c.perfil_id = new.perfil_id
                        and c.substituida_em is null) then
    update espelho_conferencias set substituida_em = null where id = v_antiga.id;
    return null;
  end if;

  perform criar_aviso(new.perfil_id, 'espelho_para_assinar',
    'Seu espelho de ' || nome_do_mes(new.competencia) || ' está pronto',
    'Confira os dias e as horas. Se estiver tudo certo, assine com a sua digital ou senha.',
    link_do_aviso(new.perfil_id, 'espelho', to_char(new.competencia, 'YYYY-MM')),
    new.fechamento_id,
    'espelho:' || new.fechamento_id || ':' || (extract(epoch from new.criado_em) * 1000)::bigint);
  return null;
end;
$$;

drop trigger if exists conferencia_ao_fechar on public.fechamento_espelhos;
create trigger conferencia_ao_fechar after insert on public.fechamento_espelhos
  for each row execute function public.conferencia_ao_fechar();

-- Ao reabrir: as conferências viram "substituídas" (ficam guardadas) e os
-- avisos ainda não lidos saem
create or replace function public.conferencias_ao_reabrir()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'fechado' and new.status = 'reaberto' then
    update espelho_conferencias set substituida_em = now()
     where fechamento_id = new.id and substituida_em is null;
    delete from avisos
     where tipo = 'espelho_para_assinar' and referencia_id = new.id and lido_em is null;
  end if;
  return null;
end;
$$;

drop trigger if exists conferencias_ao_reabrir on public.fechamentos;
create trigger conferencias_ao_reabrir after update on public.fechamentos
  for each row execute function public.conferencias_ao_reabrir();

-- ---------------------------------------------------------------------------
-- 4. Pedido para um dia de mês fechado = "encontrei um problema"
-- ---------------------------------------------------------------------------
create or replace function public.problema_no_espelho()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pessoa perfis;
  v_fuso   text;
  v_dia    date;
  v_f      fechamentos;
  v_c      espelho_conferencias;
  r        record;
begin
  select * into v_pessoa from perfis where id = new.perfil_id;
  if v_pessoa.empresa_id is null then
    return null;
  end if;
  select coalesce(f.fuso_horario, 'America/Sao_Paulo') into v_fuso
    from (select 1) x left join filiais f on f.id = v_pessoa.filial_id;
  v_dia := coalesce(new.data_referencia, (new.marcacao_solicitada at time zone coalesce(v_fuso, 'America/Sao_Paulo'))::date);
  if v_dia is null then
    return null;
  end if;

  select * into v_f from fechamentos
   where empresa_id = v_pessoa.empresa_id and competencia = date_trunc('month', v_dia)::date and status = 'fechado';
  if v_f.id is null
     or not exists (select 1 from fechamento_espelhos e where e.fechamento_id = v_f.id and e.perfil_id = new.perfil_id) then
    return null;
  end if;

  select * into v_c from espelho_conferencias
   where fechamento_id = v_f.id and perfil_id = new.perfil_id and substituida_em is null;
  if v_c.status = 'assinado' then
    return null;  -- já assinou: o pedido segue o caminho normal
  end if;
  if v_c.id is null then
    insert into espelho_conferencias (fechamento_id, perfil_id, empresa_id, competencia, status,
                                      ajuste_id, problema_data, problema_texto, problema_em)
    values (v_f.id, new.perfil_id, v_pessoa.empresa_id, v_f.competencia, 'com_problema',
            new.id, v_dia, left(new.motivo, 500), now());
  else
    update espelho_conferencias
       set ajuste_id = new.id, problema_data = v_dia, problema_texto = left(new.motivo, 500), problema_em = now()
     where id = v_c.id;
  end if;

  for r in select p.id from perfis p
            where p.empresa_id = v_pessoa.empresa_id and p.tipo in ('administrador', 'rh')
              and p.status <> 'desligado' and p.id <> new.perfil_id
  loop
    perform criar_aviso(r.id, 'espelho_com_problema',
      v_pessoa.nome_completo || ' encontrou um problema no espelho de ' || nome_do_mes(v_f.competencia),
      'Dia ' || to_char(v_dia, 'DD/MM') || ': ' || left(new.motivo, 400)
        || '. O mês está fechado: para aprovar o pedido, reabra o mês em Fechamento do mês.',
      '/gestao/fechamento?mes=' || to_char(v_f.competencia, 'YYYY-MM'),
      new.id, 'problema:' || new.id);
  end loop;
  return null;
end;
$$;

drop trigger if exists problema_no_espelho on public.ajustes_ponto;
create trigger problema_no_espelho after insert on public.ajustes_ponto
  for each row execute function public.problema_no_espelho();

-- ---------------------------------------------------------------------------
-- 5. Assinar
-- ---------------------------------------------------------------------------
-- Quando e como a pessoa confirmou quem é (dados do próprio login)
create or replace function public.confirmacao_recente(p_minutos integer default 10)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object('metodo', a ->> 'method', 'em', to_timestamp((a ->> 'timestamp')::bigint))
    from jsonb_array_elements(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'amr', '[]'::jsonb)) a
   where (a ->> 'timestamp') ~ '^\d+$'
     and to_timestamp((a ->> 'timestamp')::bigint) >= now() - make_interval(mins => p_minutos)
   order by (a ->> 'timestamp')::bigint desc
   limit 1;
$$;

create or replace function public.assinar_espelho(p_competencia date, p_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_emp   uuid := empresa_do_usuario();
  v_comp  date := date_trunc('month', p_competencia)::date;
  v_f     fechamentos;
  v_e     fechamento_espelhos;
  v_c     espelho_conferencias;
  v_conf  jsonb;
  v_met   text;
  v_head  jsonb;
  v_ip    text;
  v_ap    text;
begin
  if v_uid is null or v_emp is null then
    raise exception 'Entre na sua conta para assinar o espelho.';
  end if;
  select * into v_f from fechamentos where empresa_id = v_emp and competencia = v_comp and status = 'fechado';
  if v_f.id is null then
    raise exception 'O espelho de % ainda não foi fechado pela empresa. Ele fica pronto para assinar depois do fechamento.', nome_do_mes(v_comp);
  end if;
  select * into v_e from fechamento_espelhos where fechamento_id = v_f.id and perfil_id = v_uid;
  if v_e.perfil_id is null then
    raise exception 'Você não entrou no fechamento de %. Fale com o RH.', nome_do_mes(v_comp);
  end if;
  if p_hash is null or p_hash <> v_e.hash then
    raise exception 'O espelho mudou desde que você abriu a tela. Atualize a página e confira de novo.';
  end if;
  select * into v_c from espelho_conferencias where fechamento_id = v_f.id and perfil_id = v_uid and substituida_em is null;
  if v_c.status = 'assinado' then
    raise exception 'Você já assinou o espelho de %.', nome_do_mes(v_comp);
  end if;

  v_conf := confirmacao_recente(10);
  if v_conf is null then
    raise exception 'Para assinar, confirme que é você com a sua digital ou a sua senha.';
  end if;
  v_met := case
    when v_conf ->> 'metodo' = 'password' then 'senha'
    when v_conf ->> 'metodo' ~* '(passkey|webauthn)' then 'digital'
    when v_conf ->> 'metodo' ~* '(otp|magiclink|email)' then 'link por e-mail'
    else left(v_conf ->> 'metodo', 40) end;

  begin
    v_head := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_head := null;
  end;
  v_ip := left(trim(split_part(coalesce(v_head ->> 'x-forwarded-for', v_head ->> 'x-real-ip', ''), ',', 1)), 60);
  v_ap := left(v_head ->> 'user-agent', 250);

  if v_c.id is null then
    insert into espelho_conferencias (fechamento_id, perfil_id, empresa_id, competencia, status, hash, assinado_em, metodo, ip, aparelho)
    values (v_f.id, v_uid, v_emp, v_comp, 'assinado', v_e.hash, now(), v_met, nullif(v_ip, ''), v_ap)
    returning * into v_c;
  else
    -- tinha encontrado um problema e agora concorda com o espelho
    update espelho_conferencias
       set status = 'assinado', hash = v_e.hash, assinado_em = now(), metodo = v_met, ip = nullif(v_ip, ''), aparelho = v_ap
     where id = v_c.id
    returning * into v_c;
  end if;

  update avisos set lido_em = now()
   where perfil_id = v_uid and tipo = 'espelho_para_assinar' and referencia_id = v_f.id and lido_em is null;

  return jsonb_build_object('competencia', v_comp, 'nome', nome_do_mes(v_comp), 'assinado_em', v_c.assinado_em,
                            'metodo', v_c.metodo, 'hash', v_c.hash);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Para o colaborador: meses fechados e se já assinou
-- ---------------------------------------------------------------------------
create or replace function public.minhas_conferencias()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'competencia', f.competencia, 'nome', nome_do_mes(f.competencia), 'fechado_em', f.fechado_em,
           'hash', e.hash, 'status', coalesce(c.status, 'pendente'), 'assinado_em', c.assinado_em, 'metodo', c.metodo)
         order by f.competencia desc), '[]'::jsonb)
    from fechamentos f
    join fechamento_espelhos e on e.fechamento_id = f.id and e.perfil_id = auth.uid()
    left join espelho_conferencias c on c.fechamento_id = f.id and c.perfil_id = auth.uid() and c.substituida_em is null
   where f.empresa_id = empresa_do_usuario() and f.status = 'fechado'
     and f.competencia >= (date_trunc('month', now()) - interval '12 months')::date;
$$;

-- ---------------------------------------------------------------------------
-- 7. Para o RH: lembrar quem ainda não assinou (no máximo 1 vez por dia)
-- ---------------------------------------------------------------------------
create or replace function public.lembrar_assinaturas(p_competencia date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp  uuid := empresa_do_usuario();
  v_comp date := date_trunc('month', p_competencia)::date;
  v_f    fechamentos;
  v_n    integer := 0;
  r      record;
begin
  if auth.uid() is null or tipo_do_usuario() not in ('administrador', 'rh') then
    raise exception 'Somente o administrador ou o RH podem mandar o lembrete.';
  end if;
  select * into v_f from fechamentos where empresa_id = v_emp and competencia = v_comp and status = 'fechado';
  if v_f.id is null then
    raise exception 'O mês de % não está fechado.', nome_do_mes(v_comp);
  end if;
  for r in
    select e.perfil_id from fechamento_espelhos e
      join perfis p on p.id = e.perfil_id and p.status <> 'desligado'
     where e.fechamento_id = v_f.id and e.perfil_id <> auth.uid()
       and not exists (select 1 from espelho_conferencias c
                        where c.fechamento_id = v_f.id and c.perfil_id = e.perfil_id and c.substituida_em is null)
  loop
    if not exists (select 1 from avisos a where a.perfil_id = r.perfil_id
                     and a.chave = 'lembrete:' || v_f.id || ':' || current_date) then
      perform criar_aviso(r.perfil_id, 'espelho_para_assinar',
        'Lembrete: confira e assine seu espelho de ' || nome_do_mes(v_comp),
        'O RH pediu para você conferir o espelho. Se estiver tudo certo, assine com a sua digital ou senha. Se algo estiver errado, toque em "Encontrei um problema".',
        link_do_aviso(r.perfil_id, 'espelho', to_char(v_comp, 'YYYY-MM')),
        v_f.id, 'lembrete:' || v_f.id || ':' || current_date);
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Quem pode chamar
-- ---------------------------------------------------------------------------
revoke execute on function public.conferencia_ao_fechar()            from public, anon, authenticated;
revoke execute on function public.conferencias_ao_reabrir()          from public, anon, authenticated;
revoke execute on function public.problema_no_espelho()              from public, anon, authenticated;
revoke execute on function public.confirmacao_recente(integer)       from public, anon;
revoke execute on function public.assinar_espelho(date, text)        from public, anon;
revoke execute on function public.minhas_conferencias()              from public, anon;
revoke execute on function public.lembrar_assinaturas(date)          from public, anon;
grant  execute on function public.confirmacao_recente(integer)       to authenticated;
grant  execute on function public.assinar_espelho(date, text)        to authenticated;
grant  execute on function public.minhas_conferencias()              to authenticated;
grant  execute on function public.lembrar_assinaturas(date)          to authenticated;

commit;

notify pgrst, 'reload schema';

-- Pronto. Rode em seguida supabase/testes/conferencia-fase-7c.sql.
