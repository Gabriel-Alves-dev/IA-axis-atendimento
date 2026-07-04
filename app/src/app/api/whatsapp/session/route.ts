import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/supabase/tenant'
import { startSession, getSessionStatus, sessionNameForTenant } from '@/lib/waha'

export async function POST() {
  const supabase = await createClient()
  const tenantId = await getCurrentTenantId(supabase)
  const sessionName = sessionNameForTenant(tenantId)

  const webhookUrl = `${process.env.WEBHOOK_BASE_URL}/api/webhooks/waha`
  const session = await startSession(sessionName, webhookUrl, process.env.WAHA_WEBHOOK_SECRET!)

  const { error } = await supabase.from('whatsapp_sessions').upsert({
    tenant_id: tenantId,
    session_name: sessionName,
    status: session.status === 'WORKING' ? 'connected' : 'qr_pending',
    waha_url: process.env.WAHA_BASE_URL,
  }, { onConflict: 'tenant_id' })
  if (error) console.error('[whatsapp session] falha ao gravar whatsapp_sessions:', error.message)

  return NextResponse.json({ status: session.status })
}

export async function GET() {
  const supabase = await createClient()
  const tenantId = await getCurrentTenantId(supabase)
  const sessionName = sessionNameForTenant(tenantId)

  const session = await getSessionStatus(sessionName)
  if (!session) {
    return NextResponse.json({ status: 'STOPPED' })
  }

  const mappedStatus =
    session.status === 'WORKING' ? 'connected' :
    session.status === 'SCAN_QR_CODE' ? 'qr_pending' :
    session.status === 'FAILED' ? 'failed' :
    session.status === 'STARTING' ? 'creating' : 'idle'

  const { error } = await supabase.from('whatsapp_sessions').upsert({
    tenant_id: tenantId,
    session_name: sessionName,
    status: mappedStatus,
    phone_number: session.me?.id?.split('@')[0] ?? null,
    last_connected_at: session.status === 'WORKING' ? new Date().toISOString() : undefined,
  }, { onConflict: 'tenant_id' })
  if (error) console.error('[whatsapp session] falha ao gravar whatsapp_sessions:', error.message)

  return NextResponse.json({ status: session.status, phoneNumber: session.me?.id?.split('@')[0] ?? null })
}
