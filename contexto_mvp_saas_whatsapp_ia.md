# Contexto do Projeto — MVP SaaS de IA para Atendimento no WhatsApp

## 1. Visão geral

Criar uma aplicação admin em formato SaaS para pequenos negócios configurarem um atendente de IA no WhatsApp.

A proposta é permitir que o dono do negócio conecte o WhatsApp Business dele, preencha informações da empresa, escolha um template de atendimento por segmento, cadastre informações importantes como cardápio, serviços, horários e formas de pagamento, e ative ou desative o atendente IA com um botão.

O primeiro teste real será com uma lanchonete, em escopo bem MVP, usando WAHA + n8n como motor de backend/orquestração, com um painel próprio para o usuário final gerenciar tudo sem precisar acessar n8n.

---

## 2. Objetivo do MVP

Validar rapidamente se um atendente de IA no WhatsApp consegue:

- Reduzir atendimento repetitivo.
- Responder dúvidas básicas.
- Apresentar cardápio ou serviços.
- Montar pedidos simples.
- Confirmar informações antes de finalizar.
- Encaminhar pedido ou solicitação para a equipe humana.
- Permitir que o humano assuma a conversa quando necessário.
- Ser ativado/desativado facilmente pelo dono da loja.

O MVP não precisa ser perfeito. Ele precisa ser testável, vendável em piloto e simples de operar.

---

## 3. Produto desejado

### Nome provisório

`Atendente IA WhatsApp SaaS`

### Tipo de produto

- SaaS multiempresa.
- Futuramente pode virar white label.
- Inicialmente não implementar white label avançado.
- Foco em negócios locais: lanchonete, pizzaria, barbearia, clínica, loja, assistência técnica.

### Usuário principal

Dono ou gestor de pequeno negócio que recebe mensagens pelo WhatsApp e quer automatizar parte do atendimento.

### Primeiro caso real

Lanchonete da tia.

---

## 4. Stack recomendada para o MVP

### Frontend / painel admin

- Next.js
- React
- Tailwind CSS
- shadcn/ui

### Auth e banco

- Supabase Auth
- Supabase Postgres
- Supabase Storage, se precisar salvar arquivos ou cardápios

### Automação / orquestração

- n8n self-hosted

### WhatsApp no MVP

- WAHA

### IA

- OpenAI, Claude ou Gemini
- Inicialmente usar modelo rápido e barato
- Resposta sempre estruturada em JSON

### Infra

- VPS com Docker Compose
- Serviços no mesmo servidor no começo:
  - app web
  - API
  - n8n
  - WAHA
  - Postgres/Supabase externo ou Supabase Cloud

### Logs

- Tabelas no Postgres:
  - messages
  - ai_logs
  - conversations
  - webhook_events

---

## 5. Decisão técnica principal

Usar `n8n + WAHA` para validar o MVP rapidamente.

### Por que WAHA no MVP

- Conexão rápida via QR Code.
- API simples para receber e enviar mensagens.
- Bom para pilotos e validação.
- Permite testar com WhatsApp Business real da loja.

### Ressalva importante

WAHA não é a integração oficial da Meta. Para SaaS em escala, clientes maiores ou operação mais segura, planejar migração futura para:

- WhatsApp Business Platform
- Cloud API oficial da Meta
- BSP oficial

### Decisão de produto

- MVP: WAHA
- Produção escalável: Cloud API / BSP oficial

---

## 6. Arquitetura geral

```text
Cliente final no WhatsApp
        ↓
WhatsApp da loja conectado no WAHA
        ↓
WAHA envia webhook
        ↓
n8n recebe evento
        ↓
n8n consulta banco/Supabase
        ↓
n8n verifica regras:
  - IA ativa?
  - horário de funcionamento?
  - conversa em modo humano?
  - cliente bloqueado?
  - segmento/template?
        ↓
n8n monta contexto
        ↓
n8n chama IA
        ↓
IA retorna JSON estruturado
        ↓
n8n valida a resposta
        ↓
n8n envia resposta via WAHA
        ↓
n8n salva mensagens, logs e estado da conversa
        ↓
Painel admin mostra histórico e status
```

---

## 7. Painel admin — telas do MVP

### 7.1 Login

Funcionalidades:

- Login com e-mail/senha.
- Registro simples.
- Recuperação de senha pode ficar para depois, se quiser simplificar.

Rotas sugeridas:

```text
/login
/register
/dashboard
```

---

### 7.2 Dashboard

Mostrar visão geral:

- WhatsApp conectado ou desconectado.
- Status do atendente IA: ativo/inativo.
- Conversas abertas.
- Conversas em modo humano.
- Pedidos gerados hoje.
- Últimas mensagens.
- Alertas de erro.

Cards sugeridos:

```text
Atendente IA: Ativo
WhatsApp: Conectado
Conversas hoje: 34
Pedidos confirmados: 8
Handoffs humanos: 3
Erros da IA: 0
```

---

### 7.3 Minha empresa

Campos do negócio:

```text
Nome da loja
Segmento
Endereço
Horário de funcionamento
Telefone humano para suporte
Instagram
Formas de pagamento
Retirada no local: sim/não
Entrega: sim/não
Bairros atendidos
Taxa de entrega padrão
Tempo médio de preparo
Observações internas
```

Para lanchonete, campos importantes:

```text
Horários
Cardápio
Taxa de entrega
Bairros atendidos
Tempo médio de entrega/preparo
Chave Pix
Formas de pagamento
Mensagem de pedido mínimo, se houver
```

---

### 7.4 Conectar WhatsApp

Fluxo esperado:

```text
1. Usuário clica em "Conectar WhatsApp".
2. Backend cria uma sessão no WAHA.
3. Painel exibe QR Code.
4. Usuário escaneia com WhatsApp Business.
5. Sistema salva status como connected.
6. Painel mostra o número conectado.
```

Dados salvos:

```text
tenant_id
session_name
phone_number
status
waha_url
created_at
updated_at
```

Status possíveis:

```text
pending
qr_pending
connected
disconnected
failed
```

---

### 7.5 Configurar IA

Campos principais:

```text
Segmento do negócio
Template de prompt
Tom de voz
Mensagem inicial
Mensagem fora do horário
Regras de atendimento
Quando chamar humano
Limites da IA
Atendente ativo/inativo
Modo treinamento
Exigir aprovação antes de fechar pedido
```

Tons sugeridos:

```text
Profissional
Amigável
Informal
Objetivo
Divertido
Premium
```

Templates iniciais:

```text
Lanchonete
Pizzaria
Barbearia
Clínica estética
Loja de roupa
Assistência técnica
Imobiliária
Genérico
```

---

### 7.6 Cardápio / base de conhecimento

Para o MVP, cadastrar manualmente os dados. Evitar RAG complexo no primeiro corte.

Campos para produtos:

```text
Categoria
Nome do produto
Descrição
Preço
Adicionais
Disponível
Tempo de preparo opcional
Observações
Imagem opcional
```

Exemplo:

```text
Categoria: Lanches
Produto: X-Bacon
Descrição: pão, hambúrguer, queijo, bacon, alface e tomate
Preço: 24.90
Adicionais: ovo, cheddar, bacon extra
Disponível: sim
```

Depois do MVP, evoluir para:

- Upload de PDF.
- Upload de imagem do cardápio.
- Importação por planilha.
- Busca semântica/RAG.
- Controle de estoque.
- Itens indisponíveis por horário.

---

### 7.7 Ativar/desativar atendente IA

Botão central:

```text
[ Atendente IA ativo ]
```

Flags importantes:

```text
agent_enabled
training_mode
human_approval_required
after_hours_enabled
```

Comportamento:

- Se `agent_enabled = false`, não responder automaticamente.
- Se `training_mode = true`, gerar sugestão de resposta mas não enviar.
- Se `human_approval_required = true`, pedir aprovação antes de confirmar pedido.
- Se conversa estiver em `mode = human`, a IA não responde.

---

### 7.8 Conversas

Tela com lista de conversas:

```text
Cliente
Telefone
Última mensagem
Status
Modo: IA ou Humano
Resumo
Última atividade
Botão: assumir conversa
Botão: devolver para IA
```

Status possíveis:

```text
open
waiting_customer
waiting_store
order_draft
order_confirmed
human_handoff
closed
```

Ações:

```text
Assumir conversa
Devolver para IA
Enviar mensagem manual
Ver resumo
Ver logs da IA
Encerrar conversa
Marcar como importante
```

---

### 7.9 Pedidos

Para lanchonete, criar tela simples de pedidos.

Campos:

```text
Cliente
Telefone
Itens
Total
Endereço
Forma de pagamento
Observações
Status
Criado em
```

Status de pedido:

```text
draft
pending_confirmation
confirmed
sent_to_kitchen
preparing
ready
out_for_delivery
completed
cancelled
```

No MVP, pode começar só com:

```text
confirmed
cancelled
completed
```

---

### 7.10 Logs

Tela técnica/admin para você acompanhar:

```text
Evento
Tenant
Conversa
Mensagem recebida
Prompt enviado
Resposta da IA
JSON parseado
Erro
Tokens
Modelo
Data
```

Isso é importante para depurar erros.

---

## 8. Escopo do MVP

### Fazer agora

- Login.
- Cadastro da empresa.
- Conectar WhatsApp via WAHA.
- Criar sessão e mostrar QR Code.
- Cadastrar cardápio manual.
- Configurar IA com template.
- Ativar/desativar IA.
- Receber mensagem do WhatsApp.
- Gerar resposta por IA.
- Enviar resposta pelo WAHA.
- Salvar histórico.
- Mostrar conversas no painel.
- Permitir assumir conversa manualmente.
- Gerar resumo de pedido.
- Notificar equipe da loja quando pedido for confirmado.

### Não fazer agora

- Billing/assinatura.
- White label.
- Integração com iFood.
- Pagamento automático.
- Disparo de campanha.
- CRM completo.
- Multiatendente avançado.
- Upload inteligente de PDF.
- App mobile.
- Analytics sofisticado.
- Autenticação social.
- Controle avançado de estoque.
- Integração com impressora.

---

## 9. Modelo de dados MVP

### 9.1 tenants

```sql
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text default 'mvp',
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 9.2 users

```sql
create table users (
  id uuid primary key,
  tenant_id uuid references tenants(id) on delete cascade,
  email text not null,
  name text,
  role text default 'owner',
  created_at timestamptz default now()
);
```

### 9.3 whatsapp_sessions

```sql
create table whatsapp_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  session_name text unique not null,
  phone_number text,
  status text default 'pending',
  waha_url text,
  agent_enabled boolean default false,
  last_connected_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 9.4 store_profiles

```sql
create table store_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  business_type text not null,
  store_name text not null,
  address text,
  opening_hours jsonb default '{}'::jsonb,
  delivery_rules jsonb default '{}'::jsonb,
  payment_methods jsonb default '[]'::jsonb,
  human_contact text,
  instagram_url text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 9.5 agent_configs

```sql
create table agent_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  template_type text default 'generic',
  tone text default 'friendly',
  system_prompt text,
  fallback_message text,
  after_hours_message text,
  human_handoff_rules jsonb default '[]'::jsonb,
  training_mode boolean default false,
  human_approval_required boolean default false,
  after_hours_enabled boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 9.6 menu_items

```sql
create table menu_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  category text not null,
  name text not null,
  description text,
  price numeric(10,2),
  extras_json jsonb default '[]'::jsonb,
  available boolean default true,
  preparation_time_minutes integer,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 9.7 conversations

```sql
create table conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  whatsapp_session_id uuid references whatsapp_sessions(id) on delete cascade,
  customer_phone text not null,
  customer_name text,
  mode text default 'ai',
  status text default 'open',
  summary text,
  current_order jsonb default '{}'::jsonb,
  last_message_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 9.8 messages

```sql
create table messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete cascade,
  sender text not null,
  content text,
  message_type text default 'text',
  raw_payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
```

### 9.9 orders

```sql
create table orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  customer_phone text,
  customer_name text,
  items jsonb default '[]'::jsonb,
  subtotal numeric(10,2),
  delivery_fee numeric(10,2),
  total numeric(10,2),
  address text,
  payment_method text,
  notes text,
  status text default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 9.10 ai_logs

```sql
create table ai_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete cascade,
  model text,
  prompt_tokens integer,
  completion_tokens integer,
  input_snapshot jsonb default '{}'::jsonb,
  output_snapshot jsonb default '{}'::jsonb,
  parsed_action text,
  error text,
  created_at timestamptz default now()
);
```

### 9.11 webhook_events

```sql
create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  source text not null,
  event_type text,
  raw_payload jsonb default '{}'::jsonb,
  processed boolean default false,
  error text,
  created_at timestamptz default now()
);
```

---

## 10. API mínima

### Auth

Usar Supabase Auth no MVP.

### Endpoints internos sugeridos

```text
POST /api/whatsapp/session/create
GET  /api/whatsapp/session/:id/status
GET  /api/whatsapp/session/:id/qr
POST /api/whatsapp/session/:id/disconnect

GET  /api/store/profile
PUT  /api/store/profile

GET  /api/menu/items
POST /api/menu/items
PUT  /api/menu/items/:id
DELETE /api/menu/items/:id

GET  /api/agent/config
PUT  /api/agent/config
POST /api/agent/toggle

GET  /api/conversations
GET  /api/conversations/:id
POST /api/conversations/:id/takeover
POST /api/conversations/:id/release
POST /api/conversations/:id/send-message

GET  /api/orders
GET  /api/orders/:id
PUT  /api/orders/:id/status

GET  /api/logs/ai
```

### Webhook para o WAHA

```text
POST /api/webhooks/waha
```

Ou, no MVP, o WAHA pode apontar direto para um webhook do n8n:

```text
POST https://n8n.seudominio.com/webhook/waha-incoming
```

---

## 11. Workflows n8n

### 11.1 Workflow principal — mensagem recebida

Nome:

```text
waha_incoming_message_handler
```

Passos:

```text
1. Webhook recebe evento do WAHA.
2. Extrai session_name, telefone do cliente, nome e texto.
3. Salva webhook bruto em webhook_events.
4. Busca whatsapp_session pelo session_name.
5. Busca tenant.
6. Busca store_profile.
7. Busca agent_config.
8. Busca ou cria conversation.
9. Salva mensagem recebida em messages.
10. Verifica agent_enabled.
11. Verifica se conversation.mode = human.
12. Verifica horário de atendimento.
13. Busca últimas N mensagens.
14. Busca cardápio/serviços disponíveis.
15. Monta prompt.
16. Chama IA.
17. Parseia JSON.
18. Valida action.
19. Se needs_human = true, muda conversa para human_handoff.
20. Se action = confirm_order, cria order.
21. Se action = reply, envia mensagem via WAHA.
22. Salva resposta em messages.
23. Salva ai_log.
```

---

### 11.2 Workflow — pedido confirmado

Nome:

```text
order_confirmed_notify_team
```

Passos:

```text
1. Recebe evento interno de pedido confirmado.
2. Formata resumo do pedido.
3. Envia para WhatsApp interno/grupo/equipe.
4. Salva status como confirmed ou sent_to_kitchen.
```

Mensagem de exemplo:

```text
NOVO PEDIDO VIA IA

Cliente: {{customer_name}}
Telefone: {{customer_phone}}

Itens:
{{items}}

Entrega:
{{address}}

Pagamento:
{{payment_method}}

Total:
R$ {{total}}

Observações:
{{notes}}
```

---

### 11.3 Workflow — handoff humano

Nome:

```text
human_handoff_handler
```

Passos:

```text
1. Recebe evento de handoff.
2. Atualiza conversation.mode = human.
3. Atualiza conversation.status = human_handoff.
4. Notifica dono/equipe.
5. IA para de responder até alguém clicar em "devolver para IA".
```

---

### 11.4 Workflow — mensagem fora do horário

Nome:

```text
after_hours_reply
```

Passos:

```text
1. Verifica horário da loja.
2. Se loja está fechada e after_hours_enabled = true:
   - Envia mensagem de fora do horário.
   - Pode coletar pedido para o próximo horário, se configurado.
3. Se after_hours_enabled = false:
   - Não responde.
```

---

## 12. Agente de IA

### 12.1 Princípio

A IA nunca deve responder texto livre sem estrutura.

Ela deve retornar sempre JSON válido com uma ação clara.

### 12.2 Ações permitidas

```text
reply
ask_clarification
send_menu
create_order_draft
confirm_order
handoff_to_human
out_of_hours_reply
ignore
```

### 12.3 Schema de resposta da IA

```json
{
  "action": "reply",
  "reply": "Mensagem que será enviada ao cliente.",
  "confidence": 0.92,
  "needs_human": false,
  "reason": "Motivo resumido da decisão.",
  "order_state": {
    "items": [
      {
        "name": "X-Bacon",
        "quantity": 1,
        "unit_price": 24.9,
        "notes": "sem tomate"
      }
    ],
    "subtotal": 24.9,
    "delivery_fee": 5,
    "total": 29.9,
    "address": null,
    "payment_method": null,
    "missing_fields": ["address", "payment_method"]
  },
  "handoff": {
    "required": false,
    "reason": null
  }
}
```

### 12.4 Regras rígidas da IA

- Não inventar produto.
- Não inventar preço.
- Não inventar horário.
- Não inventar taxa de entrega.
- Não prometer prazo exato se a loja não informou.
- Não finalizar pedido sem confirmação explícita do cliente.
- Não continuar se o cliente pedir humano.
- Não discutir com cliente.
- Não responder reclamação grave sozinho.
- Não calcular total usando itens indisponíveis.
- Não vender item indisponível.
- Sempre perguntar campos faltantes.
- Se a informação não estiver no contexto, dizer que vai chamar alguém ou pedir clarificação.

---

## 13. Prompt base — lanchonete

```text
Você é o atendente virtual da {{store_name}}.

Objetivo:
Atender clientes pelo WhatsApp, responder dúvidas, apresentar o cardápio,
montar pedidos e encaminhar pedidos confirmados para a equipe.

Dados disponíveis:
- Informações da loja
- Horário de funcionamento
- Formas de pagamento
- Regras de entrega
- Cardápio cadastrado
- Últimas mensagens da conversa

Regras obrigatórias:
- Use apenas as informações fornecidas no contexto.
- Nunca invente preço, produto, promoção, horário ou taxa de entrega.
- Se uma informação não existir, pergunte ou acione handoff humano.
- Seja educado, direto e natural.
- Não fale que é uma IA, a menos que o cliente pergunte.
- Se o cliente pedir atendente humano, acione handoff.
- Se houver reclamação, erro no pedido, reembolso, irritação ou xingamento, acione handoff.
- Antes de confirmar pedido, colete:
  1. itens
  2. quantidades
  3. endereço ou retirada
  4. forma de pagamento
  5. confirmação final do cliente
- Não confirme pedido sem o cliente dizer claramente que confirma.
- Sempre responda em JSON válido.

Ações permitidas:
- reply
- ask_clarification
- send_menu
- create_order_draft
- confirm_order
- handoff_to_human
- out_of_hours_reply
- ignore

Formato obrigatório:
{
  "action": "...",
  "reply": "...",
  "confidence": 0.0,
  "needs_human": false,
  "reason": "...",
  "order_state": {
    "items": [],
    "subtotal": null,
    "delivery_fee": null,
    "total": null,
    "address": null,
    "payment_method": null,
    "missing_fields": []
  },
  "handoff": {
    "required": false,
    "reason": null
  }
}
```

---

## 14. Prompt base — barbearia

```text
Você é o atendente virtual da {{store_name}}, uma barbearia.

Objetivo:
Responder dúvidas, apresentar serviços, informar preços e horários,
coletar dados para agendamento e chamar humano quando necessário.

Regras:
- Use apenas os serviços, preços e horários cadastrados.
- Não invente disponibilidade de agenda.
- Se o cliente quiser marcar horário e não houver integração de agenda,
  colete nome, serviço desejado, dia e período preferido.
- Depois, encaminhe para confirmação humana.
- Se o cliente pedir humano, reclame ou tente negociar algo fora das regras,
  acione handoff.
- Responda sempre em JSON válido.
```

---

## 15. Prompt base — pizzaria

```text
Você é o atendente virtual da {{store_name}}, uma pizzaria.

Objetivo:
Apresentar sabores, tamanhos, preços, bordas, bebidas, promoções cadastradas
e montar pedidos de delivery ou retirada.

Regras:
- Não invente sabor, preço, promoção ou taxa.
- Confirme tamanho da pizza, sabores, borda, bebidas, endereço e pagamento.
- Se a pizza puder ser meio a meio, use somente sabores cadastrados.
- Não confirme pedido sem confirmação final do cliente.
- Se houver dúvida fora do contexto, acione humano.
- Responda sempre em JSON válido.
```

---

## 16. Exemplo de contexto enviado para IA

```json
{
  "store": {
    "name": "Lanchonete da Tia",
    "business_type": "lanchonete",
    "opening_hours": {
      "monday": "18:00-23:00",
      "tuesday": "18:00-23:00",
      "wednesday": "18:00-23:00",
      "thursday": "18:00-23:00",
      "friday": "18:00-00:00",
      "saturday": "18:00-00:00",
      "sunday": "closed"
    },
    "payment_methods": ["pix", "cartao", "dinheiro"],
    "delivery_rules": {
      "enabled": true,
      "default_fee": 5,
      "areas": ["Centro", "Jardim", "Vila Nova"]
    }
  },
  "menu_items": [
    {
      "category": "Lanches",
      "name": "X-Bacon",
      "description": "pão, hambúrguer, queijo, bacon, alface e tomate",
      "price": 24.9,
      "available": true
    }
  ],
  "conversation": {
    "customer_phone": "+5511999999999",
    "last_messages": [
      {
        "sender": "customer",
        "content": "tem x-bacon?"
      }
    ]
  }
}
```

---

## 17. Exemplo de resposta da IA

```json
{
  "action": "reply",
  "reply": "Temos sim! O X-Bacon sai por R$ 24,90 e acompanha pão, hambúrguer, queijo, bacon, alface e tomate. Você quer pedir um?",
  "confidence": 0.95,
  "needs_human": false,
  "reason": "Cliente perguntou sobre item disponível no cardápio.",
  "order_state": {
    "items": [],
    "subtotal": null,
    "delivery_fee": null,
    "total": null,
    "address": null,
    "payment_method": null,
    "missing_fields": []
  },
  "handoff": {
    "required": false,
    "reason": null
  }
}
```

---

## 18. Regras de handoff humano

Acionar humano quando:

```text
Cliente pedir atendente humano
Cliente reclamar
Cliente xingar
Cliente pedir reembolso
Cliente falar que pedido veio errado
Cliente quiser cancelar pedido confirmado
Cliente fizer pergunta sem informação no contexto
Cliente pedir desconto não cadastrado
Cliente pedir item indisponível e insistir
IA tiver baixa confiança
Erro ao calcular total
Erro ao enviar mensagem
```

Limiar sugerido:

```text
confidence < 0.70 => handoff ou ask_clarification
```

---

## 19. Estados da conversa

```text
ai
human
paused
closed
```

Descrição:

```text
ai:
  IA pode responder.

human:
  humano assumiu; IA não responde.

paused:
  conversa pausada temporariamente.

closed:
  conversa encerrada.
```

---

## 20. Estados do pedido

```text
draft:
  pedido em montagem.

pending_confirmation:
  IA já montou o resumo e pediu confirmação.

confirmed:
  cliente confirmou.

sent_to_kitchen:
  pedido enviado para equipe.

preparing:
  pedido em preparo.

completed:
  pedido concluído.

cancelled:
  pedido cancelado.
```

---

## 21. Cenários de teste com a lanchonete

### Cenário 1 — pergunta de cardápio

Cliente:

```text
Tem x-bacon?
```

Esperado:

```text
IA responde se há X-Bacon, preço e breve descrição.
```

---

### Cenário 2 — montar pedido

Cliente:

```text
Quero 2 x-bacon e uma coca.
```

Esperado:

```text
IA identifica itens, calcula subtotal se todos existirem,
pergunta endereço ou retirada e forma de pagamento.
```

---

### Cenário 3 — item inexistente

Cliente:

```text
Tem sushi?
```

Esperado:

```text
IA não inventa.
IA diz que não encontrou esse item no cardápio e oferece opções disponíveis.
```

---

### Cenário 4 — reclamação

Cliente:

```text
Meu pedido veio errado.
```

Esperado:

```text
IA pede desculpas e aciona humano.
```

---

### Cenário 5 — fora do horário

Cliente:

```text
Boa noite, está aberto?
```

Esperado:

```text
IA verifica horário.
Se fechado, informa horário de funcionamento.
```

---

### Cenário 6 — confirmação de pedido

Cliente:

```text
Pode confirmar.
```

Esperado:

```text
IA confirma somente se itens, endereço/retirada e pagamento estiverem preenchidos.
Se faltar algo, pergunta antes.
```

---

## 22. Checklist de desenvolvimento

### Etapa 1 — Base do projeto

```text
Criar monorepo ou app único
Configurar Next.js
Configurar Tailwind/shadcn
Configurar Supabase
Criar autenticação
Criar layout do painel
```

### Etapa 2 — Banco

```text
Criar tabelas
Configurar RLS básica por tenant
Criar seeds de teste
Criar tenant da lanchonete
Criar produtos de exemplo
```

### Etapa 3 — WAHA

```text
Subir WAHA em Docker
Criar endpoint de sessão
Criar QR Code no painel
Salvar status da sessão
Testar envio manual de mensagem
Testar recebimento via webhook
```

### Etapa 4 — n8n

```text
Subir n8n
Criar workflow waha_incoming_message_handler
Conectar n8n ao Supabase/Postgres
Conectar n8n ao WAHA
Conectar n8n ao provedor de IA
Salvar logs
```

### Etapa 5 — IA

```text
Criar prompt base de lanchonete
Forçar JSON na resposta
Validar JSON antes de enviar
Criar fallback se JSON quebrar
Criar handoff por baixa confiança
```

### Etapa 6 — Painel

```text
Tela dashboard
Tela empresa
Tela WhatsApp
Tela IA
Tela cardápio
Tela conversas
Tela pedidos
Tela logs simples
```

### Etapa 7 — Piloto

```text
Cadastrar lanchonete da tia
Conectar WhatsApp
Cadastrar cardápio real
Ativar modo treinamento por 1 dia
Revisar logs
Ativar resposta automática
Medir erros
Ajustar prompt
```

---

## 23. Critérios de sucesso do piloto

O piloto é válido se:

```text
A IA responde corretamente 80%+ das perguntas simples.
A loja entende os pedidos enviados.
O humano consegue assumir conversa facilmente.
A IA não inventa preço.
A IA não confirma pedido incompleto.
A taxa de erro grave é baixa.
O dono da loja percebe economia de tempo.
```

Métricas simples:

```text
Total de conversas
Total de respostas da IA
Total de pedidos gerados
Total de handoffs
Total de erros
Tempo médio até primeira resposta
Percentual de conversas resolvidas sem humano
```

---

## 24. Roadmap pós-MVP

### V1

```text
Assinatura/billing
Planos por número de mensagens
Multiusuário por loja
Melhor tela de conversas
Upload de cardápio por planilha
Templates por segmento
Dashboard de métricas
```

### V2

```text
WhatsApp Cloud API oficial
Integração com agenda
Integração com delivery
Integração com pagamento
Campanhas com opt-in
RAG com base de conhecimento
White label para agências
```

### V3

```text
Marketplace de templates
Múltiplos canais
Instagram DM
Messenger
Website chat
CRM simples
Automações pós-venda
Reativação de clientes com consentimento
```

---

## 25. Prompt para usar com Claude Code / Antigravity

Use este bloco como instrução para o agente de desenvolvimento:

```text
Você está desenvolvendo um MVP SaaS de atendimento com IA para WhatsApp.

Objetivo:
Criar uma aplicação admin onde pequenos negócios conectam o WhatsApp,
configuram um atendente de IA, cadastram dados da loja e ativam/desativam
respostas automáticas.

Stack:
- Next.js
- Tailwind
- shadcn/ui
- Supabase Auth
- Supabase Postgres
- n8n
- WAHA
- OpenAI/Claude/Gemini
- Docker Compose

Primeiro caso:
Lanchonete.

Prioridade:
Construir rápido um MVP funcional, não uma plataforma perfeita.

Escopo obrigatório:
- Login
- Cadastro de empresa
- Conectar WhatsApp via QR Code do WAHA
- Configuração do agente IA
- Cadastro manual de cardápio
- Botão ativar/desativar IA
- Webhook de mensagem recebida
- Workflow n8n para responder
- Histórico de conversas
- Handoff humano
- Pedidos confirmados
- Logs da IA

Regras:
- Nunca expor n8n para o usuário final.
- O painel deve falar com uma API própria.
- n8n fica como motor de workflow.
- WAHA é a camada de WhatsApp no MVP.
- IA deve responder sempre em JSON válido.
- Não confirmar pedido sem dados obrigatórios.
- Não inventar preços, produtos ou horários.
- Implementar isolamento por tenant desde o começo.

Entregue código limpo, simples e evolutivo.
Evite overengineering.
```

---

## 26. Decisão final

Construir o MVP com:

```text
Next.js + Supabase + n8n + WAHA + IA
```

Primeiro objetivo:

```text
Fazer a lanchonete da tia operar com um atendente IA básico no WhatsApp.
```

Corte exato do primeiro lançamento:

```text
Conectar WhatsApp
Cadastrar loja
Cadastrar cardápio
Escolher template lanchonete
Ativar IA
Receber/responder mensagens
Montar pedido
Pedir confirmação
Enviar pedido para equipe
Permitir humano assumir
Salvar histórico/logs
```

Isso é suficiente para lançar, testar, aprender e decidir se vale transformar em SaaS completo.

---

## 27. Status atual do desenvolvimento (atualizado em 2026-07-04)

### 27.1 Feito

```text
Etapa 1 — Base do projeto: CONCLUÍDA
  - Next.js 16 (Turbopack) + Tailwind + shadcn/ui rodando em app/
  - Layout do painel (Sidebar, Header) e todas as 8 telas do dashboard
    (dashboard, empresa, whatsapp, ia, cardápio, conversas, pedidos, logs)
    já construídas visualmente
  - Login e registro com Supabase Auth real (não mock), com middleware
    protegendo rotas autenticadas

Etapa 2 — Banco: CONCLUÍDA
  - Projeto Supabase Cloud real conectado (não é instância local)
  - schema.sql aplicado: 11 tabelas, índices, RLS por tenant, trigger
    handle_new_user (cria tenant + user automaticamente no signup)
  - Fluxo de cadastro testado ponta a ponta e validado
```

### 27.2 Decisões/ajustes tomados durante o setup

```text
- Este projeto Supabase usa o novo formato de chaves: publishable key /
  secret key (em vez de anon key / service_role key). O código em
  app/src/lib/supabase/*.ts e app/src/middleware.ts usa
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. A secret key fica em
  SUPABASE_SECRET_KEY (só para uso server-side, ex. futuro webhook).

- Bug corrigido no schema: funções SECURITY DEFINER (handle_new_user,
  get_user_tenant_id) precisam de "set search_path = public, pg_temp"
  explícito. Sem isso, o trigger em auth.users falha com
  "relation does not exist", porque a role do GoTrue não tem "public"
  no search_path por padrão. Já corrigido em supabase/schema.sql.

- Em desenvolvimento, a confirmação de e-mail está DESATIVADA no
  Supabase (Authentication > Email Provider > "Confirm email" off),
  para evitar o rate limit de e-mail do plano gratuito durante testes.
  Reativar antes do piloto real com a lanchonete, e nesse ponto
  configurar SMTP próprio.
```

### 27.3 Faltando

```text
Etapa 3 — WAHA: NÃO INICIADA
  - Nenhum docker-compose, nenhuma sessão real, tela de WhatsApp
    hoje só simula QR code e conexão (mock)

Etapa 4 — n8n: NÃO INICIADA
  - Nenhum workflow criado

Etapa 5 — IA: NÃO INICIADA
  - Nenhuma chamada real a LLM

Etapa 6 — Painel: PARCIAL
  - Todas as telas existem visualmente, mas Empresa, IA, Cardápio,
    Conversas, Pedidos e Logs ainda usam dados mockados (useState local,
    setTimeout fake) em vez de ler/gravar no Supabase
  - Não existem rotas /api no Next.js ainda (seção 10 do contexto)

Etapa 7 — Piloto: NÃO INICIADA
```

### 27.4 Próximo passo sugerido

```text
Trocar os dados mockados das telas do dashboard por leitura/escrita
real no Supabase, começando por Minha Empresa e Configurar IA
(agent_configs e store_profiles), já que são a base para os workflows
de IA depois.
```

---

## 28. Status atual do desenvolvimento (atualizado em 2026-07-04, sessão 2)

### 28.1 Feito nesta sessão

```text
- Minha Empresa (store_profiles) e Configurar IA (agent_configs) agora
  leem e gravam dados reais no Supabase (Server Components para leitura,
  Server Actions para salvar — app/src/app/dashboard/store/ e agent/).
  Ambas as telas persistem por tenant via upsert (onConflict: tenant_id).

- Coluna nova `enabled` (boolean) adicionada em agent_configs para
  guardar o toggle "Atendente IA" ligado/desligado.

- Corrigido bug real de arquitetura: Header.tsx era um Server Component
  assíncrono (usava next/headers) mas era renderizado direto dentro de
  componentes client — quebrava o build ao abrir as telas autenticadas.
  Header agora é client-safe e recebe o e-mail do usuário via prop.

- Tela de Pedidos (ainda com dados mock) redesenhada como Kanban por
  etapa (Confirmado → Preparando → Pronto → Saiu para entrega →
  Concluído → Cancelado), com busca por cliente/nº do pedido e uma
  janela (dialog) com os detalhes completos do pedido.

- Repaginação visual completa do frontend (app/src/app/globals.css):
  - Corrigido bug sistêmico de CSS: quase todo token de cor estava
    definido como `hsl(var(--x))` envolvendo um valor `oklch(...)`,
    o que é uma função CSS inválida — a declaração era descartada e o
    navegador caía no valor herdado. Isso deixava, por exemplo, o texto
    da sidebar (fundo escuro fixo) invisível. Corrigido em todo o
    arquivo (tokens do @theme, borda global, scrollbar, glow, glass-card).
  - Corrigido bug de fonte: `--font-sans` referenciava a si mesmo
    (`var(--font-sans)`), então a fonte Inter carregada via next/font
    nunca era realmente aplicada. Agora aponta para `var(--font-inter)`.
  - Nova cor de marca: azul/indigo (oklch ~0.51/0.585 hue 277) para
    primary/ring/accent, tanto no tema claro quanto no escuro.
  - Tema claro/escuro real implementado com next-themes (já era
    dependência do projeto, só não estava conectado):
    `src/components/theme-provider.tsx` + `<ThemeProvider>` no
    `app/src/app/layout.tsx` (antes o `<html>` tinha `className="dark"`
    fixo). Botão de alternância (sol/lua) no Header, em todas as telas
    do dashboard.
  - Decisão de design: a sidebar continua SEMPRE escura (navy fixo),
    independente do tema escolhido — é a mesma sidebar dark de sempre,
    só o conteúdo principal (fundo, texto, cards) alterna claro/escuro.
    Por isso a cor de destaque do item ativo/logo da sidebar usa o
    token próprio `sidebar-primary` (fixo) em vez do `primary` global
    (que muda com o tema).
```

### 28.2 Ainda mockado / faltando (sem mudança nesta sessão)

```text
- Cardápio/Base, Conversas, Logs da IA: telas ainda com dados mockados,
  sem leitura/escrita real no Supabase.
- Pedidos: virou Kanban visualmente, mas os dados ainda são mock
  (MOCK_ORDERS local) — falta ligar na tabela `orders`.
- Etapa 3 (WAHA), Etapa 4 (n8n), Etapa 5 (IA real) e Etapa 7 (Piloto):
  não iniciadas.
- Não existem rotas /api no Next.js ainda.
```

### 28.3 Próximo passo combinado com o usuário

```text
Seguir para a conexão real de WhatsApp (WAHA) e a integração de IA
de fato (Etapas 3 e 5 do checklist original, seção 7 do contexto).
```

---

## 29. Status atual do desenvolvimento (atualizado em 2026-07-04, sessão 3)

### 29.1 Feito nesta sessão — conexão WhatsApp (WAHA) + IA real

```text
Decisão de arquitetura: a orquestração descrita nas seções 11/12 (que
previa n8n) foi implementada direto como rotas do Next.js, já que o
n8n nunca chegou a ser montado neste projeto. O contrato de JSON da
IA (seção 12.3) e as regras de handoff/pedido foram seguidos à risca.

- schema.sql:
  - agent_configs ganhou ai_source ('platform' | 'custom'), ai_provider
    (openai | anthropic | openrouter), ai_model e ai_api_key (chave do
    tenant, só usada quando ai_source = 'custom').
  - Nova tabela ignored_chats (tenant_id, chat_id, name, type
    contact|group) com RLS por tenant — contatos/grupos que a IA nunca
    responde.
  - whatsapp_sessions ganhou unique(tenant_id) (mesmo padrão singleton
    de store_profiles/agent_configs — uma sessão WAHA por tenant).

- app/src/lib/waha.ts: cliente REST do WAHA (startSession, status,
  QR em base64, stop/logout, sendText), autenticado via header
  X-Api-Key. Nome de sessão determinístico: `tenant_<tenantId sem hifens>`.

- app/src/lib/supabase/service.ts: client service-role (bypassa RLS),
  usado só no webhook do WAHA, que não tem sessão de usuário.

- app/src/lib/ai.ts: abstração de IA com 3 provedores (OpenAI,
  Anthropic, OpenRouter) atrás de uma função callAi() só. "IA da
  plataforma" = OpenAI usando OPENAI_API_KEY do servidor. "IA própria"
  = usa provider/model/api_key salvos em agent_configs.

- app/src/lib/business-hours.ts: confere store_profiles.opening_hours
  (fuso America/Sao_Paulo) pra decidir se a loja está aberta antes de
  chamar a IA.

- Rotas novas (app/src/app/api/):
  - POST/GET /api/whatsapp/session — cria/inicia sessão no WAHA e
    consulta status, grava em whatsapp_sessions.
  - GET /api/whatsapp/session/qr — QR code em base64.
  - POST /api/whatsapp/session/disconnect — logout + stop no WAHA.
  - POST /api/webhooks/waha — recebe mensagens do WAHA (valida HMAC
    sha512 do corpo bruto com WAHA_WEBHOOK_SECRET), e faz o fluxo
    completo: ignora mensagens próprias e de contatos/grupos da lista
    de ignorados → se IA desligada, não responde → se fora do horário,
    manda after_hours_message (sem chamar IA) → acha/cria conversation
    → salva mensagem do cliente → se conversation.mode = human, não
    responde → monta contexto (loja + cardápio + histórico) → chama a
    IA → parseia o JSON de resposta (schema da seção 12.3) → executa a
    ação (handoff_to_human muda a conversa pra mode=human; confirm_order
    cria linha em orders; create_order_draft atualiza
    conversation.current_order) → envia a resposta via WAHA (sendText)
    → grava em messages e ai_logs.

- Tela WhatsApp (app/src/app/dashboard/whatsapp/) reescrita: Server
  Component busca a sessão + lista de ignorados reais do Supabase;
  client component (whatsapp-client.tsx) chama as rotas /api reais
  (nada de mock/timer simulado), com polling de status enquanto
  aguarda leitura do QR. Card novo "Contatos e grupos ignorados" com
  CRUD via Server Actions (ignored-actions.ts) — adiciona por
  número/ID de grupo + nome, respeitando o pedido do usuário de poder
  ignorar grupos ou pessoas específicas.

- Tela Configurar IA (agent-form.tsx): nova seção "Provedor de IA"
  com dois cartões — "IA da plataforma (padrão)" e "Minha própria IA"
  (revela provider/modelo/token quando selecionado). O token nunca é
  reenviado pro client: a Server Component só passa um booleano
  has_custom_key; salvar com o campo de token em branco mantém a
  chave já salva (só sobrescreve se o usuário digitar uma nova).
```

### 29.2 Atualização — WAHA subiu de verdade (mesma sessão, depois do resumo acima)

```text
- docker-compose.yml criado na raiz do projeto (fora de app/), com o
  serviço WAHA real (imagem devlikeapro/waha). O compose original que
  o usuário trouxe também tinha um serviço n8n com o WAHA configurado
  pra mandar webhook pra ele — decisão explícita do usuário (pergunta
  feita via AskUserQuestion): usar a rota /api/webhooks/waha do
  Next.js direto, sem n8n. O serviço n8n foi removido do compose.
- WAHA mapeado pra porta 3001 no host (era 3000, conflitava com o
  `next dev`). app/.env.local atualizado com valores reais:
  WAHA_BASE_URL=http://localhost:3001, WAHA_API_KEY real (a mesma do
  docker-compose.yml).
- WEBHOOK_BASE_URL não precisa mais de túnel público em dev: como o
  WAHA roda no Docker Desktop (Windows) e o `next dev` roda direto no
  host, o container enxerga o host via `host.docker.internal` —
  WEBHOOK_BASE_URL=http://host.docker.internal:3000 (ajustar a porta
  se o `next dev` rodar em outra). WAHA_WEBHOOK_SECRET também já foi
  gerado (string aleatória), não é mais placeholder.
- .gitignore criado na raiz (não existia): ignora waha/ (sessões do
  WhatsApp e mídias persistidas pelo container).
```

### 29.3 Pendências que ainda dependem do usuário

```text
- OPENAI_API_KEY em app/.env.local ainda é placeholder
  (sk-placeholder) — precisa de uma chave real da OpenAI pra "IA da
  plataforma" funcionar (ou configurar "minha própria IA" com
  credenciais de outro provedor direto na tela Configurar IA).
- Falta rodar o SQL de migração da sessão 3 no Supabase (colunas
  novas em agent_configs/whatsapp_sessions + tabela ignored_chats).
- Conversas e Logs da IA (telas do dashboard) continuam mockadas —
  não foram ligadas às tabelas conversations/messages/ai_logs que o
  webhook já passou a alimentar. Fica pra próxima sessão.
- Cardápio/Base ainda mockado (menu_items) — o webhook já lê dessa
  tabela pro contexto da IA, então cadastrar itens reais já teria
  efeito, mas a tela de cadastro em si ainda não persiste no Supabase.
```

### 29.4 Próximo passo sugerido

```text
Usuário roda a migração SQL no Supabase, coloca uma OPENAI_API_KEY
real (ou configura "minha própria IA"), sobe `npm run dev` e testa a
conexão/QR e uma conversa real ponta a ponta com o WAHA já rodando em
Docker. Depois: ligar Conversas/Logs da IA/Cardápio aos dados reais
que o webhook já grava.
```

---

## 30. Status atual do desenvolvimento (atualizado em 2026-07-04, sessão 3 — parte 2)

Depois do primeiro teste real ponta a ponta (webhook funcionando), o usuário testou de verdade e reportou 5 problemas. Todos corrigidos na mesma sessão:

### 30.1 Bugs corrigidos

```text
- Webhook ignorava status@broadcast (Status do WhatsApp) e @newsletter
  incorretamente como se fossem clientes reais — WAHA retornava erro
  500 ao tentar enviar texto pra esses pseudo-chats. Agora são
  ignorados antes de chamar a IA.
- Cardápio/Base, Conversas, Pedidos e o Dashboard inicial ainda
  usavam dados mockados (MOCK_ITEMS, MOCK_CONVERSATIONS, MOCK_ORDERS,
  números fictícios) mesmo com o webhook já gravando dados reais nas
  tabelas — por isso a IA "não via" o cardápio cadastrado na tela e a
  conversa real não aparecia em lugar nenhum do painel. Todas as 4
  telas foram religadas ao Supabase (mesmo padrão Server Component +
  Server Actions das telas anteriores).
```

### 30.2 Feito nesta parte da sessão

```text
- menu_items ganhou coluna `ingredients` (jsonb, array de strings).
  Formulário de cardápio (menu-client.tsx) e o contexto enviado pra
  IA no webhook agora incluem ingredientes.
- Cardápio/Base: app/src/app/dashboard/menu/{page.tsx,menu-client.tsx,actions.ts}
  — CRUD real (saveMenuItem, deleteMenuItem, toggleMenuItemAvailable,
  bulkCreateMenuItems).
- Conversas: app/src/app/dashboard/conversations/{page.tsx,conversations-client.tsx,actions.ts}
  — lista real de conversations + mensagens carregadas sob demanda
  (getConversationMessages), assumir/devolver pra IA
  (takeoverConversation/releaseConversation), responder como humano
  de verdade via WAHA (sendHumanReply, que chama lib/waha.ts sendText
  e grava sender='human_agent' em messages).
- Dashboard inicial: app/src/app/dashboard/page.tsx — status do
  agente/WhatsApp, número conectado, contadores (conversas hoje,
  pedidos confirmados hoje, handoffs humanos, erros de IA hoje) e as
  listas de "últimas conversas"/"pedidos recentes" agora vêm do
  Supabase (antes eram 100% mock, inclusive o número de telefone
  fictício "+55 11 9 9999-9999" que o usuário via mesmo com o
  WhatsApp real conectado).
- Pedidos: app/src/app/dashboard/orders/{page.tsx,orders-client.tsx,actions.ts}
  — Kanban ligado à tabela orders real (nunca tinha sido ligado,
  mesmo depois do webhook passar a criar pedidos de verdade). Trocar
  status agora também pode ser feito arrastando o card entre colunas
  (drag-and-drop nativo HTML5, sem biblioteca nova), além do Select
  que já existia no dialog de detalhes.
- Importar cardápio via PDF/imagem (pedido explícito do usuário,
  decisão confirmada via pergunta: usar tela de revisão antes de
  salvar, não importação direta):
  - Nova dependência: `pdf-parse` (v2, puro JS + @napi-rs/canvas
    prebuilt — sem compilação nativa, tranquilo no Windows).
  - app/src/lib/ai.ts ganhou extractMenuFromText/extractMenuFromImages
    (usa sempre a IA da plataforma, gpt-4.1-mini com visão).
  - app/src/app/api/menu/import/route.ts: recebe o arquivo, se for
    PDF tenta extrair texto real primeiro (parser.getText()); se o
    PDF não tiver texto (provável escaneado/foto), renderiza as 3
    primeiras páginas como imagem (parser.getScreenshot()) e manda
    pra IA de visão; se for imagem (jpg/png), manda direto pra IA de
    visão. Retorna os itens extraídos SEM salvar no banco.
  - menu-client.tsx: botão "Importar cardápio" abre um dialog com
    upload → depois de processado, mostra uma tela de revisão
    editável (nome, categoria, preço, ingredientes, incluir/excluir
    por item) → só ao confirmar chama bulkCreateMenuItems.
- Corrigido erro de build de produção pré-existente e fora do escopo
  das sessões anteriores: dashboard/logs/page.tsx tinha o mesmo bug
  de tipagem do Select (`onValueChange`) que aparecia só no `next
  build` (o `next dev` não did type-check completo). `npx next
  build` agora passa 100% limpo.
```

### 30.3 Ainda mockado / faltando

```text
- Logs da IA (tela) continua mockada — ai_logs já tem dados reais
  gravados pelo webhook, só falta ligar a tela.
- Kanban de Pedidos não tem coluna para status `pending_confirmation`
  (usado quando agent_configs.human_approval_required = true) — um
  pedido criado nesse estado fica invisível no Kanban hoje. Ninguém
  pediu isso ainda, mas é uma lacuna real se o approval humano for
  ativado.
- Etapa 7 (Piloto) não iniciada.
```

---

## 31. Status atual do desenvolvimento (atualizado em 2026-07-04, sessão 3 — parte final)

Depois de um teste real ponta a ponta completo (cardápio → pedido → endereço →
pagamento → confirmação), o usuário reportou mais 4 pontos, todos corrigidos:

```text
- Coluna "Aguardando confirmação" (pending_confirmation) adicionada ao Kanban de
  Pedidos — pedidos com human_approval_required=true ficavam invisíveis lá
  (só apareciam nas estatísticas/dashboard).
- WhatsApp esconde o número real do cliente atrás de um @lid em alguns casos
  (recurso de privacidade do próprio WhatsApp, não é bug). Adicionado
  resolveLidToPhone() em lib/waha.ts (usa GET /api/{session}/lids/{lid} do WAHA)
  + coluna conversations.customer_phone_display (só exibição — customer_phone
  continua sendo o identificador usado pra responder). Quando não resolvido,
  mostra "Número oculto pelo WhatsApp" em vez de um número enganoso.
- Confirmado via teste direto (insert + subscribe num script) que o Realtime
  funciona de ponta a ponta quando a publicação está habilitada — se parecer
  travado no navegador, suspeitar de conexão antiga (pedir refresh) antes de
  investigar código.
- Pagamento via PIX: não faltava dado (a Chave PIX já existia em Minha Empresa,
  dentro de store_profiles.delivery_rules.pix_key, e já ia no contexto da IA) —
  faltava só instruir o prompt a usá-la. Perguntado ao usuário (AskUserQuestion):
  chave PIX fixa vs. gateway de pagamento real — escolhida a chave fixa.
  Adicionada regra no prompt (agent-form.tsx) pra incluir a chave + valor total
  na confirmação, sem inventar chave se não houver uma cadastrada. Testado
  ponta a ponta com sucesso.
- Tela Logs da IA (última tela mockada) religada aos dados reais de ai_logs,
  com join em conversations pra mostrar nome/telefone legível em vez do ID.
  Todas as 8 telas do dashboard agora usam dados reais — nenhuma tela mockada
  restante.
- A pedido do usuário, todos os dados de teste/depuração foram apagados
  (conversations, messages em cascata, orders, ai_logs, webhook_events) pra
  permitir um teste do zero.
```

### 31.1 Próximo passo sugerido

```text
MVP do painel está funcionalmente completo — todas as telas com dados reais,
fluxo de WhatsApp + IA testado ponta a ponta (cardápio, pedido, endereço,
pagamento via PIX fixo, confirmação). Falta: Etapa 7 (piloto real com a
lanchonete) e, se o usuário quiser no futuro, uma integração de pagamento
de verdade (gateway com QR dinâmico e confirmação automática).
```
