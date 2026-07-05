'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Header from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import {
  Smartphone, Wifi, WifiOff, RefreshCw, Link2Off,
  QrCode, AlertCircle, Loader2, Clock, Users, Trash2, Plus,
} from 'lucide-react'
import { addIgnoredChat, removeIgnoredChat, type IgnoredChatType } from './ignored-actions'
import type { IgnoredChatData } from './page'

type SessionStatus = 'idle' | 'creating' | 'qr_pending' | 'connected' | 'disconnected' | 'failed'

export type WhatsAppSessionData = {
  status: string
  phone_number: string | null
}

const STATUS_MAP: Record<string, SessionStatus> = {
  pending: 'idle',
  creating: 'creating',
  qr_pending: 'qr_pending',
  connected: 'connected',
  disconnected: 'disconnected',
  failed: 'failed',
  idle: 'idle',
}

export default function WhatsAppClient({
  initialSession,
  initialIgnoredChats,
  userEmail,
}: {
  initialSession: WhatsAppSessionData | null
  initialIgnoredChats: IgnoredChatData[]
  userEmail?: string | null
}) {
  const [status, setStatus] = useState<SessionStatus>(STATUS_MAP[initialSession?.status ?? 'idle'] ?? 'idle')
  const [phoneNumber, setPhoneNumber] = useState<string | null>(initialSession?.phone_number ?? null)
  const [qr, setQr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const pollStatus = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      const res = await fetch('/api/whatsapp/session')
      const data = await res.json()
      const mapped: Record<string, SessionStatus> = {
        WORKING: 'connected',
        SCAN_QR_CODE: 'qr_pending',
        STARTING: 'creating',
        FAILED: 'failed',
        STOPPED: 'idle',
      }
      const next = mapped[data.status] ?? 'idle'
      setStatus(next)
      if (next === 'connected') {
        setPhoneNumber(data.phoneNumber ?? null)
        setQr(null)
        stopPolling()
        if (!opts?.silent) toast.success('WhatsApp conectado com sucesso!')
      }
      if (next === 'failed') {
        stopPolling()
      }
      if (next === 'qr_pending') {
        // O WAHA pode levar alguns segundos pra sair de STARTING e ficar pronto pro QR —
        // por isso o QR é buscado aqui (a cada poll) e não logo após criar a sessão.
        const qrRes = await fetch('/api/whatsapp/session/qr')
        if (qrRes.ok) {
          const qrData = await qrRes.json()
          setQr(qrData.qr)
        }
      }
    } catch {
      // mantém o estado atual, tenta de novo no próximo tick
    }
  }, [stopPolling])

  // Sincroniza com o status real do WAHA ao abrir a tela — o valor inicial vindo
  // do banco pode estar desatualizado (ou nunca ter sido gravado).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch inicial é assíncrono, setState só roda depois do await
    pollStatus({ silent: true })
    return () => stopPolling()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreateSession = async () => {
    setLoading(true)
    setStatus('creating')
    try {
      const res = await fetch('/api/whatsapp/session', { method: 'POST' })
      if (!res.ok) throw new Error('Falha ao criar sessão no WAHA')
      const data = await res.json()

      if (data.status === 'WORKING') {
        setStatus('connected')
        toast.success('WhatsApp já estava conectado!')
      } else {
        pollRef.current = setInterval(pollStatus, 3000)
        await pollStatus({ silent: true })
      }
    } catch (err) {
      setStatus('failed')
      toast.error(err instanceof Error ? err.message : 'Erro ao conectar WhatsApp')
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = async () => {
    setLoading(true)
    try {
      await fetch('/api/whatsapp/session/disconnect', { method: 'POST' })
      stopPolling()
      setStatus('idle')
      setPhoneNumber(null)
      setQr(null)
      toast.success('WhatsApp desconectado.')
    } catch {
      toast.error('Erro ao desconectar.')
    } finally {
      setLoading(false)
    }
  }

  const statusConfig: Record<SessionStatus, { label: string; color: string; icon: React.ElementType }> = {
    idle: { label: 'Não conectado', color: 'text-muted-foreground', icon: WifiOff },
    creating: { label: 'Criando sessão...', color: 'text-yellow-500', icon: Loader2 },
    qr_pending: { label: 'Aguardando leitura do QR', color: 'text-yellow-500', icon: QrCode },
    connected: { label: 'Conectado', color: 'text-primary', icon: Wifi },
    disconnected: { label: 'Desconectado', color: 'text-red-400', icon: WifiOff },
    failed: { label: 'Falhou — tente novamente', color: 'text-red-400', icon: AlertCircle },
  }

  const s = statusConfig[status]
  const StatusIcon = s.icon

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header title="WhatsApp" subtitle="Conecte o WhatsApp Business da sua loja" userEmail={userEmail} />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Status card */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  status === 'connected' ? 'bg-primary/10 border border-primary/20' : 'bg-secondary'
                }`}>
                  <Smartphone className={`w-5 h-5 ${status === 'connected' ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className="font-semibold text-sm">Status da conexão</p>
                  <div className={`flex items-center gap-1.5 mt-0.5 ${s.color}`}>
                    <StatusIcon className={`w-3.5 h-3.5 ${status === 'creating' ? 'animate-spin' : ''}`} />
                    <span className="text-xs font-medium">{s.label}</span>
                  </div>
                </div>
              </div>

              {status === 'connected' && (
                <Badge className="bg-primary/10 text-primary border-primary/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mr-1.5 animate-pulse-dot" />
                  Online
                </Badge>
              )}
            </div>

            {status === 'connected' && phoneNumber && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 mb-6">
                <p className="text-xs text-muted-foreground mb-1">Número conectado</p>
                <p className="text-lg font-bold text-primary">{phoneNumber}</p>
              </div>
            )}

            {status === 'qr_pending' && qr && (
              <div className="flex flex-col items-center gap-4 mb-6">
                <div className="p-4 rounded-2xl bg-secondary border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt="QR Code WhatsApp" width={220} height={220} className="rounded-lg" />
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>Aguardando leitura...</span>
                </div>

                <div className="text-center text-sm text-muted-foreground max-w-xs">
                  Abra o <strong className="text-foreground">WhatsApp Business</strong> no seu celular →
                  Mais opções → Dispositivos conectados → Conectar um dispositivo
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              {(status === 'idle' || status === 'disconnected' || status === 'failed') && (
                <Button
                  onClick={handleCreateSession}
                  disabled={loading}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Criando sessão...</>
                  ) : (
                    <><QrCode className="w-4 h-4 mr-2" />Conectar WhatsApp</>
                  )}
                </Button>
              )}

              {status === 'qr_pending' && (
                <Button variant="outline" onClick={handleCreateSession} disabled={loading} className="flex-1">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Gerar novo QR
                </Button>
              )}

              {status === 'connected' && (
                <Button
                  variant="outline"
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2Off className="w-4 h-4 mr-2" />}
                  Desconectar
                </Button>
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold text-sm mb-4">Como conectar</h3>
            <ol className="space-y-3">
              {[
                { step: '1', text: 'Clique em "Conectar WhatsApp" para gerar o QR Code' },
                { step: '2', text: 'Abra o WhatsApp Business no seu celular' },
                { step: '3', text: 'Vá em Mais opções (⋮) → Dispositivos conectados' },
                { step: '4', text: 'Toque em "Conectar um dispositivo"' },
                { step: '5', text: 'Escaneie o QR Code exibido na tela' },
                { step: '6', text: 'Pronto! Seu número estará conectado ao atendente IA' },
              ].map(item => (
                <li key={item.step} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[11px] font-bold text-primary shrink-0 mt-0.5">
                    {item.step}
                  </span>
                  <p className="text-sm text-muted-foreground">{item.text}</p>
                </li>
              ))}
            </ol>

            <div className="mt-5 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
              <p className="text-xs text-yellow-500 font-medium flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Use o WhatsApp Business (não o WhatsApp pessoal). O número ficará associado a esta plataforma.
              </p>
            </div>
          </div>

          <IgnoredChatsCard initialItems={initialIgnoredChats} />
        </div>
      </div>
    </div>
  )
}

function IgnoredChatsCard({ initialItems }: { initialItems: IgnoredChatData[] }) {
  const [items, setItems] = useState(initialItems)
  const [rawId, setRawId] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<IgnoredChatType>('contact')
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    if (!rawId.trim()) {
      toast.error('Informe o número ou ID do grupo')
      return
    }
    setSaving(true)
    try {
      await addIgnoredChat({ rawId, name, type })
      toast.success('Adicionado à lista de ignorados')
      setRawId('')
      setName('')
      // A Server Action já revalida a rota; refletimos localmente pra resposta imediata
      setItems(prev => [{ id: crypto.randomUUID(), chat_id: rawId, name: name || null, type }, ...prev])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao adicionar')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (id: string) => {
    const prev = items
    setItems(items.filter(i => i.id !== id))
    try {
      await removeIgnoredChat(id)
    } catch (err) {
      setItems(prev)
      toast.error(err instanceof Error ? err.message : 'Erro ao remover')
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="font-semibold text-sm flex items-center gap-2 mb-1">
        <Users className="w-4 h-4 text-primary" />
        Contatos e grupos ignorados
      </h3>
      <p className="text-xs text-muted-foreground mb-5">
        A IA nunca vai responder mensagens vindas desses números ou grupos.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-3 mb-5">
        <div className="space-y-1.5">
          <Label className="text-xs">{type === 'group' ? 'ID do grupo' : 'Número (com DDD)'}</Label>
          <Input
            value={rawId}
            onChange={e => setRawId(e.target.value)}
            placeholder={type === 'group' ? 'ex: 12036304xxxx-160xxxxx' : 'ex: 11999998888'}
            className="bg-secondary/50"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Nome (opcional)</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="ex: Grupo da equipe" className="bg-secondary/50" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Tipo</Label>
          <Select value={type} onValueChange={v => v && setType(v as IgnoredChatType)}>
            <SelectTrigger className="bg-secondary/50 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="contact">Contato</SelectItem>
              <SelectItem value="group">Grupo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button onClick={handleAdd} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum contato ou grupo ignorado ainda.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(item => (
              <TableRow key={item.id}>
                <TableCell>{item.name || '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{item.chat_id}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">{item.type === 'group' ? 'Grupo' : 'Contato'}</Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-destructive" onClick={() => handleRemove(item.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
