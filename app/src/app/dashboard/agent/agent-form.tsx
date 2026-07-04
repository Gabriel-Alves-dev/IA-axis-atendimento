'use client'

import { useState } from 'react'
import Header from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Bot, Save, Loader2, Zap, BookOpen,
  UserCheck, Clock, Settings2, ToggleLeft, ToggleRight,
  ChevronDown, ChevronUp, Sparkles, KeyRound
} from 'lucide-react'
import { saveAgentConfig, type AgentConfigInput, type AiSource } from './actions'

const TEMPLATES = [
  { value: 'lanchonete', label: '🍔 Lanchonete' },
  { value: 'pizzaria', label: '🍕 Pizzaria' },
  { value: 'barbearia', label: '✂️ Barbearia' },
  { value: 'clinica', label: '💆 Clínica Estética' },
  { value: 'loja', label: '👗 Loja de Roupas' },
  { value: 'assistencia', label: '🔧 Assistência Técnica' },
  { value: 'imobiliaria', label: '🏠 Imobiliária' },
  { value: 'generic', label: '⚙️ Genérico' },
]

const TONES = [
  { value: 'profissional', label: 'Profissional', desc: 'Formal e objetivo' },
  { value: 'amigavel', label: 'Amigável', desc: 'Cordial e próximo' },
  { value: 'informal', label: 'Informal', desc: 'Descontraído e casual' },
  { value: 'objetivo', label: 'Objetivo', desc: 'Direto ao ponto' },
  { value: 'divertido', label: 'Divertido', desc: 'Leve e bem-humorado' },
  { value: 'premium', label: 'Premium', desc: 'Sofisticado e elegante' },
]

// {{tone_instruction}} é substituído pelo webhook com base em agent_configs.tone (ver lib/agent-tones.ts)
const FORMATTING_RULES_BLOCK = `Formatação das mensagens (WhatsApp):
- Use *texto* para negrito (um asterisco de cada lado) e _texto_ para itálico — é assim que o WhatsApp formata. Nunca use markdown (**negrito**) ou HTML.
- Prefira linhas curtas. Para listar itens, uma linha por item, começando com "•".
- Emojis com moderação, só quando fizer sentido.

Tom de voz: {{tone_instruction}}

Regra crítica sobre o campo "reply":
- O "reply" é a ÚNICA coisa que o cliente recebe — não existe anexo, imagem ou mensagem separada.
- Nunca diga "aqui está", "enviei", "segue" ou "te mandei" alguma coisa (cardápio, lista, resumo) sem escrever esse conteúdo por completo dentro do próprio "reply", na mesma resposta.
- Ação send_menu: o "reply" deve conter a lista completa dos itens disponíveis do cardápio (agrupados por categoria, com nome e preço), não uma frase genérica dizendo que vai enviar.
- Ação create_order_draft ou confirm_order: o "reply" deve conter o resumo do pedido (itens, quantidades, subtotal, taxa de entrega se houver, *total* em negrito).
- Nunca prometa mandar algo "em seguida" — o conteúdo completo tem que estar na resposta atual.

Pagamento via PIX:
- Se o cliente escolher PIX como forma de pagamento e existir "pix_key" em delivery_rules no contexto, inclua a chave PIX e o valor exato a pagar (*total* em negrito) na mensagem de confirm_order, pedindo pra enviar o comprovante depois de pagar.
- Se não existir "pix_key" no contexto, não invente chave — acione handoff humano avisando que precisa de alguém pra combinar o pagamento.`

// Schema que o webhook (app/src/app/api/webhooks/waha/route.ts) exige da resposta da IA.
// Sem isso no prompt, o modelo inventa um JSON com campos diferentes e a IA sempre cai no fallback.
const JSON_SCHEMA_BLOCK = `Ações permitidas:
- reply
- ask_clarification
- send_menu
- create_order_draft
- confirm_order
- handoff_to_human
- out_of_hours_reply
- ignore

Formato obrigatório (responda SEMPRE só com este JSON, nada de texto fora dele):
{
  "action": "...",
  "reply": "...",
  "confidence": 0.0,
  "needs_human": false,
  "reason": "...",
  "order_state": {
    "items": [],
    "subtotal": null,
    "delivery_fee": null,
    "total": null,
    "address": null,
    "payment_method": null,
    "missing_fields": []
  },
  "handoff": {
    "required": false,
    "reason": null
  }
}`

const TEMPLATE_PROMPTS: Record<string, string> = {
  lanchonete: `Você é o atendente virtual da {{store_name}}.

Objetivo:
Atender clientes pelo WhatsApp, responder dúvidas, apresentar o cardápio, montar pedidos e encaminhar pedidos confirmados para a equipe.

Regras obrigatórias:
- Use apenas as informações fornecidas no contexto (loja, cardápio, histórico da conversa).
- Nunca invente preço, produto, promoção, horário ou taxa de entrega.
- Se uma informação não existir no contexto, pergunte ao cliente ou acione handoff humano — nunca invente.
- Seja educado, direto e natural.
- Não fale que é uma IA, a menos que o cliente pergunte diretamente.
- Se o cliente pedir atendente humano, reclamar, xingar, pedir reembolso ou relatar erro no pedido, acione handoff.
- Antes de confirmar pedido, colete: itens, quantidades, endereço ou retirada, forma de pagamento e confirmação final explícita.
- Não confirme pedido sem o cliente dizer claramente que confirma (ex: "sim", "confirmo", "pode fechar").

${FORMATTING_RULES_BLOCK}

${JSON_SCHEMA_BLOCK}`,
  pizzaria: `Você é o atendente virtual da {{store_name}}, uma pizzaria.

Objetivo:
Apresentar sabores, tamanhos, preços, bordas, bebidas e montar pedidos de delivery ou retirada.

Regras:
- Não invente sabor, preço, promoção ou taxa.
- Confirme tamanho da pizza, sabores, borda, bebidas, endereço e pagamento.
- Não confirme pedido sem confirmação final do cliente.

${FORMATTING_RULES_BLOCK}

${JSON_SCHEMA_BLOCK}`,
  generic: `Você é o atendente virtual da {{store_name}}.

Objetivo:
Responder dúvidas, apresentar serviços/produtos e auxiliar clientes.

Regras:
- Use apenas informações fornecidas.
- Nunca invente informações.
- Acione humano quando necessário.

${FORMATTING_RULES_BLOCK}

${JSON_SCHEMA_BLOCK}`,
}

const DEFAULT_FALLBACK_MESSAGE = 'Desculpe, não entendi. Pode reformular sua pergunta? 😊'
const DEFAULT_AFTER_HOURS_MESSAGE = 'Olá! No momento estamos fechados. Retornamos amanhã às 11h. Deixe sua mensagem e retornaremos em breve! 😊'

const AI_PROVIDERS = [
  { value: 'openai', label: 'OpenAI', modelPlaceholder: 'gpt-4.1-mini' },
  { value: 'anthropic', label: 'Anthropic (Claude)', modelPlaceholder: 'claude-sonnet-5' },
  { value: 'openrouter', label: 'OpenRouter', modelPlaceholder: 'openai/gpt-4o-mini' },
]

export type AgentConfigData = {
  enabled: boolean
  template_type: string
  tone: string
  system_prompt: string | null
  fallback_message: string | null
  after_hours_message: string | null
  training_mode: boolean
  human_approval_required: boolean
  after_hours_enabled: boolean
  ai_source: AiSource | null
  ai_provider: string | null
  ai_model: string | null
  has_custom_key: boolean
}

function buildInitialForm(config: AgentConfigData | null): AgentConfigInput {
  const templateType = config?.template_type ?? 'lanchonete'

  return {
    agentEnabled: config?.enabled ?? false,
    templateType,
    tone: config?.tone ?? 'amigavel',
    systemPrompt: config?.system_prompt ?? TEMPLATE_PROMPTS[templateType] ?? TEMPLATE_PROMPTS.generic,
    fallbackMessage: config?.fallback_message ?? DEFAULT_FALLBACK_MESSAGE,
    afterHoursMessage: config?.after_hours_message ?? DEFAULT_AFTER_HOURS_MESSAGE,
    trainingMode: config?.training_mode ?? false,
    humanApprovalRequired: config?.human_approval_required ?? false,
    afterHoursEnabled: config?.after_hours_enabled ?? true,
    aiSource: config?.ai_source ?? 'platform',
    aiProvider: config?.ai_provider ?? 'openai',
    aiModel: config?.ai_model ?? '',
    aiApiKey: '',
  }
}

export default function AgentForm({ initialConfig, userEmail }: { initialConfig: AgentConfigData | null; userEmail?: string | null }) {
  const [loading, setLoading] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [form, setForm] = useState<AgentConfigInput>(() => buildInitialForm(initialConfig))
  const hasCustomKey = initialConfig?.has_custom_key ?? false

  const handleTemplateChange = (template: string | null) => {
    if (!template) return
    setForm(f => ({
      ...f,
      templateType: template,
      systemPrompt: TEMPLATE_PROMPTS[template] || TEMPLATE_PROMPTS.generic,
    }))
  }

  const handleToggleAgent = () => {
    const newValue = !form.agentEnabled
    setForm(f => ({ ...f, agentEnabled: newValue }))
    toast.success(newValue ? '✅ Atendente IA ativado!' : '⏸️ Atendente IA desativado.')
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      await saveAgentConfig(form)
      toast.success('Configurações da IA salvas!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar configurações.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header title="Configurar IA" subtitle="Personalize o comportamento do seu atendente" userEmail={userEmail} />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Master toggle */}
          <div className={`rounded-xl border p-6 transition-all ${
            form.agentEnabled
              ? 'border-primary/30 bg-primary/5'
              : 'border-border bg-card'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                  form.agentEnabled ? 'bg-primary/20 glow-primary' : 'bg-secondary'
                }`}>
                  <Bot className={`w-7 h-7 ${form.agentEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className="font-semibold text-base">Atendente IA</p>
                  <p className="text-sm text-muted-foreground">
                    {form.agentEnabled
                      ? 'Respondendo mensagens automaticamente'
                      : 'Pausado — nenhuma resposta automática'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleToggleAgent}
                className="focus:outline-none"
                aria-label="Toggle agent"
              >
                {form.agentEnabled
                  ? <ToggleRight className="w-12 h-12 text-primary" />
                  : <ToggleLeft className="w-12 h-12 text-muted-foreground" />
                }
              </button>
            </div>
          </div>

          {/* Template & Tone */}
          <section className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-5">
              <BookOpen className="w-4 h-4 text-primary" />
              Template e tom de voz
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label>Segmento / Template</Label>
                <Select value={form.templateType} onValueChange={handleTemplateChange}>
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tom de voz</Label>
                <Select value={form.tone} onValueChange={v => v && setForm(f => ({ ...f, tone: v }))}>
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONES.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        <div>
                          <span className="font-medium">{t.label}</span>
                          <span className="text-muted-foreground ml-2 text-xs">— {t.desc}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* System prompt collapsible */}
            <div className="border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setShowPrompt(!showPrompt)}
                className="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-secondary/50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-muted-foreground" />
                  System prompt
                  <Badge variant="outline" className="text-[10px] font-normal">editável</Badge>
                </span>
                {showPrompt ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showPrompt && (
                <div className="border-t border-border p-3">
                  <Textarea
                    value={form.systemPrompt}
                    onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))}
                    className="bg-secondary/50 font-mono text-xs min-h-[200px]"
                  />
                </div>
              )}
            </div>
          </section>

          {/* Messages */}
          <section className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-5">
              <Zap className="w-4 h-4 text-primary" />
              Mensagens automáticas
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fallback">Mensagem de fallback</Label>
                <p className="text-xs text-muted-foreground">Enviada quando a IA não entende a mensagem</p>
                <Textarea
                  id="fallback"
                  value={form.fallbackMessage}
                  onChange={e => setForm(f => ({ ...f, fallbackMessage: e.target.value }))}
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="afterHours">Mensagem fora do horário</Label>
                <p className="text-xs text-muted-foreground">Enviada quando o cliente escreve fora do horário de funcionamento</p>
                <Textarea
                  id="afterHours"
                  value={form.afterHoursMessage}
                  onChange={e => setForm(f => ({ ...f, afterHoursMessage: e.target.value }))}
                  className="bg-secondary/50"
                />
              </div>
            </div>
          </section>

          {/* AI provider */}
          <section className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-primary" />
              Provedor de IA
            </h3>
            <p className="text-xs text-muted-foreground mb-5">
              Por padrão, usamos a IA da plataforma — sem nenhuma configuração extra. Se preferir, use sua própria conta de IA.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, aiSource: 'platform' }))}
                className={`text-left p-4 rounded-lg border transition-all ${
                  form.aiSource === 'platform' ? 'border-primary/40 bg-primary/5' : 'border-border bg-secondary/30 hover:bg-secondary/50'
                }`}
              >
                <p className="text-sm font-medium">✨ IA da plataforma (padrão)</p>
                <p className="text-xs text-muted-foreground mt-1">Pronta pra usar, sem token, sem configuração.</p>
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, aiSource: 'custom' }))}
                className={`text-left p-4 rounded-lg border transition-all ${
                  form.aiSource === 'custom' ? 'border-primary/40 bg-primary/5' : 'border-border bg-secondary/30 hover:bg-secondary/50'
                }`}
              >
                <p className="text-sm font-medium">🔑 Minha própria IA</p>
                <p className="text-xs text-muted-foreground mt-1">Use sua conta OpenAI, Anthropic ou OpenRouter.</p>
              </button>
            </div>

            {form.aiSource === 'custom' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-secondary/30 border border-border">
                <div className="space-y-2">
                  <Label>Provedor</Label>
                  <Select value={form.aiProvider} onValueChange={v => v && setForm(f => ({ ...f, aiProvider: v }))}>
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_PROVIDERS.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Modelo</Label>
                  <Input
                    value={form.aiModel}
                    onChange={e => setForm(f => ({ ...f, aiModel: e.target.value }))}
                    placeholder={AI_PROVIDERS.find(p => p.value === form.aiProvider)?.modelPlaceholder}
                    className="bg-secondary/50"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" />
                    Token de integração
                  </Label>
                  <Input
                    type="password"
                    value={form.aiApiKey}
                    onChange={e => setForm(f => ({ ...f, aiApiKey: e.target.value }))}
                    placeholder={hasCustomKey ? '•••••••••••• (chave salva — deixe em branco para manter)' : 'sk-...'}
                    className="bg-secondary/50"
                  />
                  {hasCustomKey && (
                    <p className="text-xs text-muted-foreground">Já existe uma chave salva. Só é exibida em branco por segurança.</p>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Behavior flags */}
          <section className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-5">
              <UserCheck className="w-4 h-4 text-primary" />
              Comportamento
            </h3>
            <div className="space-y-4">
              {[
                {
                  key: 'trainingMode',
                  label: 'Modo treinamento',
                  desc: 'A IA gera respostas mas não envia. Você aprova manualmente.',
                  icon: Settings2,
                },
                {
                  key: 'humanApprovalRequired',
                  label: 'Exigir aprovação para confirmar pedido',
                  desc: 'Pedidos precisam de aprovação humana antes de serem confirmados.',
                  icon: UserCheck,
                },
                {
                  key: 'afterHoursEnabled',
                  label: 'Responder fora do horário',
                  desc: 'Enviar mensagem de fora do horário quando o cliente escreve após o fechamento.',
                  icon: Clock,
                },
              ].map(item => {
                const Icon = item.icon
                return (
                  <div key={item.key} className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border">
                    <div className="flex items-start gap-3">
                      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                    <Switch
                      checked={form[item.key as keyof typeof form] as boolean}
                      onCheckedChange={v => setForm(f => ({ ...f, [item.key]: v }))}
                    />
                  </div>
                )
              })}
            </div>
          </section>

          {/* Save */}
          <div className="flex justify-end pb-6">
            <Button onClick={handleSave} disabled={loading} className="bg-primary text-primary-foreground hover:bg-primary/90 px-8">
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" />Salvar configurações</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
