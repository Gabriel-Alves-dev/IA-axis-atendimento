'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Bell, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  title: string
  subtitle?: string
  userEmail?: string | null
}

export default function Header({ title, subtitle, userEmail }: HeaderProps) {
  const initials = userEmail?.slice(0, 2).toUpperCase() ?? 'AI'
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- guarda padrão de hidratação (next-themes), precisa rodar só no client
    setMounted(true)
  }, [])

  return (
    <header className="h-16 px-6 flex items-center justify-between border-b border-border bg-card/50 backdrop-blur-sm">
      <div>
        <h2 className="text-base font-semibold text-foreground leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 text-muted-foreground hover:text-foreground"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          aria-label="Alternar tema claro/escuro"
        >
          {mounted && resolvedTheme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </Button>

        <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground">
          <Bell className="w-4 h-4" />
        </Button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
          <span className="text-xs font-bold text-primary">{initials}</span>
        </div>
      </div>
    </header>
  )
}
