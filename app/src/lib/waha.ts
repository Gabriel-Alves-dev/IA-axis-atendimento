const WAHA_BASE_URL = process.env.WAHA_BASE_URL!
const WAHA_API_KEY = process.env.WAHA_API_KEY!

function wahaHeaders(extra?: Record<string, string>) {
  return {
    'X-Api-Key': WAHA_API_KEY,
    'Content-Type': 'application/json',
    ...extra,
  }
}

async function wahaFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${WAHA_BASE_URL}${path}`, {
    ...init,
    headers: { ...wahaHeaders(), ...(init?.headers as Record<string, string> | undefined) },
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`WAHA ${init?.method ?? 'GET'} ${path} falhou (${res.status}): ${body}`)
  }

  return res
}

export type WahaSessionStatus = 'STOPPED' | 'STARTING' | 'SCAN_QR_CODE' | 'WORKING' | 'FAILED'

export interface WahaSession {
  name: string
  status: WahaSessionStatus
  me?: { id: string; pushName?: string } | null
}

/** Cria (ou atualiza + reinicia, se já existir) a sessão do WAHA para o tenant e registra o webhook de mensagens. */
export async function startSession(sessionName: string, webhookUrl: string, hmacSecret: string) {
  const config = {
    webhooks: [
      {
        url: webhookUrl,
        events: ['message'],
        hmac: { key: hmacSecret },
      },
    ],
  }

  const existing = await getSessionStatus(sessionName)

  const res = existing
    // Sessão já existe no WAHA (mesmo que parada/deslogada): PUT atualiza a config e reinicia.
    ? await wahaFetch(`/api/sessions/${sessionName}`, {
        method: 'PUT',
        body: JSON.stringify({ name: sessionName, start: true, config }),
      })
    : await wahaFetch('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ name: sessionName, start: true, config }),
      })

  return (await res.json()) as WahaSession
}

export async function getSessionStatus(sessionName: string): Promise<WahaSession | null> {
  try {
    const res = await wahaFetch(`/api/sessions/${sessionName}`)
    return (await res.json()) as WahaSession
  } catch {
    return null
  }
}

/** Retorna o QR code em base64 (data URL pronta para <img src>). */
export async function getSessionQr(sessionName: string): Promise<string> {
  const res = await wahaFetch(`/api/${sessionName}/auth/qr`, {
    headers: { Accept: 'application/json' },
  })
  const data = (await res.json()) as { mimetype: string; data: string }
  return `data:${data.mimetype};base64,${data.data}`
}

export async function stopSession(sessionName: string) {
  await wahaFetch(`/api/sessions/${sessionName}/stop`, { method: 'POST' })
}

export async function logoutSession(sessionName: string) {
  await wahaFetch(`/api/sessions/${sessionName}/logout`, { method: 'POST' })
}

export async function sendText(sessionName: string, chatId: string, text: string) {
  await wahaFetch('/api/sendText', {
    method: 'POST',
    body: JSON.stringify({ session: sessionName, chatId, text }),
  })
}

/**
 * Resolve um LID (identificador que o WhatsApp usa pra esconder o número real do
 * cliente em alguns casos) para o número de telefone de verdade, se possível.
 * Retorna null se o WAHA ainda não conhece esse contato (ex.: primeira mensagem).
 */
export async function resolveLidToPhone(sessionName: string, lid: string): Promise<string | null> {
  try {
    const lidDigits = lid.replace(/\D/g, '')
    const res = await wahaFetch(`/api/${sessionName}/lids/${lidDigits}`)
    const data = (await res.json()) as { lid: string; pn: string | null }
    return data.pn ? data.pn.replace(/\D/g, '') : null
  } catch {
    return null
  }
}

/** Nome de sessão determinístico e estável a partir do tenant_id (WAHA aceita apenas [a-zA-Z0-9_-]). */
export function sessionNameForTenant(tenantId: string) {
  return `tenant_${tenantId.replace(/-/g, '')}`
}
