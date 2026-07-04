'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/supabase/tenant'

export type AiSource = 'platform' | 'custom'

export type AgentConfigInput = {
  agentEnabled: boolean
  templateType: string
  tone: string
  systemPrompt: string
  fallbackMessage: string
  afterHoursMessage: string
  trainingMode: boolean
  humanApprovalRequired: boolean
  afterHoursEnabled: boolean
  aiSource: AiSource
  aiProvider: string
  aiModel: string
  /** Só enviado quando o usuário digita uma chave nova; vazio = manter a atual. */
  aiApiKey: string
}

export async function saveAgentConfig(input: AgentConfigInput) {
  const supabase = await createClient()
  const tenantId = await getCurrentTenantId(supabase)

  const payload: Record<string, unknown> = {
    tenant_id: tenantId,
    enabled: input.agentEnabled,
    template_type: input.templateType,
    tone: input.tone,
    system_prompt: input.systemPrompt,
    fallback_message: input.fallbackMessage,
    after_hours_message: input.afterHoursMessage,
    training_mode: input.trainingMode,
    human_approval_required: input.humanApprovalRequired,
    after_hours_enabled: input.afterHoursEnabled,
    ai_source: input.aiSource,
    ai_provider: input.aiSource === 'custom' ? input.aiProvider : null,
    ai_model: input.aiSource === 'custom' ? input.aiModel : null,
  }

  // Só sobrescreve a chave salva se o usuário digitou uma nova.
  if (input.aiSource === 'custom' && input.aiApiKey.trim()) {
    payload.ai_api_key = input.aiApiKey.trim()
  } else if (input.aiSource === 'platform') {
    payload.ai_api_key = null
  }

  const { error } = await supabase.from('agent_configs').upsert(payload, { onConflict: 'tenant_id' })

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/agent')
}
