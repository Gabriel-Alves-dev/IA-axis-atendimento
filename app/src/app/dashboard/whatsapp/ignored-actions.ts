'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/supabase/tenant'

export type IgnoredChatType = 'contact' | 'group'

function toChatId(rawId: string, type: IgnoredChatType) {
  const digits = rawId.replace(/\D/g, '')
  if (type === 'group') return rawId.includes('@g.us') ? rawId : `${rawId}@g.us`
  return `${digits}@c.us`
}

export async function addIgnoredChat(input: { rawId: string; name: string; type: IgnoredChatType }) {
  const rawId = input.rawId.trim()
  if (!rawId) throw new Error('Informe o número ou ID do grupo')

  const supabase = await createClient()
  const tenantId = await getCurrentTenantId(supabase)
  const chatId = toChatId(rawId, input.type)

  const { error } = await supabase.from('ignored_chats').upsert({
    tenant_id: tenantId,
    chat_id: chatId,
    name: input.name.trim() || null,
    type: input.type,
  }, { onConflict: 'tenant_id,chat_id' })

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/whatsapp')
}

export async function removeIgnoredChat(id: string) {
  const supabase = await createClient()
  const tenantId = await getCurrentTenantId(supabase)

  const { error } = await supabase
    .from('ignored_chats')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/whatsapp')
}
