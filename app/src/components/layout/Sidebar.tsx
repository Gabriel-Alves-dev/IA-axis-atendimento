'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Bot,
  LayoutDashboard,
  Building2,
  Smartphone,
  Settings2,
  UtensilsCrossed,
  MessageSquare,
  ShoppingBag,
  ScrollText,
  LogOut,
  ChevronRight,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/store', label: 'Minha Empresa', icon: Building2 },
  { href: '/dashboard/whatsapp', label: 'WhatsApp', icon: Smartphone },
  { href: '/dashboard/agent', label: 'Configurar IA', icon: Settings2 },
  { href: '/dashboard/menu', label: 'Cardápio / Base', icon: UtensilsCrossed },
  { href: '/dashboard/conversations', label: 'Conversas', icon: MessageSquare },
  { href: '/dashboard/orders', label: 'Pedidos', icon: ShoppingBag },
  { href: '/dashboard/logs', label: 'Logs da IA', icon: ScrollText },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Sessão encerrada')
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-64 shrink-0 flex flex-col h-screen bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-xl bg-sidebar-primary/10 border border-sidebar-primary/20 flex items-center justify-center">
          <Bot className="w-5 h-5 text-sidebar-primary" />
        </div>
        <div>
          <p className="font-semibold text-sm text-sidebar-foreground leading-tight">Atendente IA</p>
          <p className="text-[11px] text-muted-foreground">Painel Admin</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
                isActive
                  ? 'bg-sidebar-primary/10 text-sidebar-primary border border-sidebar-primary/20'
                  : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent'
              )}
            >
              <Icon className={cn(
                'w-4 h-4 shrink-0',
                isActive ? 'text-sidebar-primary' : 'text-muted-foreground group-hover:text-sidebar-foreground'
              )} />
              <span className="flex-1">{item.label}</span>
              {isActive && <ChevronRight className="w-3 h-3 text-sidebar-primary/60" />}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-150"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sair
        </button>
      </div>
    </aside>
  )
}
