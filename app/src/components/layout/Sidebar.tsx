'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { AxisMark, AxisWordmark, AxisSignature } from '@/components/brand/AxisLogo'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import {
  LayoutDashboard,
  Building2,
  Smartphone,
  Settings2,
  UtensilsCrossed,
  MessageSquare,
  ShoppingBag,
  ScrollText,
  LogOut,
  Menu,
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

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
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
    <div className="flex flex-col h-full bg-sidebar">
      {/* Marca */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <AxisMark className="w-9 h-9 shrink-0" />
        <AxisWordmark variant="sidebar" />
      </div>

      {/* Navegação */}
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
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent'
              )}
            >
              <Icon className={cn(
                'w-4 h-4 shrink-0',
                isActive ? 'text-sidebar-primary-foreground' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground'
              )} />
              <span className="flex-1">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Sair + assinatura */}
      <div className="px-3 py-4 border-t border-sidebar-border space-y-3">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-all duration-150"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sair
        </button>
        <div className="px-3">
          <AxisSignature variant="sidebar" />
        </div>
      </div>
    </div>
  )
}

/** Sidebar fixa do desktop — escondida no mobile. */
export default function Sidebar() {
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col h-screen border-r border-sidebar-border">
      <SidebarNav />
    </aside>
  )
}

/** Barra superior do mobile com o menu em drawer — escondida no desktop. */
export function MobileTopbar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="md:hidden flex items-center justify-between h-14 px-4 border-b border-sidebar-border bg-sidebar shrink-0">
        <div className="flex items-center gap-2.5">
          <AxisMark className="w-7 h-7" />
          <AxisWordmark variant="sidebar" />
        </div>
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-72 p-0 border-sidebar-border">
          <SidebarNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  )
}
