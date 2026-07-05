import crypto from 'crypto'

const MP_BASE_URL = 'https://api.mercadopago.com'

export type MpPayment = {
  id: number
  status: string // pending | approved | rejected | cancelled | ...
  external_reference?: string
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string
      qr_code_base64?: string
      ticket_url?: string
    }
  }
}

function mpFetch(accessToken: string, path: string, init: RequestInit = {}) {
  return fetch(`${MP_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...init.headers,
    },
  })
}

/** Cria uma cobrança PIX na conta Mercado Pago do próprio tenant e devolve o QR code / copia-e-cola. */
export async function createPixPayment(accessToken: string, opts: {
  amount: number
  description: string
  externalReference: string
  payerEmail: string
  notificationUrl?: string
}): Promise<MpPayment> {
  const res = await mpFetch(accessToken, '/v1/payments', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': opts.externalReference },
    body: JSON.stringify({
      transaction_amount: opts.amount,
      description: opts.description,
      payment_method_id: 'pix',
      external_reference: opts.externalReference,
      notification_url: opts.notificationUrl,
      payer: { email: opts.payerEmail },
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Mercado Pago createPixPayment falhou (${res.status}): ${body}`)
  }

  return res.json()
}

export async function getPayment(accessToken: string, paymentId: string): Promise<MpPayment> {
  const res = await mpFetch(accessToken, `/v1/payments/${paymentId}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Mercado Pago getPayment falhou (${res.status}): ${body}`)
  }
  return res.json()
}

/**
 * Valida o header x-signature de uma notificação de webhook do Mercado Pago.
 * Formato do header: "ts=<timestamp>,v1=<hmac hex>"
 * Manifest assinado: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 */
export function verifyMpWebhookSignature(opts: {
  secret: string
  dataId: string
  xSignature: string
  xRequestId: string
}): boolean {
  const parts = Object.fromEntries(
    opts.xSignature.split(',').map(p => {
      const [k, v] = p.split('=')
      return [k?.trim(), v?.trim()]
    })
  )
  const ts = parts.ts
  const v1 = parts.v1
  if (!ts || !v1) return false

  const manifest = `id:${opts.dataId.toLowerCase()};request-id:${opts.xRequestId};ts:${ts};`
  const expected = crypto.createHmac('sha256', opts.secret).update(manifest).digest('hex')
  if (expected.length !== v1.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1))
}
