# Deploy na VPS (Hostinger, compartilhada)

Arquitetura: painel Next.js + WAHA rodando em **Docker**, isolados dos outros
projetos que já vivem nessa VPS (PM2, outros containers, etc.). O **Nginx do
host** (não containerizado) faz o proxy reverso e o HTTPS pro domínio público
— não subimos Caddy nem tocamos nas portas 80/443, que já são do Nginx
existente. O **Supabase continua gerenciado** no supabase.com.

```
Internet ──HTTPS──▶ Nginx (host, :80/:443) ──▶ app (Docker, 127.0.0.1:3100) ──▶ Supabase (nuvem)
                                                   │  ▲
                                                   ▼  │ (rede interna do compose)
                                                 WAHA (não exposto)
```

> Histórico: tentamos primeiro a Oracle Cloud Always Free (gratuita) e depois
> cogitamos Hetzner, mas como você já tinha essa VPS da Hostinger rodando
> outros projetos, decidimos reaproveitá-la em vez de pagar por outra.

## 0. Antes de tudo — não é uma VPS vazia

Essa VPS já hospeda vários projetos via PM2 e Nginx (portas 3000-3025, 5xxx,
8xxx ocupadas, Postgres, MongoDB). O compose deste projeto foi ajustado pra
não conflitar com nada disso:

- App exposto só em `127.0.0.1:3100` (porta livre, escolhida a dedo).
- WAHA sem nenhuma porta pro host (só rede interna do Docker).
- Nada mexe no Nginx do host além de **adicionar** um novo site
  (`app.axisb2b.com`), igual aos outros que já existem em
  `/etc/nginx/sites-available/`.
- Tudo do projeto fica isolado em `/srv/projects/gabriel/` (sua pasta
  pessoal na VPS, separada de `caio/`, `daniel/`, `dashboard/`).

Se algum dia mudar algo na VPS (novo projeto, porta usada), reconfira que
`3100` continua livre: `ss -tlnp | grep 3100`.

## 1. Instalar Docker (uma vez)

```bash
ssh root@92.113.33.149

curl -fsSL https://get.docker.com | sh
docker --version   # confirma que instalou
```

## 2. DNS

No gerenciador do domínio `axisb2b.com`, crie um registro **A**:
`app.axisb2b.com → 92.113.33.149` (mesmo IP dos outros sites que já apontam
pra essa VPS). Espere propagar antes do passo 5.

## 3. Clonar e configurar o projeto

```bash
mkdir -p /srv/projects/gabriel
cd /srv/projects/gabriel
git clone https://github.com/Gabriel-Alves-dev/IA-axis-atendimento.git axis-atendimento
cd axis-atendimento

cp .env.production.example .env.production
nano .env.production          # preencher tudo (valores do seu app/.env.local)
```

## 4. Subir os containers

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Primeiro build demora uns minutos. Confirma que subiu:

```bash
docker ps --filter "name=axis-"
curl -I http://127.0.0.1:3100   # deve responder (307 pro /login é normal)
```

## 5. Configurar o Nginx do host + HTTPS

```bash
cp deploy/nginx-app.conf /etc/nginx/sites-available/app.axisb2b.com
ln -s /etc/nginx/sites-available/app.axisb2b.com /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Emite e configura o certificado HTTPS automaticamente (mesmo processo usado
# nos outros sites dessa VPS)
certbot --nginx -d app.axisb2b.com
```

Pronto: `https://app.axisb2b.com` no ar. Conecta o WhatsApp de novo pela tela
do painel (QR) — a sessão fica persistida em `waha/sessions/` dentro da pasta
do projeto e sobrevive a restarts.

## 6. Atualizar depois de um push

```bash
cd /srv/projects/gabriel/axis-atendimento && git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## Notas

- **WAHA não fica exposto na internet** — só o painel passa pelo Nginx. Pra
  ver o dashboard do WAHA: descomente o `ports` dele no
  `docker-compose.prod.yml` (porta `3101`, também só localhost) e use túnel
  SSH: `ssh -L 3101:localhost:3101 root@92.113.33.149` → http://localhost:3101.
- **Supabase**: em Authentication → URL Configuration, ajuste o Site URL pra
  `https://app.axisb2b.com`.
- **Vercel**: pode manter o projeto como ambiente de demo/preview ou deletar —
  os dois deploys não conflitam (mas só um deve ficar com o WhatsApp conectado).
- **Logs**: `docker compose -f docker-compose.prod.yml logs -f app` (ou `waha`).
- **Segurança**: essa VPS roda projetos de outras pessoas (chaves SSH de
  `julio.cesar`, `caio.araujo` etc. em `/root/.ssh/authorized_keys`) — evite
  rodar comandos com `sudo`/`root` fora da pasta do projeto sem necessidade,
  e nunca use `docker system prune` sem `--filter` (pode afetar containers
  de outros projetos se algum dia existirem).
- **Se um dia quiser tentar a Oracle Always Free** (gratuita, mas com fila de
  capacidade) ou migrar pra uma VPS dedicada (Hetzner): os arquivos
  `deploy/create-vm-retry.ps1` (retry automático da Oracle) e a imagem WAHA
  `:arm` ficam disponíveis se precisar retomar essas rotas — nesse caso volta
  a fazer sentido usar Caddy (veja o histórico do git deste arquivo).
