import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/supabase/tenant'
import AgentForm, { type AgentConfigData } from './agent-form'

export default async function AgentPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  const tenantId = await getCurrentTenantId(supabase, user?.id)

  const { data: config } = await supabase
    .from('agent_configs')
    .select('enabled, template_type, tone, system_prompt, fallback_message, after_hours_message, training_mode, human_approval_required, after_hours_enabled, ai_source, ai_provider, ai_model, has_custom_key:ai_api_key')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  // ai_api_key nunca é lida de volta para o client — só sabemos se existe ou não.
  const safeConfig = config ? { ...config, has_custom_key: Boolean(config.has_custom_key) } : null

  return <AgentForm initialConfig={safeConfig as AgentConfigData | null} userEmail={user?.email} />
}
