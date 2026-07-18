import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Se o chamador já tem o user.id à mão (ex.: acabou de chamar getUser()), passa
 * userId pra evitar uma segunda chamada de rede a auth.getUser() — cada uma
 * custa uma ida e volta cheia até o Supabase.
 */
export async function getCurrentTenantId(supabase: SupabaseClient, userId?: string): Promise<string> {
  let uid = userId
  if (!uid) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Não autenticado')
    uid = user.id
  }

  const { data, error } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', uid)
    .single()

  if (error || !data) throw new Error('Tenant não encontrado para o usuário logado')

  return data.tenant_id as string
}
