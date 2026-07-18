# Deploy num VPS (Hetzner)

Arquitetura: **um servidor** rodando painel Next.js + WAHA + Caddy (HTTPS)
via `docker-compose.prod.yml`. O **Supabase continua gerenciado** no supabase.com.

```
Internet ──HTTPS──▶ Caddy ──▶ app (Next.js :3000) ──▶ Supabase (nuvem)
                                 │  ▲
                                 ▼  │ (rede interna do compose)
                               WAHA (:3000, não exposto)
```

> Nota: tentamos primeiro a Oracle Cloud Always Free (gratuita), mas a região
> São Paulo ficou sem capacidade da VM ARM gratuita por mais de 12h seguidas
> (isso é comum lá — ver `deploy/create-vm-retry.ps1` se quiser retomar essa
> rota depois, é só um script de retry). Hetzner custa uns €4,5-5/mês
> (~R$ 25-30) mas cria a VM na hora, sem fila.

## 1. Criar o servidor (uma vez)

1. Conta em [hetzner.com/cloud](https://www.hetzner.com/cloud) (pede cartão).
2. **New Project** → **Add Server**:
   - Location: **Nuremberg** ou **Falkenstein** (Alemanha — mais barato) ou
     **Ashburn** (EUA) se preferir menor latência pras APIs do Mercado Pago/OpenAI.
     (Hetzner não tem datacenter no Brasil; a diferença de latência pro
     usuário final é pequena pra um painel administrativo.)
   - Image: **Ubuntu 24.04**
   - Type: **CX22** (2 vCPU / 4GB RAM / 40GB disco, ~€4,5/mês) — sobra pro
     painel + WAHA + Caddy.
   - SSH key: cole sua chave pública (`type C:\Users\trabs\.ssh\id_ed25519.pub`
     no PowerShell pra copiar).
   - Firewall: pode criar um liberando só **22, 80, 443** — o assistente da
     Hetzner tem um botão "Create Firewall" nessa mesma tela.
3. Criar. Em ~30s a VM está no ar com um IP público — anota ele.

## 2. Preparar o servidor

```bash
ssh root@IP_DO_SERVIDOR

curl -fsSL https://get.docker.com | sh
```

(Diferente da Oracle, a imagem Ubuntu da Hetzner não vem com iptables
bloqueando as portas — não precisa mexer em firewall do SO se você já
criou o Firewall da Hetzner no passo 1.)

## 3. DNS

No gerenciador do seu domínio, crie um registro **A**:
`app.seudominio.com.br → IP_DO_SERVIDOR`. Espere propagar (minutos, às vezes
até ~1h) antes do passo 5 — o Caddy precisa disso pra emitir o certificado HTTPS.

## 4. Configurar o projeto no servidor

```bash
git clone https://github.com/Gabriel-Alves-dev/IA-axis-atendimento.git
cd IA-axis-atendimento

cp .env.production.example .env.production
nano .env.production          # preencher tudo (valores do seu app/.env.local)

nano deploy/Caddyfile         # trocar app.seudominio.com.br pelo domínio real
```

## 5. Subir

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Primeiro build demora uns minutos. Depois:

- `https://app.seudominio.com.br` → painel no ar com HTTPS
- Conectar o WhatsApp de novo pela tela do painel (QR) — a sessão fica
  persistida em `waha/sessions/` e sobrevive a restarts do servidor.

## 6. Atualizar depois de um push

```bash
cd IA-axis-atendimento && git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## Notas

- **WAHA não fica exposto na internet** — só o painel passa pelo Caddy. Pra ver o
  dashboard do WAHA: `ssh -L 3001:localhost:3001 root@IP_DO_SERVIDOR` (e
  descomente o `ports` do waha no compose) → http://localhost:3001.
- **Supabase**: em Authentication → URL Configuration, ajuste o Site URL pra
  `https://app.seudominio.com.br`.
- **Vercel**: pode manter o projeto como ambiente de demo/preview ou deletar —
  os dois deploys não conflitam (mas só um deve ficar com o WhatsApp conectado).
- **Logs**: `docker compose -f docker-compose.prod.yml logs -f app` (ou `waha`, `caddy`).
- **Se um dia quiser tentar a Oracle Always Free de novo** (gratuita, mas com
  fila de capacidade): `deploy/create-vm-retry.ps1` já está pronto e testado —
  só rodar de novo (`powershell -ExecutionPolicy Bypass -File deploy\create-vm-retry.ps1`)
  e deixar na janela em background por um tempo mais longo.
