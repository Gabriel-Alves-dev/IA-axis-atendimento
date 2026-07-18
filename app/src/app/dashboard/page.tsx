import Header from '@/components/layout/Header'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/supabase/tenant'
import {
  Bot, Smartphone, MessageSquare, ShoppingBag,
  Users, AlertCircle, TrendingUp, Zap
} from 'lucide-react'

const ORDER_STATUS_MAP: Record<string, { label: string; class: string }> = {
  draft: { label: 'Rascunho', class: 'bg-muted text-muted-foreground' },
  pending_confirmation: { label: 'Aguardando confirmação', class: 'bg-yellow-500/10 text-yellow-400' },
  confirmed: { label: 'Confirmado', class: 'bg-emerald-500/10 text-emerald-400' },
  sent_to_kitchen: { label: 'Na cozinha', class: 'bg-blue-500/10 text-blue-400' },
  preparing: { label: 'Preparando', class: 'bg-yellow-500/10 text-yellow-400' },
  ready: { label: 'Pronto', class: 'bg-emerald-500/10 text-emerald-400' },
  out_for_delivery: { label: 'Saiu para entrega', class: 'bg-blue-500/10 text-blue-400' },
  completed: { label: 'Concluído', class: 'bg-muted text-muted-foreground' },
  cancelled: { label: 'Cancelado', class: 'bg-red-500/10 text-red-400' },
}

function startOfTodaySaoPaulo(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return `${parts}T00:00:00-03:00`
}

function formatPhoneDisplay(raw: string | null): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 10) return `+${digits}`
  const country = digits.slice(0, digits.length - 11)
  const area = digits.slice(-11, -9)
  const rest = digits.slice(-9)
  return `+${country || '55'} ${area} ${rest.slice(0, 5)}-${rest.slice(5)}`
}

// Stat card component
function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
}) {
  const variants = {
    default: 'border-border',
    primary: 'border-primary/30 bg-primary/5',
    success: 'border-emerald-500/30 bg-emerald-500/5',
    warning: 'border-yellow-500/30 bg-yellow-500/5',
    danger: 'border-red-500/30 bg-red-500/5',
  }
  const iconVariants = {
    default: 'text-muted-foreground bg-secondary',
    primary: 'text-primary bg-primary/10',
    success: 'text-emerald-400 bg-emerald-500/10',
    warning: 'text-yellow-400 bg-yellow-500/10',
    danger: 'text-red-400 bg-red-500/10',
  }

  return (
    <div className={`rounded-xl border p-5 bg-card flex items-start gap-4 ${variants[variant]}`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconVariants[variant]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-foreground mt-0.5">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

// Status indicator component
function StatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${active ? 'bg-primary animate-pulse-dot' : 'bg-muted-foreground'}`} />
      <span className={`text-sm font-medium ${active ? 'text-primary' : 'text-muted-foreground'}`}>
        {label}
      </span>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const tenantId = await getCurrentTenantId(supabase, user?.id)
  const todayStart = startOfTodaySaoPaulo()

  const [
    { data: agentConfig },
    { data: whatsappSession },
    { count: conversationsToday },
    { count: ordersToday },
    { count: humanHandoffs },
    { count: aiErrors },
    { data: recentConversations },
    { data: recentOrders },
  ] = await Promise.all([
    supabase.from('agent_configs').select('enabled').eq('tenant_id', tenantId).maybeSingle(),
    supabase.from('whatsapp_sessions').select('status, phone_number').eq('tenant_id', tenantId).maybeSingle(),
    supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', todayStart),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'confirmed').gte('created_at', todayStart),
    supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('mode', 'human'),
    supabase.from('ai_logs').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).not('error', 'is', null).gte('created_at', todayStart),
    supabase.from('conversations').select('customer_name, customer_phone, mode, last_message_at').eq('tenant_id', tenantId).order('last_message_at', { ascending: false, nullsFirst: false }).limit(4),
    supabase.from('orders').select('customer_name, items, total, status').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(3),
  ])

  const stats = {
    agentEnabled: agentConfig?.enabled ?? false,
    whatsappConnected: whatsappSession?.status === 'connected',
    conversationsToday: conversationsToday ?? 0,
    ordersToday: ordersToday ?? 0,
    humanHandoffs: humanHandoffs ?? 0,
    aiErrors: aiErrors ?? 0,
    phoneNumber: formatPhoneDisplay(whatsappSession?.phone_number ?? null),
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header title="Dashboard" subtitle="Visão geral do seu atendente IA" userEmail={user?.email} />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">

        {/* Status bar */}
        <div className="glass-card rounded-xl p-4 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-6 flex-1">
            <StatusBadge active={stats.agentEnabled} label={stats.agentEnabled ? 'Atendente IA ativo' : 'Atendente IA inativo'} />
            <div className="w-px h-4 bg-border" />
            <StatusBadge active={stats.whatsappConnected} label={stats.whatsappConnected ? `WhatsApp conectado` : 'WhatsApp desconectado'} />
            {stats.whatsappConnected && (
              <span className="text-xs text-muted-foreground">{stats.phoneNumber}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Zap className="w-3.5 h-3.5 text-primary" />
            <span>Atualizado agora</span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
          <StatCard
            title="Conversas hoje"
            value={stats.conversationsToday}
            subtitle="Total do dia"
            icon={MessageSquare}
            variant="primary"
          />
          <StatCard
            title="Pedidos confirmados"
            value={stats.ordersToday}
            subtitle="Via IA hoje"
            icon={ShoppingBag}
            variant="success"
          />
          <StatCard
            title="Handoffs humanos"
            value={stats.humanHandoffs}
            subtitle="Conversas assumidas"
            icon={Users}
            variant="warning"
          />
          <StatCard
            title="Erros da IA"
            value={stats.aiErrors}
            subtitle="Nas últimas 24h"
            icon={AlertCircle}
            variant={stats.aiErrors > 0 ? 'danger' : 'default'}
          />
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Recent conversations */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">Últimas conversas</h3>
              </div>
              <a href="/dashboard/conversations" className="text-xs text-primary hover:underline">Ver todas</a>
            </div>

            <div className="space-y-3">
              {(recentConversations ?? []).map((conv, i) => {
                const name = conv.customer_name ?? conv.customer_phone.replace(/@.*$/, '')
                return (
                  <a key={i} href="/dashboard/conversations" className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-muted-foreground">{name.slice(0, 2).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{name}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          conv.mode === 'ai'
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-purple-500/10 text-purple-400'
                        }`}>
                          {conv.mode === 'ai' ? 'IA' : 'Humano'}
                        </span>
                      </div>
                    </div>
                  </a>
                )
              })}
              {(!recentConversations || recentConversations.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma conversa ainda.</p>
              )}
            </div>
          </div>

          {/* Recent orders */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-400" />
                <h3 className="font-semibold text-sm">Pedidos recentes</h3>
              </div>
              <a href="/dashboard/orders" className="text-xs text-primary hover:underline">Ver todos</a>
            </div>

            <div className="space-y-3">
              {(recentOrders ?? []).map((order, i) => {
                const s = ORDER_STATUS_MAP[order.status] ?? { label: order.status, class: 'bg-muted text-muted-foreground' }
                const items = Array.isArray(order.items) ? order.items as Array<{ name: string; quantity: number }> : []
                const itemsLabel = items.map(it => `${it.quantity}x ${it.name}`).join(', ')
                return (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{order.customer_name ?? 'Cliente'}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${s.class}`}>{s.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{itemsLabel}</p>
                    </div>
                    <span className="text-sm font-bold text-foreground shrink-0">
                      R$ {Number(order.total ?? 0).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                )
              })}
              {(!recentOrders || recentOrders.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum pedido ainda.</p>
              )}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Ações rápidas
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { href: '/dashboard/whatsapp', icon: Smartphone, label: 'Conectar WhatsApp', color: 'text-green-400' },
              { href: '/dashboard/agent', icon: Bot, label: 'Configurar IA', color: 'text-blue-400' },
              { href: '/dashboard/menu', icon: ShoppingBag, label: 'Editar cardápio', color: 'text-yellow-400' },
              { href: '/dashboard/conversations', icon: MessageSquare, label: 'Ver conversas', color: 'text-purple-400' },
            ].map((action) => {
              const Icon = action.icon
              return (
                <a
                  key={action.href}
                  href={action.href}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-all duration-150 text-center group"
                >
                  <Icon className={`w-6 h-6 ${action.color} group-hover:scale-110 transition-transform`} />
                  <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">{action.label}</span>
                </a>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
