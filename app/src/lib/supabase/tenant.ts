import type { SupabaseClient } from '@supabase/supabase-js'

export async function getCurrentTenantId(supabase: SupabaseClient): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data, error } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  if (error || !data) throw new Error('Tenant não encontrado para o usuário logado')

  return data.tenant_id as string
}
