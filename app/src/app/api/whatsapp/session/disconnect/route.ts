import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/supabase/tenant'
import { logoutSession, stopSession, sessionNameForTenant } from '@/lib/waha'

export async function POST() {
  const supabase = await createClient()
  const tenantId = await getCurrentTenantId(supabase)
  const sessionName = sessionNameForTenant(tenantId)

  try {
    await logoutSession(sessionName)
  } catch {
    // sessão pode já estar deslogada — segue para parar mesmo assim
  }
  await stopSession(sessionName)

  const { error } = await supabase.from('whatsapp_sessions').upsert({
    tenant_id: tenantId,
    session_name: sessionName,
    status: 'idle',
    phone_number: null,
  }, { onConflict: 'tenant_id' })
  if (error) console.error('[whatsapp session] falha ao gravar whatsapp_sessions:', error.message)

  return NextResponse.json({ ok: true })
}
