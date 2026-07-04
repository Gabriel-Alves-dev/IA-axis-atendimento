'use client'

import { useState } from 'react'
import Header from '@/components/layout/Header'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollText, Search, ChevronDown, Bot, AlertCircle, CheckCircle2, Clock, Zap, Hash } from 'lucide-react'

type InputSnapshot = { messages?: Array<{ role: string; content: string }> } | null
type OutputSnapshot = { action?: string; reply?: string; confidence?: number } | null

export type AiLogData = {
  id: string
  conversation_id: string | null
  model: string | null
  prompt_tokens: number | null
  completion_tokens: number | null
  parsed_action: string | null
  error: string | null
  input_snapshot: InputSnapshot
  output_snapshot: OutputSnapshot
  created_at: string
  conversations: { customer_phone: string; customer_phone_display: string | null; customer_name: string | null } | null
}

const ACTION_COLORS: Record<string, string> = {
  reply: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  ask_clarification: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  send_menu: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  create_order_draft: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  confirm_order: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  handoff_to_human: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  out_of_hours_reply: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  ignore: 'bg-muted text-muted-foreground border-border',
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    day: '2-digit', month: '2-digit',
  })
}

function displayPhone(conv: AiLogData['conversations']): string {
  if (!conv) return '—'
  if (conv.customer_name) return conv.customer_name
  if (conv.customer_phone_display) return conv.customer_phone_display
  if (conv.customer_phone.endsWith('@lid')) return 'Número oculto'
  return conv.customer_phone.replace(/@.*$/, '')
}

export default function LogsClient({ initialLogs, userEmail }: { initialLogs: AiLogData[]; userEmail?: string | null }) {
  const [logs] = useState(initialLogs)
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const totalTokens = logs.reduce((sum, l) => sum + (l.prompt_tokens ?? 0) + (l.completion_tokens ?? 0), 0)
  const errorCount = logs.filter(l => l.error).length
  const confidences = logs.map(l => l.output_snapshot?.confidence).filter((c): c is number => typeof c === 'number')
  const avgConfidence = confidences.length ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length : 0

  const filtered = logs.filter(l => {
    const phone = displayPhone(l.conversations)
    const action = l.parsed_action ?? ''
    const matchSearch = phone.toLowerCase().includes(search.toLowerCase()) || action.includes(search)
    const matchAction = filterAction === 'all' || action === filterAction
    return matchSearch && matchAction
  })

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header title="Logs da IA" subtitle="Monitoramento técnico de chamadas à IA" userEmail={userEmail} />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total de chamadas', value: logs.length, icon: Bot, class: 'text-primary' },
              { label: 'Tokens utilizados', value: totalTokens.toLocaleString(), icon: Zap, class: 'text-yellow-400' },
              { label: 'Erros', value: errorCount, icon: AlertCircle, class: errorCount > 0 ? 'text-red-400' : 'text-muted-foreground' },
              { label: 'Confiança média', value: `${(avgConfidence * 100).toFixed(0)}%`, icon: CheckCircle2, class: 'text-emerald-400' },
            ].map((s, i) => {
              const Icon = s.icon
              return (
                <div key={i} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-4 h-4 ${s.class}`} />
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                  <p className={`text-xl font-bold ${s.class}`}>{s.value}</p>
                </div>
              )
            })}
          </div>

          {/* Filters */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por telefone ou ação..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 bg-secondary/50"
              />
            </div>
            <Select value={filterAction} onValueChange={v => v && setFilterAction(v)}>
              <SelectTrigger className="w-48 bg-secondary/50">
                <SelectValue placeholder="Filtrar por ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                {Object.keys(ACTION_COLORS).map(a => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Log entries */}
          <div className="space-y-2">
            {filtered.map(log => {
              const isExpanded = expandedId === log.id
              const action = log.parsed_action ?? '—'
              const actionColor = ACTION_COLORS[action] || 'bg-muted text-muted-foreground border-border'
              const confidence = log.output_snapshot?.confidence ?? 0
              const totalTok = (log.prompt_tokens ?? 0) + (log.completion_tokens ?? 0)

              return (
                <div key={log.id} className={`rounded-xl border overflow-hidden transition-all ${
                  log.error ? 'border-red-500/30' : 'border-border'
                } bg-card`}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    className="w-full flex items-center gap-3 p-3.5 hover:bg-secondary/30 transition-colors text-left"
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${log.error ? 'bg-red-400' : 'bg-primary'}`} />

                    <Badge variant="outline" className={`text-[10px] shrink-0 ${actionColor}`}>
                      {action}
                    </Badge>

                    <span className="text-xs text-muted-foreground font-mono shrink-0">{displayPhone(log.conversations)}</span>

                    <div className="flex items-center gap-1 shrink-0">
                      <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div
                          className={`h-full rounded-full ${confidence >= 0.8 ? 'bg-primary' : confidence >= 0.6 ? 'bg-yellow-400' : 'bg-red-400'}`}
                          style={{ width: `${confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{(confidence * 100).toFixed(0)}%</span>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                      <Hash className="w-3 h-3" />
                      {totalTok} tokens
                    </div>

                    <span className="text-[10px] text-muted-foreground font-mono">{log.model ?? '—'}</span>

                    <div className="flex-1" />

                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                      <Clock className="w-3 h-3" />
                      {formatDateTime(log.created_at)}
                    </div>

                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border p-4 space-y-4">
                      {log.error && (
                        <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-red-400">{log.error}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Input (últimas mensagens)</p>
                          <div className="bg-secondary/50 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                            {(log.input_snapshot?.messages ?? []).map((m, i) => (
                              <div key={i}>
                                <p className="text-[10px] text-primary font-medium uppercase">{m.role}</p>
                                <p className="text-xs text-foreground mt-0.5 whitespace-pre-wrap">{m.content?.slice(0, 200)}{(m.content?.length ?? 0) > 200 ? '...' : ''}</p>
                              </div>
                            ))}
                            {!log.input_snapshot?.messages?.length && (
                              <p className="text-xs text-muted-foreground">Sem histórico registrado.</p>
                            )}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Output (resposta da IA)</p>
                          <div className="bg-secondary/50 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                            <div>
                              <p className="text-[10px] text-primary font-medium uppercase">action</p>
                              <p className="text-xs text-foreground font-mono">{log.output_snapshot?.action ?? '—'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-primary font-medium uppercase">reply</p>
                              <p className="text-xs text-foreground whitespace-pre-wrap">{log.output_snapshot?.reply ?? '—'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-primary font-medium uppercase">confidence</p>
                              <p className="text-xs text-foreground font-mono">{log.output_snapshot?.confidence ?? '—'}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>Prompt tokens: <strong className="text-foreground">{log.prompt_tokens ?? 0}</strong></span>
                        <span>Completion tokens: <strong className="text-foreground">{log.completion_tokens ?? 0}</strong></span>
                        <span>Total: <strong className="text-foreground">{totalTok}</strong></span>
                        <span>Conversa: <strong className="text-foreground font-mono">{log.conversation_id?.slice(0, 8) ?? '—'}</strong></span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {filtered.length === 0 && (
              <div className="text-center py-16">
                <ScrollText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">Nenhum log encontrado</p>
                <p className="text-sm text-muted-foreground mt-1">Os logs aparecerão quando a IA começar a responder mensagens</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
