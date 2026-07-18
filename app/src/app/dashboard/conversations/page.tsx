import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/supabase/tenant'
import ConversationsClient, { type ConversationData } from './conversations-client'

export default async function ConversationsPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  const tenantId = await getCurrentTenantId(supabase, user?.id)

  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, customer_phone, customer_phone_display, customer_name, mode, status, last_message_at')
    .eq('tenant_id', tenantId)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(100)

  const ids = (conversations ?? []).map(c => c.id)
  const { data: lastMessages } = ids.length
    ? await supabase
        .from('messages')
        .select('conversation_id, content, created_at')
        .in('conversation_id', ids)
        .order('created_at', { ascending: false })
    : { data: [] }

  const lastMessageByConversation = new Map<string, string>()
  for (const msg of lastMessages ?? []) {
    if (!lastMessageByConversation.has(msg.conversation_id)) {
      lastMessageByConversation.set(msg.conversation_id, msg.content ?? '')
    }
  }

  const enriched: ConversationData[] = (conversations ?? []).map(c => ({
    ...c,
    lastMessage: lastMessageByConversation.get(c.id) ?? '',
  }))

  return <ConversationsClient initialConversations={enriched} userEmail={user?.email} />
}
