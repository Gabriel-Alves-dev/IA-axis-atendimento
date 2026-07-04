import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/supabase/tenant'
import WhatsAppClient, { type WhatsAppSessionData } from './whatsapp-client'
import type { IgnoredChatType } from './ignored-actions'

export type IgnoredChatData = {
  id: string
  chat_id: string
  name: string | null
  type: IgnoredChatType
}

export default async function WhatsAppPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const tenantId = await getCurrentTenantId(supabase)

  const [{ data: session }, { data: ignoredChats }] = await Promise.all([
    supabase.from('whatsapp_sessions').select('*').eq('tenant_id', tenantId).maybeSingle(),
    supabase.from('ignored_chats').select('id, chat_id, name, type').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
  ])

  return (
    <WhatsAppClient
      initialSession={session as WhatsAppSessionData | null}
      initialIgnoredChats={(ignoredChats ?? []) as IgnoredChatData[]}
      userEmail={user?.email}
    />
  )
}
