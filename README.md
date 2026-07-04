# Atendente IA — WhatsApp

MVP de um SaaS de atendimento automatizado via WhatsApp: o lojista conecta o número do WhatsApp do negócio, cadastra o cardápio/serviços e configura um atendente de IA que responde clientes, monta pedidos, confirma pagamento via PIX e escala pra um humano quando necessário.

## Stack

- **Painel**: Next.js 16 (App Router, Turbopack) + React 19 + Tailwind CSS 4 + shadcn/ui, em [`app/`](app/)
- **Banco de dados / Auth**: Supabase (Postgres + Auth + Realtime), schema em [`supabase/schema.sql`](supabase/schema.sql)
- **WhatsApp**: [WAHA](https://waha.devlike.pro/) (WhatsApp HTTP API) rodando via Docker
- **IA**: OpenAI (padrão da plataforma) ou Anthropic/OpenRouter (chave própria do lojista), configurável por tenant

## Arquitetura, em resumo

```
Cliente no WhatsApp
      │
      ▼
    WAHA (Docker) ──── webhook ────▶ Next.js /api/webhooks/waha
      ▲                                        │
      │                                        ▼
      │                          monta contexto (loja + cardápio + histórico)
      │                                        │
      │                                        ▼
      │                                  chama a IA (OpenAI/Anthropic/OpenRouter)
      │                                        │
      │                                        ▼
      └──────── sendText ◀──── decide ação (responder, criar pedido, handoff...)
                                               │
                                               ▼
                                    grava em conversations/messages/orders/ai_logs
```

Cada tenant (lojista) tem sua própria sessão WAHA, configuração de IA e dados isolados por Row Level Security no Supabase. Mais detalhes de arquitetura, decisões e status de desenvolvimento em [`contexto_mvp_saas_whatsapp_ia.md`](contexto_mvp_saas_whatsapp_ia.md) e [`estrutura_mvp_saas_whatsapp_ia.json`](estrutura_mvp_saas_whatsapp_ia.json).

## Como rodar localmente

### 1. Pré-requisitos

- Node.js 20+
- Docker Desktop (pro WAHA)
- Uma conta Supabase (gratuita) com um projeto criado

### 2. Banco de dados (Supabase)

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode todo o conteúdo de [`supabase/schema.sql`](supabase/schema.sql).
3. Em **Authentication → Providers → Email**, desative "Confirm email" durante o desenvolvimento (evita rate limit; reative antes de ir pra produção).
4. Anote a **Project URL** e a **Publishable key** / **Secret key** (Settings → API) — projetos novos do Supabase usam essa nomenclatura, não `anon`/`service_role`.

### 3. WhatsApp (WAHA via Docker)

```bash
cp .env.example .env
# edite o .env com usuário/senha do dashboard e uma WAHA_API_KEY (qualquer string aleatória)
docker compose up -d
```

O WAHA sobe em `http://localhost:3001` (porta escolhida pra não conflitar com o `next dev`, que usa a 3000).

### 4. Painel (Next.js)

```bash
cd app
npm install
cp .env.local.example .env.local   # se existir; senão, veja as variáveis abaixo
npm run dev
```

Variáveis de `app/.env.local`:

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key do Supabase |
| `SUPABASE_SECRET_KEY` | Secret key do Supabase (server-only, nunca expor ao client) |
| `OPENAI_API_KEY` | Chave da OpenAI usada como IA padrão da plataforma |
| `WAHA_BASE_URL` | URL do WAHA (ex.: `http://localhost:3001`) |
| `WAHA_API_KEY` | Mesma chave definida no `.env` da raiz (docker-compose) |
| `WEBHOOK_BASE_URL` | URL onde o WAHA alcança este app. Em dev local com Docker Desktop, `http://host.docker.internal:3000` já funciona sem túnel |
| `WAHA_WEBHOOK_SECRET` | Segredo aleatório pra validar a assinatura HMAC dos webhooks do WAHA |

Depois de rodar, acesse `http://localhost:3000`, crie uma conta, cadastre a loja (Minha Empresa), configure a IA (Configurar IA) e conecte o WhatsApp (tela WhatsApp → escanear QR).

## Estrutura de pastas

```
app/                    # Next.js — painel + rotas de API
  src/app/dashboard/    # Telas do painel (uma pasta por seção)
  src/app/api/          # Rotas de API (sessão WAHA, webhook, importação de cardápio)
  src/lib/              # Clientes Supabase, cliente WAHA, abstração de IA, regras de negócio
supabase/schema.sql      # Schema completo do banco (tabelas, RLS, triggers)
docker-compose.yml       # Sobe o WAHA localmente
contexto_mvp_saas_whatsapp_ia.md   # Contexto de produto, decisões e status detalhado
estrutura_mvp_saas_whatsapp_ia.json # Mesmo status, em formato estruturado
```

## Status

Todas as telas do painel usam dados reais do Supabase; o fluxo de WhatsApp → IA → pedido → pagamento (PIX fixo) já foi testado ponta a ponta. Veja a seção de status mais recente em [`contexto_mvp_saas_whatsapp_ia.md`](contexto_mvp_saas_whatsapp_ia.md) para o que falta antes do piloto real.
