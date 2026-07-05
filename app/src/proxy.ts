import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Se o Supabase estiver inacessível (oscilação de rede/DNS), getUser lança —
  // isso é "não consegui verificar", não "não autenticado". Nesse caso deixamos a
  // requisição passar em vez de chutar um usuário logado pro /login.
  let user = null
  let authUnavailable = false
  try {
    const { data, error } = await supabase.auth.getUser()
    user = data.user
    // supabase-js embrulha falha de rede em AuthRetryableFetchError (status 0) em vez
    // de lançar — sessão inválida/expirada vem com 401/403 e essa deve ir pro login.
    if (error && (error.status === 0 || error.name === 'AuthRetryableFetchError')) {
      authUnavailable = true
    }
  } catch {
    authUnavailable = true
  }

  const { pathname } = request.nextUrl

  // Rotas públicas
  const publicRoutes = ['/login', '/register']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  // Redirecionar usuário não autenticado para login
  if (!user && !isPublicRoute && !authUnavailable) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirecionar usuário autenticado para fora do login/register
  if (user && isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // api/webhooks/* fica de fora: são chamadas servidor-a-servidor (ex.: WAHA),
    // nunca vêm com cookie de sessão de usuário — o middleware as redirecionaria pro /login.
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
