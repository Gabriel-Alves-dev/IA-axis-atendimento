# Deploy na Oracle Cloud (Always Free)

Arquitetura: **uma VM ARM gratuita** rodando painel Next.js + WAHA + Caddy (HTTPS)
via `docker-compose.prod.yml`. O **Supabase continua gerenciado** no supabase.com.

```
Internet ──HTTPS──▶ Caddy ──▶ app (Next.js :3000) ──▶ Supabase (nuvem)
                                 │  ▲
                                 ▼  │ (rede interna do compose)
                               WAHA (:3000, não exposto)
```

## 1. Criar a VM (uma vez)

1. Conta em [oracle.com/cloud/free](https://www.oracle.com/cloud/free/) (pede cartão
   só pra verificação; escolha a região **Brazil East (São Paulo)**).
2. Menu → Compute → Instances → **Create instance**:
   - Image: **Ubuntu 24.04** (aarch64)
   - Shape: **Ampere → VM.Standard.A1.Flex** — 2 OCPUs / 8 GB já sobra (o free
     permite até 4/24). Se der "Out of capacity", tente outro Availability
     Domain ou horário — é loteria comum no free tier de SP.
   - Cole sua chave SSH pública. Anote o **IP público** ao final.
3. Liberar portas na rede da Oracle: Networking → Virtual Cloud Networks → sua
   VCN → Security List da subnet → **Add Ingress Rules**: origem `0.0.0.0/0`,
   TCP, portas `80` e `443`.

## 2. Preparar a VM

```bash
ssh ubuntu@IP_DA_VM

# As imagens Ubuntu da Oracle vêm com iptables bloqueando tudo além do SSH —
# liberar 80/443 também no SO (além da Security List):
sudo iptables -I INPUT 5 -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 5 -p tcp --dport 443 -j ACCEPT
sudo apt-get update && sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save

# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
exit   # sair e conectar de novo pra valer o grupo docker
```

## 3. DNS

No gerenciador do seu domínio, crie um registro **A**:
`app.seudominio.com.br → IP_DA_VM`. (Espere propagar antes do passo 5 —
o Caddy precisa disso pra emitir o certificado HTTPS.)

## 4. Configurar o projeto na VM

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

Primeiro build demora uns minutos (compila o Next na VM). Depois:

- `https://app.seudominio.com.br` → painel no ar com HTTPS
- Conectar o WhatsApp de novo pela tela do painel (QR) — a sessão fica
  persistida em `waha/sessions/` e sobrevive a restarts da VM.

## 6. Atualizar depois de um push

```bash
cd IA-axis-atendimento && git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## Notas

- **WAHA não fica exposto na internet** — só o painel passa pelo Caddy. Pra ver o
  dashboard do WAHA: descomente o `ports` dele no compose e use túnel SSH
  (`ssh -L 3001:localhost:3001 ubuntu@IP_DA_VM` → http://localhost:3001).
- **Supabase**: em Authentication → URL Configuration, ajuste o Site URL pra
  `https://app.seudominio.com.br`.
- **Vercel**: pode manter o projeto como ambiente de demo/preview ou deletar —
  os dois deploys não conflitam (mas só um deve ficar com o WhatsApp conectado).
- **Logs**: `docker compose -f docker-compose.prod.yml logs -f app` (ou `waha`, `caddy`).
