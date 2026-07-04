'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/supabase/tenant'
import { sendText, sessionNameForTenant } from '@/lib/waha'

export async function getConversationMessages(conversationId: string) {
  const supabase = await createClient()
  const tenantId = await getCurrentTenantId(supabase)

  const { data, error } = await supabase
    .from('messages')
    .select('id, sender, content, created_at')
    .eq('conversation_id', conversationId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return data
}

export async function takeoverConversation(id: string) {
  const supabase = await createClient()
  const tenantId = await getCurrentTenantId(supabase)

  const { error } = await supabase
    .from('conversations')
    .update({ mode: 'human', status: 'human_handoff' })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/conversations')
}

export async function releaseConversation(id: string) {
  const supabase = await createClient()
  const tenantId = await getCurrentTenantId(supabase)

  const { error } = await supabase
    .from('conversations')
    .update({ mode: 'ai', status: 'open' })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/conversations')
}

export async function sendHumanReply(conversationId: string, text: string) {
  if (!text.trim()) return

  const supabase = await createClient()
  const tenantId = await getCurrentTenantId(supabase)

  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('customer_phone')
    .eq('id', conversationId)
    .eq('tenant_id', tenantId)
    .single()

  if (convError || !conversation) throw new Error('Conversa não encontrada')

  const sessionName = sessionNameForTenant(tenantId)
  await sendText(sessionName, conversation.customer_phone as string, text)

  const { error } = await supabase.from('messages').insert({
    tenant_id: tenantId,
    conversation_id: conversationId,
    sender: 'human_agent',
    content: text,
    message_type: 'text',
  })
  if (error) throw new Error(error.message)

  await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId)

  revalidatePath('/dashboard/conversations')
}
