import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Faltam as variáveis VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
    'Copie .env.example para .env (local) ou configure-as na Vercel (produção).'
  )
}

// "passkey": entrar com a digital ou o rosto do aparelho (Fase 6B). No
// Supabase o recurso ainda é "beta": precisa desta opção ligada.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { experimental: { passkey: true } },
})
