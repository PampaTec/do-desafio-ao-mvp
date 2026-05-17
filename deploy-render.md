# Deploy no Render.com

> Desafio ao MVP · PampaTec
> Frontend (Static Site) + Backend (Web Service) + Supabase (PostgreSQL)

---

## Pré-requisitos

- Conta no [Render.com](https://render.com) (plano gratuita)
- Conta no [Supabase](https://supabase.com) já configurada com Google OAuth
- Repositório Git do projeto (GitHub, GitLab ou Bitbucket)

---

## Etapa 1 — Preparar o Banco de Dados (Supabase)

### 1.1 Obter a connection string do banco

1. Supabase Dashboard → **Project Settings → Database**
2. Em **Connection string → Node.js** copie a URI ou use a senha definida no reset
3. Anote — será usada no backend em produção

> ⚠️ **Nota:** Se seu ISP não tem IPv6, o comando `prisma db push` não funcionará localmente.
> Use o **SQL Editor** do Supabase Dashboard (ver `prisma/schema.prisma` para criar as tabelas manualmente).

### 1.2 Aplicar schema e seed

Se tiver IPv6, execute no terminal:

```bash
DATABASE_URL="postgresql://postgres:PampaTec2026@db.yduaeewtixrxdgbhyety.supabase.co:5432/postgres" npx prisma db push
DATABASE_URL="postgresql://postgres:PampaTec2026@db.yduaeewtixrxdgbhyety.supabase.co:5432/postgres" npx prisma db seed
```

Caso contrário, abra **Supabase Dashboard → SQL Editor** e execute os SQLs de `prisma/schema.prisma` e `prisma/seed.ts`.

Isso cria as 7 tabelas + admin `emersonrizzatti@unipampa.edu.br` + skill inicial.

---

## Etapa 2 — Deploy do Backend (Web Service)

### 2.1 Configurar no Render

1. Dashboard Render → **New → Web Service**
2. Conecte seu repositório Git
3. Preencha:

| Campo | Valor |
|-------|-------|
| **Name** | `desafio-mvp-web-service` |
| **Region** | `Oregon (US West)` (menor latência Brazil) |
| **Branch** | `main` |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npx prisma generate` |
| **Start Command** | `npx tsx server/index.ts` |
| **Plan** | `Free` |

### 2.2 Variáveis de Ambiente

Adicione em **Environment Variables**:

| Variável | Valor |
|----------|-------|
| `SUPABASE_URL` | URL do seu projeto Supabase (`https://yduaeewtixrxdgbhyety.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkdWFlZXd0aXhyeGRnYmh5ZXR5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODk5MDM3MCwiZXhwIjoyMDk0NTY2MzcwfQ.nR-DyUvZLARxMVmL8CKwVUxotvY-OSuu52vWKIayMwo |
| `DATABASE_URL` | postgresql://postgres:PampaTec2026@db.yduaeewtixrxdgbhyety.supabase.co:5432/postgres |
| `FRONTEND_URL` | `https://desafio-mvp.onrender.com` |
| `GEMINI_API_KEY` | `AIza...` (chave da Gemini API) |
| `NODE_VERSION` | `22` |

### 2.3 Deploy

Clique **Create Web Service**. O Render vai fazer o build e deploy automático.

Anote a URL gerada: `https://do-desafio-ao-mvp.onrender.com`.

---

## Etapa 3 — Deploy do Frontend (Static Site)

### 3.1 Configurar no Render

1. Dashboard Render → **New → Static Site**
2. Conecte o mesmo repositório Git
3. Preencha:

| Campo | Valor |
|-------|-------|
| **Name** | `desafio-mvp` |
| **Branch** | `main` |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `dist` |
| **Plan** | `Free` |

### 3.2 Variáveis de Ambiente

| Variável | Valor |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://yduaeewtixrxdgbhyety.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_sjaQUsC4Sk3XtiEhkjG7nw_TU-S8Lzx` |
| `VITE_API_URL` | `https://do-desafio-ao-mvp.onrender.com` |

### 3.3 Deploy

Clique **Create Static Site**.

URL gerada: `https://desafio-mvp.onrender.com`.

> ⚠️ Após criar o Static Site, vá no **Web Service** e **redeploy** manual para aplicar a mudança do `FRONTEND_URL`.

---

## Etapa 4 — Configurar CORS e Redirect URIs

### 4.1 Variável FRONTEND_URL no backend

Edite o Web Service no Render:
1. Vá em **Environment → Environment Variables**
2. Atualize `FRONTEND_URL` para a URL do Static Site (`https://desafio-mvp.onrender.com`)
3. Clique **Save Changes** — o Render faz redeploy automático

### 4.2 Google OAuth — Redirect URIs

No [Google Cloud Console](https://console.cloud.google.com):
1. **APIs & Services → Credentials**
2. Selecione o OAuth Client ID usado pelo Supabase
3. Adicione em **Authorized redirect URIs**:

```
https://yduaeewtixrxdgbhyety.supabase.co/auth/v1/callback
```

### 4.3 Supabase Auth — Redirect URLs

No Supabase Dashboard:
1. **Authentication → URL Configuration**
2. Em **Site URL**: `https://desafio-mvp.onrender.com`
3. Em **Redirect URLs**: adicione `https://desafio-mvp.onrender.com`

---

## Etapa 5 — Verificar o Deploy

### Health check

```bash
curl https://do-desafio-ao-mvp.onrender.com/api/health
# → {"status":"ok"}
```

### Teste completo

1. Acesse `https://desafio-mvp.onrender.com`
2. Faça login com Google
3. Verifique redirecionamento correto (admin → `/admin`, member → `/team` ou `/waiting`)
4. Crie um time, envie mensagem no chat, confirme resposta da IA

### Logs do backend

Para debug, veja os logs do Web Service no Render:
**Dashboard → desafio-mvp-web-service → Logs**

---

## Manutenção

### Atualizar schema do banco

Após alterar `prisma/schema.prisma`:

```bash
DATABASE_URL="postgresql://..." npx prisma db push
```

### Novo seed

```bash
DATABASE_URL="postgresql://..." npx prisma db seed
```

### Redeploy manual

No Render, vá ao serviço → **Manual Deploy → Deploy latest commit**.

---

## Plano Free — Limitações

| Recurso | Limite Free Render | Mitigação |
|---------|-------------------|-----------|
| **Tempo ativo** | Web Service dorme após 15 min inatividade | O primeiro acesso após inatividade leva ~30s (cold start) |
| **Tempo mensal** | 750 horas/mês | Suficiente para um serviço ligado 24h (~31 dias) |
| **Banco** | — | Usar Supabase (esquema separado) |
| **SSL** | Automático | Incluso |
| **CDN** | Global (via Render) | Frontend estático servido via edge |

Para evitar cold start em horário comercial, é possível configurar **cron job** (ex: [cron-job.org](https://cron-job.org)) pingando `/api/health` a cada 5 min.

---

## Arquitetura Final

```
┌──────────────────────────────────────────────────┐
│              Render Static Site                    │
│  https://desafio-mvp.onrender.com                  │
│  (Vite build → dist/ → servido como SPA)          │
└──────────┬─────────────────────────────────────────┘
           │ fetch /api/* via VITE_API_URL
           ▼
┌──────────────────────────────────────────────────┐
│           Render Web Service                       │
│  https://do-desafio-ao-mvp.onrender.com            │
│  Node.js + Express + Prisma + Gemini SDK           │
│  Porta 3001 (definida pelo Render)                 │
└──────────┬─────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────┐
│           Supabase PostgreSQL                      │
│  Banco gerenciado + Auth (Google OAuth)            │
│  db.yduaeewtixrxdgbhyety.supabase.co:5432          │
└──────────────────────────────────────────────────┘
```
