export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export interface AiCallOptions {
  source: 'platform' | 'custom'
  provider?: string | null
  model?: string | null
  apiKey?: string | null
}

const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4.1-mini',
  anthropic: 'claude-sonnet-5',
  openrouter: 'openai/gpt-4o-mini',
}

async function callOpenAiCompatible(baseUrl: string, apiKey: string, model: string, messages: ChatMessage[]) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      ...(baseUrl.includes('api.openai.com') ? { response_format: { type: 'json_object' } } : {}),
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Chamada à IA falhou (${res.status}): ${body}`)
  }

  const data = await res.json()
  return {
    text: data.choices?.[0]?.message?.content ?? '',
    promptTokens: data.usage?.prompt_tokens as number | undefined,
    completionTokens: data.usage?.completion_tokens as number | undefined,
  }
}

async function callAnthropic(apiKey: string, model: string, messages: ChatMessage[]) {
  const system = messages.find(m => m.role === 'system')?.content
  const rest = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }))

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system,
      messages: rest,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Chamada à IA (Anthropic) falhou (${res.status}): ${body}`)
  }

  const data = await res.json()
  return {
    text: data.content?.[0]?.text ?? '',
    promptTokens: data.usage?.input_tokens as number | undefined,
    completionTokens: data.usage?.output_tokens as number | undefined,
  }
}

export type ExtractedMenuItem = {
  category: string
  name: string
  description: string
  price: number | null
  ingredients: string[]
}

const MENU_EXTRACTION_PROMPT = `Você é um extrator de cardápios. A partir do texto ou das imagens fornecidas, identifique todos os itens de cardápio (produtos vendidos) e retorne SOMENTE um JSON no formato:
{ "items": [ { "category": "...", "name": "...", "description": "...", "price": 0.0, "ingredients": ["..."] } ] }

Regras:
- category deve ser uma destas: Lanches, Bebidas, Porções, Sobremesas, Combos, Outros — escolha a mais próxima.
- price é um número (ponto decimal, sem "R$"); se não conseguir ler o preço, use null.
- ingredients é uma lista curta de ingredientes citados na descrição do item; use [] se não houver.
- Não invente item que não esteja no documento. Não repita o mesmo item duas vezes.
- Se não conseguir identificar nenhum item, retorne { "items": [] }.`

function parseExtractedItems(text: string): ExtractedMenuItem[] {
  try {
    const parsed = JSON.parse(text)
    const items = Array.isArray(parsed) ? parsed : parsed.items
    if (!Array.isArray(items)) return []
    return items
      .filter((i): i is Record<string, unknown> => typeof i === 'object' && i !== null && typeof i.name === 'string' && i.name.trim())
      .map(i => ({
        category: typeof i.category === 'string' ? i.category : 'Outros',
        name: String(i.name).trim(),
        description: typeof i.description === 'string' ? i.description : '',
        price: typeof i.price === 'number' ? i.price : null,
        ingredients: Array.isArray(i.ingredients) ? i.ingredients.filter((x): x is string => typeof x === 'string') : [],
      }))
  } catch {
    return []
  }
}

/** Extrai itens de cardápio a partir de texto (PDF com texto real) usando a IA da plataforma. */
export async function extractMenuFromText(text: string): Promise<ExtractedMenuItem[]> {
  const apiKey = process.env.OPENAI_API_KEY!
  const result = await callOpenAiCompatible('https://api.openai.com/v1', apiKey, DEFAULT_MODELS.openai, [
    { role: 'system', content: MENU_EXTRACTION_PROMPT },
    { role: 'user', content: text.slice(0, 20000) },
  ])
  return parseExtractedItems(result.text)
}

/** Extrai itens de cardápio a partir de uma ou mais imagens (data URLs base64) usando a IA da plataforma. */
export async function extractMenuFromImages(dataUrls: string[]): Promise<ExtractedMenuItem[]> {
  const apiKey = process.env.OPENAI_API_KEY!
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: DEFAULT_MODELS.openai,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: MENU_EXTRACTION_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extraia os itens de cardápio destas imagens.' },
            ...dataUrls.map(url => ({ type: 'image_url', image_url: { url } })),
          ],
        },
      ],
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Chamada à IA (visão) falhou (${res.status}): ${body}`)
  }

  const data = await res.json()
  return parseExtractedItems(data.choices?.[0]?.message?.content ?? '')
}

export async function callAi(messages: ChatMessage[], opts: AiCallOptions) {
  const provider = opts.source === 'platform' ? 'openai' : (opts.provider || 'openai')
  const model = opts.model || DEFAULT_MODELS[provider] || DEFAULT_MODELS.openai
  const apiKey = opts.source === 'platform' ? process.env.OPENAI_API_KEY! : opts.apiKey

  if (!apiKey) throw new Error('Nenhuma chave de IA configurada para este tenant')

  const result = await (
    provider === 'anthropic' ? callAnthropic(apiKey, model, messages) :
    provider === 'openrouter' ? callOpenAiCompatible('https://openrouter.ai/api/v1', apiKey, model, messages) :
    callOpenAiCompatible('https://api.openai.com/v1', apiKey, model, messages)
  )

  return { ...result, model }
}
