'use client'

import { useEffect, useRef, useState } from 'react'
import Header from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  MessageSquare, Search, Bot, UserCheck,
  Send, Phone, Loader2, CircleSlash, ChevronLeft,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getConversationMessages, takeoverConversation, releaseConversation, closeConversation, sendHumanReply } from './actions'

export type ConversationData = {
  id: string
  customer_phone: string
  customer_phone_display: string | null
  customer_name: string | null
  mode: string
  status: string
  last_message_at: string | null
  lastMessage: string
}

type Message = { id: string; sender: string; content: string | null; created_at: string }

const STATUS_MAP: Record<string, { label: string; class: string }> = {
  open: { label: 'Aberta', class: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  waiting_customer: { label: 'Aguardando cliente', class: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  waiting_store: { label: 'Aguardando loja', class: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  order_draft: { label: 'Pedido em andamento', class: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  order_confirmed: { label: 'Pedido confirmado', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  human_handoff: { label: 'Handoff humano', class: 'bg-red-500/10 text-red-400 border-red-500/20' },
  closed: { label: 'Encerrada', class: 'bg-muted text-muted-foreground border-border' },
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/@.*$/, '')
  return /^\d+$/.test(digits) ? digits : raw
}

/**
 * O WhatsApp às vezes esconde o número real do cliente atrás de um @lid — nesse
 * caso não mostramos o ID interno (que parece número mas não é), e sim um aviso,
 * a menos que já tenhamos conseguido resolver o número de verdade.
 */
function displayPhone(conv: Pick<ConversationData, 'customer_phone' | 'customer_phone_display'>): string {
  if (conv.customer_phone_display) return conv.customer_phone_display
  if (conv.customer_phone.endsWith('@lid')) return 'Número oculto pelo WhatsApp'
  return formatPhone(conv.customer_phone)
}

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default function ConversationsClient({ initialConversations, userEmail }: { initialConversations: ConversationData[]; userEmail?: string | null }) {
  const [conversations, setConversations] = useState(initialConversations)
  const [selectedId, setSelectedId] = useState<string | null>(initialConversations[0]?.id ?? null)
  const [search, setSearch] = useState('')
  const [replyText, setReplyText] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  // No celular só cabe um painel por vez: lista OU chat (com botão de voltar).
  const [mobileChatOpen, setMobileChatOpen] = useState(false)

  const selected = conversations.find(c => c.id === selectedId)

  const filtered = conversations.filter(c =>
    (c.customer_name ?? displayPhone(c)).toLowerCase().includes(search.toLowerCase()) ||
    c.lastMessage.toLowerCase().includes(search.toLowerCase())
  )

  const loadMessages = async (id: string) => {
    setLoadingMessages(true)
    try {
      const data = await getConversationMessages(id)
      setMessages(data as Message[])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar mensagens')
    } finally {
      setLoadingMessages(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch inicial é assíncrono, setState só roda depois do await
    if (selectedId) loadMessages(selectedId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedIdRef = useRef(selectedId)
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])

  // Realtime: novas mensagens e mudanças de conversa aparecem sem precisar dar F5.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('conversations-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const row = payload.new as { id: string; conversation_id: string; sender: string; content: string | null; created_at: string }

        if (row.conversation_id === selectedIdRef.current) {
          setMessages(prev => prev.some(m => m.id === row.id) ? prev : [...prev, {
            id: row.id, sender: row.sender, content: row.content, created_at: row.created_at,
          }])
        }

        setConversations(prev => {
          const exists = prev.some(c => c.id === row.conversation_id)
          if (!exists) return prev
          return prev
            .map(c => c.id === row.conversation_id
              ? { ...c, lastMessage: row.content ?? c.lastMessage, last_message_at: row.created_at }
              : c)
            .sort((a, b) => new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime())
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, (payload) => {
        const row = payload.new as { id: string; mode: string; status: string }
        setConversations(prev => prev.map(c => c.id === row.id ? { ...c, mode: row.mode, status: row.status } : c))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, (payload) => {
        const row = payload.new as ConversationData
        setConversations(prev => prev.some(c => c.id === row.id) ? prev : [{ ...row, lastMessage: '' }, ...prev])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleSelect = (id: string) => {
    setSelectedId(id)
    setMobileChatOpen(true)
    loadMessages(id)
  }

  const handleTakeover = async (id: string) => {
    setConversations(cs => cs.map(c => c.id === id ? { ...c, mode: 'human', status: 'human_handoff' } : c))
    try {
      await takeoverConversation(id)
      toast.success('Você assumiu a conversa.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao assumir conversa')
    }
  }

  const handleRelease = async (id: string) => {
    setConversations(cs => cs.map(c => c.id === id ? { ...c, mode: 'ai', status: 'open' } : c))
    try {
      await releaseConversation(id)
      toast.success('Conversa devolvida para a IA.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao devolver conversa')
    }
  }

  const handleClose = async (id: string) => {
    setConversations(cs => cs.map(c => c.id === id ? { ...c, mode: 'ai', status: 'closed' } : c))
    try {
      await closeConversation(id)
      toast.success('Atendimento encerrado. A próxima mensagem do cliente abre uma conversa nova.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao encerrar atendimento')
    }
  }

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedId) return
    setSending(true)
    const text = replyText
    try {
      await sendHumanReply(selectedId, text)
      // A mensagem enviada chega pela assinatura realtime (evita duplicar)
      setReplyText('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar mensagem')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header title="Conversas" subtitle="Gerencie e monitore conversas do WhatsApp" userEmail={userEmail} />

      <div className="flex flex-1 overflow-hidden">
        {/* List */}
        <div className={`w-full md:w-80 shrink-0 border-r border-border flex-col ${mobileChatOpen ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar conversas..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 bg-secondary/50 text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.map(conv => {
              const name = conv.customer_name ?? displayPhone(conv)
              return (
                <button
                  key={conv.id}
                  onClick={() => handleSelect(conv.id)}
                  className={`w-full text-left flex items-start gap-3 p-3 border-b border-border/50 hover:bg-secondary/50 transition-colors ${
                    selectedId === conv.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-muted-foreground">{name.slice(0, 2).toUpperCase()}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className="text-sm font-medium truncate">{name}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(conv.last_message_at)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${
                        conv.mode === 'ai'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                      }`}>
                        {conv.mode === 'ai' ? 'IA' : 'Humano'}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}

            {filtered.length === 0 && (
              <div className="text-center py-16 px-4">
                <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma conversa ainda</p>
              </div>
            )}
          </div>
        </div>

        {/* Chat */}
        {selected ? (
          <div className={`flex-1 flex-col overflow-hidden ${mobileChatOpen ? 'flex' : 'hidden md:flex'}`}>
            <div className="px-3 md:px-5 py-3 border-b border-border bg-card/50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <button
                  onClick={() => setMobileChatOpen(false)}
                  aria-label="Voltar para a lista"
                  className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-muted-foreground">
                    {(selected.customer_name ?? displayPhone(selected)).slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{selected.customer_name ?? displayPhone(selected)}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Phone className="w-3 h-3 text-muted-foreground shrink-0" />
                    <p className="text-xs text-muted-foreground truncate">{displayPhone(selected)}</p>
                    <Badge variant="outline" className={`text-[9px] h-4 ${STATUS_MAP[selected.status]?.class ?? ''}`}>
                      {STATUS_MAP[selected.status]?.label ?? selected.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {selected.status !== 'closed' && (
                  <>
                    {selected.mode === 'ai' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTakeover(selected.id)}
                        className="text-xs h-7 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                      >
                        <UserCheck className="w-3 h-3 mr-1.5" />
                        Assumir
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRelease(selected.id)}
                        className="text-xs h-7 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                      >
                        <Bot className="w-3 h-3 mr-1.5" />
                        Devolver à IA
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleClose(selected.id)}
                      className="text-xs h-7 border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                    >
                      <CircleSlash className="w-3 h-3 mr-1.5" />
                      Encerrar
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender === 'customer' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[70%] rounded-xl px-4 py-2.5 text-sm ${
                      msg.sender === 'customer'
                        ? 'bg-secondary text-foreground'
                        : 'bg-primary/10 text-foreground border border-primary/20'
                    }`}>
                      {msg.sender !== 'customer' && (
                        <div className="flex items-center gap-1 mb-1">
                          {msg.sender === 'ai'
                            ? <><Bot className="w-3 h-3 text-primary" /><span className="text-[10px] text-primary font-medium">Atendente IA</span></>
                            : <><UserCheck className="w-3 h-3 text-primary" /><span className="text-[10px] text-primary font-medium">Você</span></>
                          }
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 text-right">
                        {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
              {!loadingMessages && messages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center mt-8">Sem mensagens ainda.</p>
              )}
            </div>

            {/* Reply area */}
            {selected.status === 'closed' && (
              <div className="p-4 border-t border-border bg-card/50">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CircleSlash className="w-4 h-4" />
                  <span>Atendimento encerrado — a próxima mensagem do cliente abre uma conversa nova.</span>
                </div>
              </div>
            )}

            {selected.status !== 'closed' && selected.mode === 'human' && (
              <div className="p-4 border-t border-border bg-card/50">
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite uma mensagem..."
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendReply()}
                    className="bg-secondary/50"
                  />
                  <Button onClick={handleSendReply} disabled={sending} className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0">
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Modo humano ativo — suas mensagens serão enviadas diretamente ao cliente</p>
              </div>
            )}

            {selected.status !== 'closed' && selected.mode === 'ai' && (
              <div className="p-4 border-t border-border bg-card/50">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Bot className="w-4 h-4 text-primary" />
                  <span>A IA está respondendo automaticamente. Clique em <strong>&quot;Assumir&quot;</strong> para enviar mensagens.</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 hidden md:flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">Nenhuma conversa selecionada</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
