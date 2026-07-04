import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Client de service-role: ignora RLS. Uso restrito a rotas server-only
// sem sessão de usuário (ex.: webhook do WAHA). Nunca importar em código
// que roda no client.
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } }
  )
}
