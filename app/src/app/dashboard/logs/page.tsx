import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/supabase/tenant'
import LogsClient, { type AiLogData } from './logs-client'

export default async function LogsPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  const tenantId = await getCurrentTenantId(supabase, user?.id)

  const { data: logs } = await supabase
    .from('ai_logs')
    .select('id, conversation_id, model, prompt_tokens, completion_tokens, parsed_action, error, input_snapshot, output_snapshot, created_at, conversations(customer_phone, customer_phone_display, customer_name)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(200)

  return <LogsClient initialLogs={(logs ?? []) as unknown as AiLogData[]} userEmail={user?.email} />
}
