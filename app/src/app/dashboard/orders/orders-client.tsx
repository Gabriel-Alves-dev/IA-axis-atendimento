'use client'

import { useMemo, useState } from 'react'
import Header from '@/components/layout/Header'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  ShoppingBag, MapPin, CreditCard,
  Phone, Clock, Loader2, Search, Copy,
} from 'lucide-react'
import { updateOrderStatus } from './actions'

type OrderItem = { name: string; quantity: number; unit_price: number; notes?: string }

export type OrderData = {
  id: string
  customer_name: string | null
  customer_phone: string | null
  items: OrderItem[]
  subtotal: number | null
  delivery_fee: number | null
  total: number | null
  address: string | null
  payment_method: string | null
  notes: string | null
  status: string
  created_at: string
  pix_copy_paste?: string | null
}

const STATUS_COLUMNS = [
  { value: 'awaiting_payment', label: 'Aguardando pagamento', dot: 'bg-sky-400', badgeClass: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
  { value: 'pending_confirmation', label: 'Aguardando confirmação', dot: 'bg-orange-400', badgeClass: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  { value: 'confirmed', label: 'Confirmado', dot: 'bg-emerald-400', badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  { value: 'preparing', label: 'Preparando', dot: 'bg-yellow-400', badgeClass: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  { value: 'ready', label: 'Pronto', dot: 'bg-blue-400', badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { value: 'out_for_delivery', label: 'Saiu para entrega', dot: 'bg-purple-400', badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  { value: 'completed', label: 'Concluído', dot: 'bg-muted-foreground', badgeClass: 'bg-muted text-muted-foreground border-border' },
  { value: 'cancelled', label: 'Cancelado', dot: 'bg-red-400', badgeClass: 'bg-red-500/10 text-red-400 border-red-500/20' },
]

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function money(n: number | null) {
  return `R$ ${(n ?? 0).toFixed(2).replace('.', ',')}`
}

function getStatusConfig(status: string) {
  return STATUS_COLUMNS.find(s => s.value === status) || STATUS_COLUMNS[0]
}

export default function OrdersClient({ initialOrders, userEmail }: { initialOrders: OrderData[]; userEmail?: string | null }) {
  const [orders, setOrders] = useState(initialOrders)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return orders
    return orders.filter(o =>
      (o.customer_name ?? '').toLowerCase().includes(q) || o.id.startsWith(q)
    )
  }, [orders, search])

  const selectedOrder = orders.find(o => o.id === selectedId) ?? null

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    const prev = orders
    setUpdatingId(orderId)
    setOrders(os => os.map(o => o.id === orderId ? { ...o, status: newStatus } : o))
    try {
      await updateOrderStatus(orderId, newStatus)
      toast.success(`Pedido #${orderId.slice(0, 6)} → ${getStatusConfig(newStatus).label}`)
    } catch (err) {
      setOrders(prev)
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar status')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDrop = (columnValue: string) => {
    setDragOverColumn(null)
    if (draggedId) {
      const order = orders.find(o => o.id === draggedId)
      if (order && order.status !== columnValue) handleStatusChange(draggedId, columnValue)
    }
    setDraggedId(null)
  }

  const todayTotal = orders
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, o) => sum + (o.total ?? 0), 0)

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header title="Pedidos" subtitle="Acompanhe e gerencie pedidos confirmados" userEmail={userEmail} />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">

        {/* Summary */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-3xl">
          {[
            { label: 'Total do dia', value: money(todayTotal), class: 'text-primary' },
            { label: 'Pedidos ativos', value: orders.filter(o => !['completed', 'cancelled'].includes(o.status)).length, class: 'text-foreground' },
            { label: 'Concluídos', value: orders.filter(o => o.status === 'completed').length, class: 'text-emerald-400' },
          ].map((item, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className={`text-xl font-bold mt-1 ${item.class}`}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Buscar por cliente ou número do pedido..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-secondary/50 pl-9"
            />
          </div>
          <span className="text-xs text-muted-foreground shrink-0">{filtered.length} pedido(s)</span>
        </div>

        {/* Kanban board */}
        <div className="flex gap-4 overflow-x-auto pb-2">
          {STATUS_COLUMNS.map(column => {
            const columnOrders = filtered.filter(o => o.status === column.value)

            return (
              <div key={column.value} className="flex flex-col w-64 shrink-0">
                <div className="flex items-center gap-2 px-1 mb-3">
                  <span className={`w-2 h-2 rounded-full ${column.dot}`} />
                  <h3 className="text-sm font-semibold">{column.label}</h3>
                  <span className="text-xs text-muted-foreground ml-auto">{columnOrders.length}</span>
                </div>

                <div
                  onDragOver={e => { e.preventDefault(); setDragOverColumn(column.value) }}
                  onDragLeave={() => setDragOverColumn(prev => prev === column.value ? null : prev)}
                  onDrop={e => { e.preventDefault(); handleDrop(column.value) }}
                  className={`flex flex-col gap-2 rounded-xl border p-2 min-h-24 flex-1 transition-colors ${
                    dragOverColumn === column.value ? 'bg-primary/10 border-primary/40' : 'bg-secondary/20 border-border'
                  }`}
                >
                  {columnOrders.map(order => {
                    const totalQty = order.items.reduce((sum, i) => sum + i.quantity, 0)
                    return (
                      <button
                        key={order.id}
                        draggable
                        onDragStart={() => setDraggedId(order.id)}
                        onDragEnd={() => setDraggedId(null)}
                        onClick={() => setSelectedId(order.id)}
                        className={`text-left rounded-lg border border-border bg-card hover:border-primary/30 hover:bg-secondary/40 transition-colors p-3 space-y-1.5 cursor-grab active:cursor-grabbing ${
                          draggedId === order.id ? 'opacity-40' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] text-muted-foreground">#{order.id.slice(0, 6)}</span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(order.created_at)}
                          </span>
                        </div>
                        <p className="font-semibold text-sm truncate">{order.customer_name ?? 'Cliente'}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{totalQty} {totalQty === 1 ? 'item' : 'itens'}</span>
                          <span className="font-bold text-sm">{money(order.total)}</span>
                        </div>
                      </button>
                    )
                  })}

                  {columnOrders.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">Vazio</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <ShoppingBag className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Nenhum pedido encontrado</p>
            <p className="text-sm text-muted-foreground mt-1">Os pedidos confirmados pela IA aparecerão aqui</p>
          </div>
        )}
      </div>

      {/* Order details dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground font-normal">#{selectedOrder.id.slice(0, 6)}</span>
                  {selectedOrder.customer_name ?? 'Cliente'}
                </DialogTitle>
                <DialogDescription>
                  Pedido feito às {formatTime(selectedOrder.created_at)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Items */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Itens</p>
                  <div className="space-y-1">
                    {selectedOrder.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span>{item.quantity}x {item.name}</span>
                        <span className="text-muted-foreground">{money(item.quantity * item.unit_price)}</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-border/50 space-y-1">
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Subtotal</span>
                        <span>{money(selectedOrder.subtotal)}</span>
                      </div>
                      {(selectedOrder.delivery_fee ?? 0) > 0 && (
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Taxa de entrega</span>
                          <span>{money(selectedOrder.delivery_fee)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold">
                        <span>Total</span>
                        <span>{money(selectedOrder.total)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Endereço</p>
                      <p className="font-medium text-xs">{selectedOrder.address ?? '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CreditCard className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Pagamento</p>
                      <p className="font-medium text-xs">{selectedOrder.payment_method ?? '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Telefone</p>
                      <p className="font-medium text-xs">{selectedOrder.customer_phone?.replace(/@.*$/, '') ?? '—'}</p>
                    </div>
                  </div>
                </div>

                {selectedOrder.pix_copy_paste && (
                  <div className="p-3 rounded-lg bg-sky-500/5 border border-sky-500/20 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-sky-400">Código Pix copia-e-cola</p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(selectedOrder.pix_copy_paste ?? '')
                          toast.success('Código Pix copiado')
                        }}
                        className="text-sky-400 hover:text-sky-300"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground break-all font-mono">{selectedOrder.pix_copy_paste}</p>
                  </div>
                )}

                {selectedOrder.notes && (
                  <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                    <p className="text-xs text-yellow-400">⚠️ Obs: {selectedOrder.notes}</p>
                  </div>
                )}

                {/* Status change */}
                <div className="flex items-center gap-3 pt-2 border-t border-border">
                  <Select
                    value={selectedOrder.status}
                    onValueChange={v => v && handleStatusChange(selectedOrder.id, v)}
                    disabled={updatingId === selectedOrder.id}
                  >
                    <SelectTrigger className="bg-secondary/50 flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_COLUMNS.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {updatingId === selectedOrder.id && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
