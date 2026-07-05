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
import { Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react'

const steps = [
  'Crie sua conta em menos de um minuto',
  'Conecte o WhatsApp da sua loja com um QR Code',
  'Cadastre o cardápio e deixe a IA atender por você',
]

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) {
      toast.error('Senha muito curta', { description: 'A senha deve ter pelo menos 6 caracteres.' })
      return
    }
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, company_name: companyName },
      },
    })

    if (error) {
      toast.error('Erro ao criar conta', { description: error.message })
      setLoading(false)
      return
    }

    toast.success('Conta criada!', { description: 'Verifique seu e-mail para confirmar o cadastro.' })
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">

      {/* Painel de marca */}
      <div className="lg:w-[45%] xl:w-2/5 bg-sidebar text-sidebar-foreground flex flex-col justify-between p-8 lg:p-12">
        <div className="flex items-center gap-3">
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
            Comece agora.
            <br />
            <span className="text-sidebar-primary">É mais simples do que parece.</span>
          </h1>

          <ul className="space-y-4">
            {steps.map((text, i) => (
              <li key={i} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-sidebar-primary shrink-0 mt-0.5" />
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
            <h2 className="font-heading text-2xl font-bold text-foreground tracking-tight">Criar conta</h2>
            <p className="text-muted-foreground text-sm mt-1.5">Configure seu atendente IA em minutos</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Seu nome</Label>
              <Input
                id="name"
                type="text"
                placeholder="João Silva"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
                className="bg-card h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Nome do negócio</Label>
              <Input
                id="company"
                type="text"
                placeholder="Lanchonete da Tia Maria"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                disabled={loading}
                className="bg-card h-11"
              />
            </div>

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
                  minLength={6}
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
              <p className="text-xs text-muted-foreground">Mínimo de 6 caracteres</p>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-medium mt-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando conta...
                </>
              ) : (
                'Criar conta grátis'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Já tem conta?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Entrar
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
