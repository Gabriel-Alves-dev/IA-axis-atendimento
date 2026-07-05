import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getPayment, verifyMpWebhookSignature } from '@/lib/mercadopago'
import { sendText } from '@/lib/waha'

export async function POST(req: Request) {
  const rawBody = await req.text()
  const url = new URL(req.url)

  let body: { type?: string; action?: string; data?: { id?: string } } = {}
  try {
    body = rawBody ? JSON.parse(rawBody) : {}
  } catch {
    return NextResponse.json({ ok: true })
  }

  const dataId = url.searchParams.get('data.id') ?? body.data?.id
  const topic = url.searchParams.get('type') ?? body.type

  if (!dataId || topic !== 'payment') {
    return NextResponse.json({ ok: true })
  }

  const supabase = createServiceClient()

  const { data: order } = await supabase
    .from('orders')
    .select('id, tenant_id, conversation_id, customer_phone, status')
    .eq('mp_payment_id', dataId)
    .maybeSingle()

  if (!order) {
    console.log('[mp webhook] ignorado: nenhum pedido com mp_payment_id =', dataId)
    return NextResponse.json({ ok: true })
  }

  const { data: storeProfile } = await supabase
    .from('store_profiles')
    .select('mercadopago_access_token, mercadopago_webhook_secret')
    .eq('tenant_id', order.tenant_id)
    .maybeSingle()

  const accessToken = storeProfile?.mercadopago_access_token as string | null | undefined
  if (!accessToken) {
    console.error('[mp webhook] pedido', order.id, 'sem mercadopago_access_token configurado pro tenant')
    return NextResponse.json({ ok: true })
  }

  const webhookSecret = storeProfile?.mercadopago_webhook_secret as string | null | undefined
  if (webhookSecret) {
    const xSignature = req.headers.get('x-signature')
    const xRequestId = req.headers.get('x-request-id')
    const valid = xSignature && xRequestId && verifyMpWebhookSignature({
      secret: webhookSecret, dataId, xSignature, xRequestId,
    })
    if (!valid) {
      console.error('[mp webhook] assinatura inválida para pedido', order.id)
      return NextResponse.json({ error: 'assinatura inválida' }, { status: 401 })
    }
  }

  if (order.status !== 'awaiting_payment') {
    // Já processado (ou cancelado) — evita reprocessar em reenvios de notificação do MP.
    return NextResponse.json({ ok: true })
  }

  const payment = await getPayment(accessToken, dataId)
  if (payment.status !== 'approved') {
    console.log('[mp webhook] pedido', order.id, 'pagamento ainda não aprovado, status =', payment.status)
    return NextResponse.json({ ok: true })
  }

  const { data: agentConfig } = await supabase
    .from('agent_configs')
    .select('human_approval_required')
    .eq('tenant_id', order.tenant_id)
    .maybeSingle()

  const newStatus = agentConfig?.human_approval_required ? 'pending_confirmation' : 'confirmed'
  await supabase.from('orders').update({ status: newStatus }).eq('id', order.id)

  if (order.conversation_id) {
    await supabase.from('conversations').update({ status: 'order_confirmed' }).eq('id', order.conversation_id)

    const { data: conversation } = await supabase
      .from('conversations')
      .select('whatsapp_session_id')
      .eq('id', order.conversation_id)
      .maybeSingle()

    const { data: waSession } = conversation?.whatsapp_session_id
      ? await supabase.from('whatsapp_sessions').select('session_name').eq('id', conversation.whatsapp_session_id).maybeSingle()
      : { data: null }

    if (waSession && order.customer_phone) {
      const msg = '✅ Pagamento confirmado! Seu pedido já está sendo preparado. Qualquer coisa, estamos por aqui.'
      try {
        await sendText(waSession.session_name, order.customer_phone, msg)
        await supabase.from('messages').insert({
          tenant_id: order.tenant_id, conversation_id: order.conversation_id, sender: 'ai', content: msg, message_type: 'text',
        })
      } catch (err) {
        console.error('[mp webhook] falha ao enviar confirmação via WhatsApp:', err instanceof Error ? err.message : err)
      }
    }
  }

  console.log('[mp webhook] pedido', order.id, 'confirmado via pagamento PIX aprovado')
  return NextResponse.json({ ok: true })
}
