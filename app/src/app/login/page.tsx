'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AxisMark, AxisSignature } from '@/components/brand/AxisLogo'
import { Loader2, Eye, EyeOff, MessageSquare, Zap, ShoppingBag } from 'lucide-react'

const highlights = [
  { icon: MessageSquare, text: 'Atendimento automático no WhatsApp, 24 horas por dia' },
  { icon: ShoppingBag, text: 'Pedidos montados e confirmados pela IA, com PIX na conversa' },
  { icon: Zap, text: 'Configuração em minutos — sem código, sem complicação' },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast.error('Erro ao entrar', { description: error.message })
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">

      {/* Painel de marca — vira faixa compacta no mobile */}
      <div className="lg:w-[45%] xl:w-2/5 bg-sidebar text-sidebar-foreground flex flex-col justify-between p-8 lg:p-12">
        <div className="flex items-center gap-3">
          {/* Espaço da logo da Axis — ver components/brand/AxisLogo.tsx pra trocar pela oficial */}
          <AxisMark className="w-10 h-10" />
          <div className="leading-tight">
            <p className="font-heading font-bold text-lg tracking-tight">
              axis <span className="text-sidebar-primary">atendimento</span>
            </p>
            <p className="text-xs text-sidebar-foreground/50">IA no WhatsApp</p>
          </div>
        </div>

        <div className="hidden lg:block space-y-8 my-12">
          <h1 className="font-heading text-3xl xl:text-4xl font-bold leading-tight tracking-tight">
            Seu negócio atendendo
            <br />
            <span className="text-sidebar-primary">sozinho, do jeito certo.</span>
          </h1>

          <ul className="space-y-4">
            {highlights.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-lg bg-sidebar-accent flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-sidebar-primary" />
                </span>
                <span className="text-sm text-sidebar-foreground/80 leading-relaxed">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="hidden lg:block">
          <AxisSignature variant="sidebar" />
        </div>
      </div>

      {/* Formulário */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="font-heading text-2xl font-bold text-foreground tracking-tight">Bem-vindo de volta</h2>
            <p className="text-muted-foreground text-sm mt-1.5">Acesse o painel da sua loja</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="bg-card h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="bg-card h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Não tem conta?{' '}
            <Link href="/register" className="text-primary hover:underline font-medium">
              Criar conta grátis
            </Link>
          </div>

          <div className="mt-10 text-center lg:hidden">
            <AxisSignature />
          </div>
        </div>
      </div>
    </div>
  )
}
