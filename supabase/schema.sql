-- ============================================================
-- MVP SaaS — Atendente IA WhatsApp
-- Schema completo — Supabase Postgres
-- ============================================================

-- Extensão para UUID
create extension if not exists "pgcrypto";

-- ============================================================
-- FUNÇÃO: atualizar updated_at automaticamente
-- ============================================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- TABELA: tenants
-- ============================================================
create table if not exists tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  plan        text not null default 'mvp',
  status      text not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_tenants_updated_at
  before update on tenants
  for each row execute function update_updated_at_column();

-- ============================================================
-- TABELA: users
-- Vincula ao auth.users do Supabase
-- ============================================================
create table if not exists users (
  id          uuid primary key references auth.users(id) on delete cascade,
  tenant_id   uuid not null references tenants(id) on delete cascade,
  email       text not null,
  name        text,
  role        text not null default 'owner',
  created_at  timestamptz not null default now()
);

-- ============================================================
-- TABELA: whatsapp_sessions
-- ============================================================
create table if not exists whatsapp_sessions (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null unique references tenants(id) on delete cascade,
  session_name       text unique not null,
  phone_number       text,
  status             text not null default 'pending',
  -- pending | qr_pending | connected | disconnected | failed
  waha_url           text,
  agent_enabled      boolean not null default false,
  last_connected_at  timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger trg_whatsapp_sessions_updated_at
  before update on whatsapp_sessions
  for each row execute function update_updated_at_column();

-- ============================================================
-- TABELA: store_profiles
-- ============================================================
create table if not exists store_profiles (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null unique references tenants(id) on delete cascade,
  business_type    text not null,
  store_name       text not null,
  address          text,
  opening_hours    jsonb not null default '{}'::jsonb,
  delivery_rules   jsonb not null default '{}'::jsonb,
  payment_methods  jsonb not null default '[]'::jsonb,
  human_contact    text,
  instagram_url    text,
  notes            text,
  mercadopago_access_token  text,
  -- token do Mercado Pago da PRÓPRIA loja (não da plataforma) — cada tenant recebe na sua conta.
  mercadopago_webhook_secret text,
  -- opcional: "Assinatura secreta" do Mercado Pago, pra validar a notificação de pagamento.
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger trg_store_profiles_updated_at
  before update on store_profiles
  for each row execute function update_updated_at_column();

-- ============================================================
-- TABELA: agent_configs
-- ============================================================
create table if not exists agent_configs (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null unique references tenants(id) on delete cascade,
  enabled                 boolean not null default false,
  template_type           text not null default 'generic',
  -- lanchonete | pizzaria | barbearia | clinica | loja | assistencia | imobiliaria | generic
  tone                    text not null default 'friendly',
  -- profissional | amigavel | informal | objetivo | divertido | premium
  system_prompt           text,
  fallback_message        text,
  after_hours_message     text,
  human_handoff_rules     jsonb not null default '[]'::jsonb,
  training_mode           boolean not null default false,
  human_approval_required boolean not null default false,
  after_hours_enabled     boolean not null default true,
  ai_source               text not null default 'platform',
  -- platform (nossa IA, usa OPENAI_API_KEY da plataforma) | custom (IA própria do tenant)
  ai_provider             text,
  -- openai | anthropic | openrouter (só quando ai_source = 'custom')
  ai_model                text,
  ai_api_key              text,
  -- chave do tenant quando ai_source = 'custom'. Nunca é lida de volta para o client.
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger trg_agent_configs_updated_at
  before update on agent_configs
  for each row execute function update_updated_at_column();

-- ============================================================
-- TABELA: menu_items
-- ============================================================
create table if not exists menu_items (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references tenants(id) on delete cascade,
  category                 text not null,
  name                     text not null,
  description              text,
  price                    numeric(10,2),
  extras_json              jsonb not null default '[]'::jsonb,
  available                boolean not null default true,
  preparation_time_minutes integer,
  notes                    text,
  ingredients              jsonb not null default '[]'::jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger trg_menu_items_updated_at
  before update on menu_items
  for each row execute function update_updated_at_column();

-- ============================================================
-- TABELA: conversations
-- ============================================================
create table if not exists conversations (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references tenants(id) on delete cascade,
  whatsapp_session_id  uuid references whatsapp_sessions(id) on delete set null,
  customer_phone       text not null,
  customer_name        text,
  -- customer_phone é o identificador usado pra responder (pode ser um @lid do
  -- WhatsApp, que esconde o número real). customer_phone_display é o número de
  -- telefone de verdade, quando o WAHA consegue resolver o @lid — só pra exibição.
  customer_phone_display text,
  mode                 text not null default 'ai',
  -- ai | human | paused | closed
  status               text not null default 'open',
  -- open | waiting_customer | waiting_store | order_draft | order_confirmed | human_handoff | closed
  summary              text,
  current_order        jsonb not null default '{}'::jsonb,
  last_message_at      timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger trg_conversations_updated_at
  before update on conversations
  for each row execute function update_updated_at_column();

-- ============================================================
-- TABELA: messages
-- ============================================================
create table if not exists messages (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  conversation_id  uuid not null references conversations(id) on delete cascade,
  sender           text not null,
  -- customer | ai | human_agent
  content          text,
  message_type     text not null default 'text',
  raw_payload      jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

-- ============================================================
-- TABELA: orders
-- ============================================================
create table if not exists orders (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  conversation_id  uuid references conversations(id) on delete set null,
  customer_phone   text,
  customer_name    text,
  items            jsonb not null default '[]'::jsonb,
  subtotal         numeric(10,2),
  delivery_fee     numeric(10,2),
  total            numeric(10,2),
  address          text,
  payment_method   text,
  notes            text,
  status           text not null default 'draft',
  -- draft | awaiting_payment | pending_confirmation | confirmed | sent_to_kitchen | preparing | ready | out_for_delivery | completed | cancelled
  mp_payment_id    text,
  -- id do pagamento no Mercado Pago (fluxo de PIX automático)
  pix_copy_paste   text,
  pix_qr_base64    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_orders_mp_payment_id on orders(mp_payment_id) where mp_payment_id is not null;

create trigger trg_orders_updated_at
  before update on orders
  for each row execute function update_updated_at_column();

-- ============================================================
-- TABELA: ai_logs
-- ============================================================
create table if not exists ai_logs (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  conversation_id  uuid references conversations(id) on delete set null,
  model            text,
  prompt_tokens    integer,
  completion_tokens integer,
  input_snapshot   jsonb not null default '{}'::jsonb,
  output_snapshot  jsonb not null default '{}'::jsonb,
  parsed_action    text,
  error            text,
  created_at       timestamptz not null default now()
);

-- ============================================================
-- TABELA: ignored_chats
-- Contatos ou grupos do WhatsApp que a IA nunca deve responder
-- ============================================================
create table if not exists ignored_chats (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  chat_id     text not null,
  -- formato WAHA: {numero}@c.us para contato, {id}@g.us para grupo
  name        text,
  type        text not null default 'contact',
  -- contact | group
  created_at  timestamptz not null default now(),
  unique (tenant_id, chat_id)
);

create index if not exists idx_ignored_chats_tenant_id on ignored_chats(tenant_id);

-- ============================================================
-- TABELA: webhook_events
-- ============================================================
create table if not exists webhook_events (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid references tenants(id) on delete set null,
  source       text not null,
  event_type   text,
  raw_payload  jsonb not null default '{}'::jsonb,
  processed    boolean not null default false,
  error        text,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
create index if not exists idx_users_tenant_id on users(tenant_id);
create index if not exists idx_whatsapp_sessions_tenant_id on whatsapp_sessions(tenant_id);
create index if not exists idx_conversations_tenant_id on conversations(tenant_id);
create index if not exists idx_conversations_customer_phone on conversations(customer_phone);
create index if not exists idx_messages_conversation_id on messages(conversation_id);
create index if not exists idx_messages_tenant_id on messages(tenant_id);
create index if not exists idx_orders_tenant_id on orders(tenant_id);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_ai_logs_conversation_id on ai_logs(conversation_id);
create index if not exists idx_ai_logs_tenant_id on ai_logs(tenant_id);
create index if not exists idx_webhook_events_processed on webhook_events(processed);
create index if not exists idx_menu_items_tenant_id on menu_items(tenant_id);
create index if not exists idx_store_profiles_tenant_id on store_profiles(tenant_id);
create index if not exists idx_agent_configs_tenant_id on agent_configs(tenant_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Garante isolamento por tenant
-- ============================================================

-- Habilitar RLS em todas as tabelas
alter table tenants enable row level security;
alter table users enable row level security;
alter table whatsapp_sessions enable row level security;
alter table store_profiles enable row level security;
alter table agent_configs enable row level security;
alter table menu_items enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table orders enable row level security;
alter table ai_logs enable row level security;
alter table webhook_events enable row level security;
alter table ignored_chats enable row level security;

-- Função auxiliar: retorna o tenant_id do usuário logado
-- search_path fixo: funções security definer chamadas por roles sem "public"
-- no search_path (ex.: GoTrue) não encontram as tabelas sem isso.
create or replace function get_user_tenant_id()
returns uuid
language sql security definer stable
set search_path = public, pg_temp
as $$
  select tenant_id from users where id = auth.uid()
$$;

-- TENANTS: usuário vê somente o seu tenant
create policy "tenants_select_own" on tenants
  for select using (id = get_user_tenant_id());

create policy "tenants_update_own" on tenants
  for update using (id = get_user_tenant_id());

-- USERS: usuário vê somente usuários do seu tenant
create policy "users_select_own_tenant" on users
  for select using (tenant_id = get_user_tenant_id());

create policy "users_update_own" on users
  for update using (id = auth.uid());

-- WHATSAPP_SESSIONS
create policy "whatsapp_sessions_tenant" on whatsapp_sessions
  for all using (tenant_id = get_user_tenant_id());

-- STORE_PROFILES
create policy "store_profiles_tenant" on store_profiles
  for all using (tenant_id = get_user_tenant_id());

-- AGENT_CONFIGS
create policy "agent_configs_tenant" on agent_configs
  for all using (tenant_id = get_user_tenant_id());

-- MENU_ITEMS
create policy "menu_items_tenant" on menu_items
  for all using (tenant_id = get_user_tenant_id());

-- CONVERSATIONS
create policy "conversations_tenant" on conversations
  for all using (tenant_id = get_user_tenant_id());

-- MESSAGES
create policy "messages_tenant" on messages
  for all using (tenant_id = get_user_tenant_id());

-- ORDERS
create policy "orders_tenant" on orders
  for all using (tenant_id = get_user_tenant_id());

-- AI_LOGS
create policy "ai_logs_tenant" on ai_logs
  for all using (tenant_id = get_user_tenant_id());

-- WEBHOOK_EVENTS: somente service_role escreve, usuário lê seu tenant
create policy "webhook_events_tenant_select" on webhook_events
  for select using (tenant_id = get_user_tenant_id());

-- IGNORED_CHATS
create policy "ignored_chats_tenant" on ignored_chats
  for all using (tenant_id = get_user_tenant_id());

-- ============================================================
-- FUNÇÃO: criar tenant + user após registro
-- Chamada pelo trigger on_auth_user_created
-- ============================================================
-- search_path fixo pelo mesmo motivo: o trigger roda com o search_path
-- da role do GoTrue, que não inclui "public" por padrão.
create or replace function handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  new_tenant_id uuid;
  new_slug text;
begin
  -- Gerar slug a partir do email
  new_slug := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9]', '-', 'g'))
              || '-' || substr(gen_random_uuid()::text, 1, 6);

  -- Criar tenant
  insert into tenants (name, slug)
  values (
    coalesce(new.raw_user_meta_data->>'company_name', split_part(new.email, '@', 1)),
    new_slug
  )
  returning id into new_tenant_id;

  -- Criar registro na tabela users
  insert into users (id, tenant_id, email, name, role)
  values (
    new.id,
    new_tenant_id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'owner'
  );

  return new;
end;
$$;

-- Trigger: executar após registro no Supabase Auth
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- REALTIME
-- Tela de Conversas assina mudanças nessas tabelas (postgres_changes)
-- pra atualizar sem precisar dar F5. RLS já filtra por tenant.
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table conversations;
  end if;
end $$;
