import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendText, resolveLidToPhone } from '@/lib/waha'
import { callAi, type ChatMessage } from '@/lib/ai'
import { isStoreOpen } from '@/lib/business-hours'
import { getToneInstruction } from '@/lib/agent-tones'
import { createPixPayment } from '@/lib/mercadopago'

type WahaMessagePayload = {
  id: string
  from: string
  to: string
  body: string
  fromMe: boolean
  hasMedia: boolean
  timestamp: number
  notifyName?: string
}

type AiAction =
  | 'reply' | 'ask_clarification' | 'send_menu' | 'create_order_draft'
  | 'confirm_order' | 'handoff_to_human' | 'out_of_hours_reply' | 'ignore'

interface AiResponse {
  action: AiAction
  reply: string
  confidence?: number
  needs_human?: boolean
  reason?: string
  order_state?: {
    items: Array<{ name: string; quantity: number; unit_price: number; notes?: string }>
    subtotal: number | null
    delivery_fee: number | null
    total: number | null
    address: string | null
    payment_method: string | null
    missing_fields: string[]
  }
  handoff?: { required: boolean; reason?: string | null }
}

const ALLOWED_ACTIONS: AiAction[] = [
  'reply', 'ask_clarification', 'send_menu', 'create_order_draft',
  'confirm_order', 'handoff_to_human', 'out_of_hours_reply', 'ignore',
]

function verifyHmac(rawBody: string, header: string | null): boolean {
  const secret = process.env.WAHA_WEBHOOK_SECRET
  if (!secret) return true // sem segredo configurado: pula verificação (dev)
  if (!header) return false

  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex')
  if (expected.length !== header.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(header))
}

function parseAiJson(text: string): AiResponse | null {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/, '')
  try {
    const parsed = JSON.parse(cleaned)
    if (!ALLOWED_ACTIONS.includes(parsed.action)) return null
    return parsed as AiResponse
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text()
  const hmacHeader = req.headers.get('x-webhook-hmac')

  if (!verifyHmac(rawBody, hmacHeader)) {
    return NextResponse.json({ error: 'assinatura inválida' }, { status: 401 })
  }

  const body = JSON.parse(rawBody) as { event: string; session: string; payload: WahaMessagePayload }
  console.log('[waha webhook] recebido:', body.event, 'session:', body.session, 'from:', body.payload?.from, 'fromMe:', body.payload?.fromMe)

  if (body.event !== 'message' || body.payload.fromMe) {
    console.log('[waha webhook] ignorado: evento não é "message" ou é mensagem própria')
    return NextResponse.json({ ok: true })
  }

  if (!body.payload.body?.trim() && !body.payload.hasMedia) {
    // Notificações internas do WhatsApp (ex.: handshake de criptografia do primeiro contato)
    // chegam como "message" com corpo vazio — não é uma mensagem real do cliente.
    console.log('[waha webhook] ignorado: mensagem sem conteúdo (provável notificação interna do WhatsApp)')
    return NextResponse.json({ ok: true })
  }

  if (body.payload.from.endsWith('@broadcast') || body.payload.from.endsWith('@newsletter')) {
    // status@broadcast (Status do WhatsApp) e canais/newsletter não são conversas de cliente —
    // não dá pra responder esses chats (WAHA retorna erro ao tentar).
    console.log('[waha webhook] ignorado: remetente é um broadcast/newsletter, não um chat real')
    return NextResponse.json({ ok: true })
  }

  const supabase = createServiceClient()
  const { payload, session: sessionName } = body

  const { data: whatsappSession, error: sessionLookupError } = await supabase
    .from('whatsapp_sessions')
    .select('id, tenant_id')
    .eq('session_name', sessionName)
    .maybeSingle()

  if (sessionLookupError) console.error('[waha webhook] erro ao buscar whatsapp_sessions:', sessionLookupError.message)

  if (!whatsappSession) {
    console.log('[waha webhook] ignorado: nenhuma whatsapp_sessions com session_name =', sessionName)
    return NextResponse.json({ ok: true })
  }

  const tenantId = whatsappSession.tenant_id as string

  const { data: webhookEvent } = await supabase.from('webhook_events').insert({
    tenant_id: tenantId,
    source: 'waha',
    event_type: body.event,
    raw_payload: body,
    processed: false,
  }).select('id').single()

  const markProcessed = async (error?: string) => {
    if (webhookEvent?.id) {
      await supabase.from('webhook_events').update({ processed: true, error: error ?? null }).eq('id', webhookEvent.id)
    }
  }

  try {
    const { data: ignored } = await supabase
      .from('ignored_chats')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('chat_id', payload.from)
      .maybeSingle()

    if (ignored) {
      console.log('[waha webhook] ignorado: chat_id está na lista de ignorados')
      await markProcessed()
      return NextResponse.json({ ok: true })
    }

    const { data: agentConfig, error: agentConfigError } = await supabase
      .from('agent_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (agentConfigError) console.error('[waha webhook] erro ao buscar agent_configs:', agentConfigError.message)

    if (!agentConfig?.enabled) {
      console.log('[waha webhook] ignorado: agent_configs não existe ou enabled = false para tenant', tenantId)
      await markProcessed()
      return NextResponse.json({ ok: true })
    }

    const { data: storeProfile } = await supabase
      .from('store_profiles')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    // Localiza ou cria a conversa
    const { data: existingConversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('customer_phone', payload.from)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let conversation = existingConversation
    if (!conversation || conversation.status === 'closed') {
      const { data: created } = await supabase.from('conversations').insert({
        tenant_id: tenantId,
        whatsapp_session_id: whatsappSession.id,
        customer_phone: payload.from,
        customer_name: payload.notifyName ?? null,
        mode: 'ai',
        status: 'open',
      }).select('*').single()
      conversation = created
    }

    // payload.from pode ser um @lid (o WhatsApp esconde o número real em alguns casos) —
    // tenta resolver o número de verdade só pra exibição no painel, sem trocar o
    // identificador usado pra responder (customer_phone continua sendo o @lid/@c.us original).
    if (conversation && payload.from.endsWith('@lid') && !conversation.customer_phone_display) {
      const resolved = await resolveLidToPhone(sessionName, payload.from)
      if (resolved) {
        conversation.customer_phone_display = resolved
        await supabase.from('conversations').update({ customer_phone_display: resolved }).eq('id', conversation.id)
      }
    }

    await supabase.from('messages').insert({
      tenant_id: tenantId,
      conversation_id: conversation!.id,
      sender: 'customer',
      content: payload.body,
      message_type: payload.hasMedia ? 'media' : 'text',
      raw_payload: payload,
    })
    await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversation!.id)

    // Se um humano assumiu a conversa, a IA não responde
    if (conversation!.mode === 'human') {
      console.log('[waha webhook] ignorado: conversation.mode = human')
      await markProcessed()
      return NextResponse.json({ ok: true })
    }

    // Fora do horário de funcionamento: resposta fixa, sem chamar a IA
    if (!isStoreOpen(storeProfile?.opening_hours)) {
      console.log('[waha webhook] loja fechada (opening_hours), after_hours_enabled =', agentConfig.after_hours_enabled)
      if (agentConfig.after_hours_enabled) {
        const msg = agentConfig.after_hours_message || 'No momento estamos fechados. Retornamos em breve!'
        await sendText(sessionName, payload.from, msg)
        await supabase.from('messages').insert({
          tenant_id: tenantId, conversation_id: conversation!.id, sender: 'ai', content: msg, message_type: 'text',
        })
      }
      await markProcessed()
      return NextResponse.json({ ok: true })
    }

    const { data: menuItems } = await supabase
      .from('menu_items')
      .select('category, name, description, ingredients, price, available')
      .eq('tenant_id', tenantId)
      .eq('available', true)
      .limit(200)

    const { data: history } = await supabase
      .from('messages')
      .select('sender, content')
      .eq('conversation_id', conversation!.id)
      .order('created_at', { ascending: false })
      .limit(10)

    const chatHistory: ChatMessage[] = (history ?? [])
      .reverse()
      .filter(m => m.content)
      .map(m => ({ role: m.sender === 'customer' ? 'user' : 'assistant', content: m.content as string }))

    const context = {
      store: {
        name: storeProfile?.store_name ?? '',
        business_type: storeProfile?.business_type ?? 'generic',
        opening_hours: storeProfile?.opening_hours ?? {},
        payment_methods: storeProfile?.payment_methods ?? [],
        delivery_rules: storeProfile?.delivery_rules ?? {},
      },
      menu_items: menuItems ?? [],
      current_order: conversation!.current_order ?? {},
    }

    const systemPrompt = (agentConfig.system_prompt || '')
      .replace(/\{\{store_name\}\}/g, storeProfile?.store_name ?? 'nossa loja')
      .replace(/\{\{tone_instruction\}\}/g, getToneInstruction(agentConfig.tone))
    const messages: ChatMessage[] = [
      { role: 'system', content: `${systemPrompt}\n\nContexto disponível (JSON):\n${JSON.stringify(context)}` },
      ...chatHistory,
    ]

    console.log('[waha webhook] chamando IA, source =', agentConfig.ai_source ?? 'platform')
    const aiResult = await callAi(messages, {
      source: agentConfig.ai_source ?? 'platform',
      provider: agentConfig.ai_provider,
      model: agentConfig.ai_model,
      apiKey: agentConfig.ai_api_key,
    })
    console.log('[waha webhook] resposta bruta da IA:', aiResult.text)

    const aiJson = parseAiJson(aiResult.text)
    if (!aiJson) console.warn('[waha webhook] IA não retornou JSON válido, usando fallback_message')
    const parsed: AiResponse = aiJson ?? {
      action: 'reply',
      reply: agentConfig.fallback_message || 'Desculpe, não entendi. Pode reformular?',
    }
    console.log('[waha webhook] ação decidida:', parsed.action)

    if (parsed.action === 'handoff_to_human' || parsed.needs_human || parsed.handoff?.required) {
      await supabase.from('conversations').update({ mode: 'human', status: 'human_handoff' }).eq('id', conversation!.id)
    } else if (parsed.action === 'confirm_order' && parsed.order_state) {
      const os = parsed.order_state
      const current = conversation!.current_order as typeof os | null
      const sameOrder =
        current?.total === os.total &&
        current?.address === os.address &&
        current?.payment_method === os.payment_method
      const isPix = (os.payment_method ?? '').toLowerCase().includes('pix')
      const mpToken = storeProfile?.mercadopago_access_token as string | null | undefined

      if (isPix && mpToken) {
        // Fluxo de pagamento automático: gera uma cobrança PIX real na conta MP do tenant.
        // O pedido só é confirmado de verdade quando o webhook do Mercado Pago avisar que caiu.
        const alreadyAwaiting = sameOrder && ['awaiting_payment', 'order_confirmed'].includes(conversation!.status)
        if (alreadyAwaiting) {
          console.log('[waha webhook] confirm_order repetido (pix automático), ignorando duplicata')
        } else {
          const { data: newOrder, error: orderError } = await supabase.from('orders').insert({
            tenant_id: tenantId,
            conversation_id: conversation!.id,
            customer_phone: payload.from,
            customer_name: conversation!.customer_name,
            items: os.items,
            subtotal: os.subtotal,
            delivery_fee: os.delivery_fee,
            total: os.total,
            address: os.address,
            payment_method: os.payment_method,
            status: 'awaiting_payment',
          }).select('id').single()

          if (orderError || !newOrder) {
            console.error('[waha webhook] erro ao criar pedido awaiting_payment:', orderError?.message)
          } else {
            try {
              const payment = await createPixPayment(mpToken, {
                amount: os.total ?? 0,
                description: `Pedido ${storeProfile?.store_name ?? ''}`.trim(),
                externalReference: newOrder.id,
                // Com credenciais de TESTE do MP, o pagador também precisa ser um usuário de
                // teste — senão a API recusa com 401 "Unauthorized use of live credentials".
                // Em dev, defina MP_TEST_PAYER_EMAIL com o e-mail de um usuário de teste comprador.
                payerEmail: process.env.MP_TEST_PAYER_EMAIL
                  || `pix.${payload.from.replace(/\D/g, '')}@clientes.axisatendimento.com`,
                notificationUrl: process.env.WEBHOOK_BASE_URL
                  ? `${process.env.WEBHOOK_BASE_URL}/api/webhooks/mercadopago`
                  : undefined,
              })
              const pixCode = payment.point_of_interaction?.transaction_data?.qr_code

              await supabase.from('orders').update({
                mp_payment_id: String(payment.id),
                pix_copy_paste: pixCode ?? null,
                pix_qr_base64: payment.point_of_interaction?.transaction_data?.qr_code_base64 ?? null,
              }).eq('id', newOrder.id)

              if (pixCode) {
                parsed.reply = `${parsed.reply}\n\n*Pix Copia e Cola:*\n${pixCode}\n\nAssim que o pagamento cair, seu pedido é confirmado automaticamente. ✅`
              }
              await supabase.from('conversations').update({ status: 'awaiting_payment', current_order: os }).eq('id', conversation!.id)
            } catch (mpError) {
              console.error('[waha webhook] erro ao gerar cobrança PIX no Mercado Pago:', mpError instanceof Error ? mpError.message : mpError)
              await supabase.from('orders').update({ status: 'cancelled', notes: 'Falha ao gerar cobrança PIX' }).eq('id', newOrder.id)
              parsed.reply = 'Desculpe, tive um problema para gerar o pagamento agora. Já chamei um atendente pra te ajudar.'
              await supabase.from('conversations').update({ mode: 'human', status: 'human_handoff' }).eq('id', conversation!.id)
            }
          }
        }
      } else if (isPix) {
        // Sem Mercado Pago conectado: só dá pra seguir se a loja tiver uma chave PIX fixa cadastrada.
        const pixKey = storeProfile?.delivery_rules?.pix_key as string | null | undefined
        if (!pixKey) {
          console.log('[waha webhook] pix escolhido sem mp_token nem pix_key configurada, acionando handoff')
          parsed.reply = 'Só um instante, vou chamar alguém da nossa equipe pra combinar o pagamento com você.'
          await supabase.from('conversations').update({ mode: 'human', status: 'human_handoff' }).eq('id', conversation!.id)
        } else {
          const alreadyConfirmed = sameOrder && conversation!.status === 'order_confirmed'
          if (alreadyConfirmed) {
            console.log('[waha webhook] confirm_order repetido para o mesmo pedido, ignorando duplicata')
          } else {
            await supabase.from('orders').insert({
              tenant_id: tenantId,
              conversation_id: conversation!.id,
              customer_phone: payload.from,
              customer_name: conversation!.customer_name,
              items: os.items,
              subtotal: os.subtotal,
              delivery_fee: os.delivery_fee,
              total: os.total,
              address: os.address,
              payment_method: os.payment_method,
              status: agentConfig.human_approval_required ? 'pending_confirmation' : 'confirmed',
            })
            await supabase.from('conversations').update({ status: 'order_confirmed', current_order: os }).eq('id', conversation!.id)
            const total = (os.total ?? 0).toFixed(2).replace('.', ',')
            parsed.reply = `${parsed.reply}\n\n*Chave Pix:* ${pixKey}\nValor: *R$ ${total}*\nPor favor, envie o comprovante depois de pagar.`
          }
        }
      } else {
        // Cartão na entrega, dinheiro etc. — confirmação de boa-fé, sem gateway envolvido.
        const alreadyConfirmed = sameOrder && conversation!.status === 'order_confirmed'
        if (alreadyConfirmed) {
          console.log('[waha webhook] confirm_order repetido para o mesmo pedido, ignorando duplicata')
        } else {
          await supabase.from('orders').insert({
            tenant_id: tenantId,
            conversation_id: conversation!.id,
            customer_phone: payload.from,
            customer_name: conversation!.customer_name,
            items: os.items,
            subtotal: os.subtotal,
            delivery_fee: os.delivery_fee,
            total: os.total,
            address: os.address,
            payment_method: os.payment_method,
            status: agentConfig.human_approval_required ? 'pending_confirmation' : 'confirmed',
          })
          await supabase.from('conversations').update({ status: 'order_confirmed', current_order: os }).eq('id', conversation!.id)
        }
      }
    } else if (parsed.action === 'create_order_draft' && parsed.order_state) {
      await supabase.from('conversations').update({ status: 'order_draft', current_order: parsed.order_state }).eq('id', conversation!.id)
    }

    if (parsed.action !== 'ignore' && parsed.reply) {
      await sendText(sessionName, payload.from, parsed.reply)
      await supabase.from('messages').insert({
        tenant_id: tenantId, conversation_id: conversation!.id, sender: 'ai', content: parsed.reply, message_type: 'text',
      })
    }

    await supabase.from('ai_logs').insert({
      tenant_id: tenantId,
      conversation_id: conversation!.id,
      model: aiResult.model,
      prompt_tokens: aiResult.promptTokens ?? null,
      completion_tokens: aiResult.completionTokens ?? null,
      input_snapshot: { messages },
      output_snapshot: parsed,
      parsed_action: parsed.action,
    })

    console.log('[waha webhook] concluído com sucesso, resposta enviada:', parsed.action !== 'ignore' && !!parsed.reply)
    await markProcessed()
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'erro desconhecido'
    console.error('[waha webhook] ERRO:', message)
    await markProcessed(message)
    return NextResponse.json({ ok: false, error: message }, { status: 200 })
  }
}
