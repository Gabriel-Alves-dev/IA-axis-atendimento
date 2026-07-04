import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/supabase/tenant'
import { getSessionQr, sessionNameForTenant } from '@/lib/waha'

export async function GET() {
  const supabase = await createClient()
  const tenantId = await getCurrentTenantId(supabase)
  const sessionName = sessionNameForTenant(tenantId)

  try {
    const qr = await getSessionQr(sessionName)
    return NextResponse.json({ qr })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Falha ao gerar QR code' },
      { status: 400 }
    )
  }
}
