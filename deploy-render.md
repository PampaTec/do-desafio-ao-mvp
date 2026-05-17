# Deploy no Render.com

> Desafio ao MVP · PampaTec
> Frontend (Static Site) + Backend (Web Service) + Google Sheets (banco)

---

## Pré-requisitos

- Conta no [Render.com](https://render.com) (plano gratuito)
- Conta no [Google Cloud Console](https://console.cloud.google.com) com APIs Sheets/Drive ativadas
- Planilha Google criada com as 7 abas (ou deixe o app criar automaticamente)
- Repositório Git do projeto (GitHub, GitLab ou Bitbucket)

---

## Etapa 1 — Preparar o Google Cloud

### 1.1 Criar projeto e ativar APIs

1. [Google Cloud Console](https://console.cloud.google.com) → **Novo Projeto**
2. **APIs & Services → Library**
3. Ative:
   - **Google Sheets API**
   - **Google Drive API**
   - **Google People API** (para dados do perfil do usuário)

### 1.2 Configurar OAuth Consent Screen

1. **APIs & Services → OAuth consent screen**
2. Tipo: **External**
3. Preencha: App name (ex: "Desafio ao MVP"), User support email, Developer contact
4. Scopes: adicione `userinfo.email`, `userinfo.profile`, `drive`, `spreadsheets`
5. Test users: adicione os e-mails dos admins

### 1.3 Criar OAuth Client ID

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
2. Application type: **Web application**
3. Authorized redirect URIs:
   ```
   http://localhost:3001/auth/google/callback
   https://SEU-WEB-SERVICE.onrender.com/auth/google/callback
   ```
4. Anote o **Client ID** e **Client Secret**

### 1.4 Compartilhar a planilha

1. Crie uma planilha Google (ou use `PROGRESS_SHEET_ID` do `.env`)
2. Compartilhe a planilha com o e-mail do admin (dono) — as abas serão criadas automaticamente na primeira requisição

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
| **Branch** | `feat/google-sheets-migration` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npx tsx server/index.ts` |
| **Plan** | `Free` |

### 2.2 Variáveis de Ambiente

Adicione em **Environment Variables**:

| Variável | Valor |
|----------|-------|
| `PORT` | `10000` (definido pelo Render) |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | `https://desafio-mvp.onrender.com` |
| `GOOGLE_CLIENT_ID` | Seu Client ID do Google Cloud |
| `GOOGLE_CLIENT_SECRET` | Seu Client Secret do Google Cloud |
| `GOOGLE_REDIRECT_URI` | `https://SEU-WEB-SERVICE.onrender.com/auth/google/callback` |
| `PROGRESS_SHEET_ID` | ID da planilha Google (ex: `1gKH4eS4SatIMPrWy2qAGvqc6CtFlLaIdqx87uPbw8Do`) |
| `ADMIN_EMAIL` | `emersonrizzatti@unipampa.edu.br` |
| `COOKIE_KEY` | Uma string aleatória forte para assinar cookies (ex: `openssl rand -hex 32`) |
| `GEMINI_API_KEY` | Chave da Gemini API |
| `NODE_VERSION` | `22` |

### 2.3 Deploy

Clique **Create Web Service**. Anote a URL gerada.

> ⚠️ **IMPORTANTE:** Após cada deploy/redeploy, o admin deve acessar `https://SEU-WEB-SERVICE.onrender.com/auth/google/admin` para re-autenticar e salvar os tokens de acesso à planilha. Sem isso, operações de Sheets falharão.

---

## Etapa 3 — Deploy do Frontend (Static Site)

### 3.1 Configurar no Render

1. Dashboard Render → **New → Static Site**
2. Conecte o mesmo repositório Git
3. Preencha:

| Campo | Valor |
|-------|-------|
| **Name** | `desafio-mvp` |
| **Branch** | `feat/google-sheets-migration` |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `dist` |
| **Plan** | `Free` |

### 3.2 Variáveis de Ambiente

| Variável | Valor |
|----------|-------|
| `VITE_API_URL` | `https://SEU-WEB-SERVICE.onrender.com` |

### 3.3 Rewrite Rules (SPA routing)

O arquivo `public/_redirects` já está configurado para redirecionar todas as rotas para `index.html`. Isso é essencial para que rotas como `/admin`, `/team`, `/skill-editor` funcionem corretamente no Static Site.

Se preferir configurar via dashboard: **Redirects/Rewrites → Add Rule:**
- Source: `/*`
- Destination: `/index.html`
- Action: **Rewrite**

### 3.4 Deploy

Clique **Create Static Site**.

> ⚠️ Após criar o Static Site, vá no **Web Service** e faça redeploy manual para atualizar `FRONTEND_URL` e `GOOGLE_REDIRECT_URI`.

---

## Etapa 4 — Configurar Redirect URIs

### 4.1 Google OAuth — Redirect URI de produção

1. [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Edite o OAuth Client ID
3. Adicione em **Authorized redirect URIs**:
   ```
   https://SEU-WEB-SERVICE.onrender.com/auth/google/callback
   ```

---

## Etapa 5 — Verificar o Deploy

### Health check

```bash
curl https://SEU-WEB-SERVICE.onrender.com/api/health
# → {"status":"ok"}
```

### Fluxo completo

1. Acesse `https://desafio-mvp.onrender.com`
2. Clique "Entrar com Google"
3. O backend redireciona para o Google → callback → cookie de sessão
4. Admin → `/admin`, member → `/team` ou `/waiting`
5. Crie um time, envie mensagem no chat, confirme resposta da IA

### Logs do backend

**Dashboard → desafio-mvp-web-service → Logs**

---

## Manutenção

### Redeploy manual

No Render, vá ao serviço → **Manual Deploy → Deploy latest commit**.

---

## Plano Free — Limitações

| Recurso | Limite Free Render | Mitigação |
|---------|-------------------|-----------|
| **Tempo ativo** | Web Service dorme após 15 min inatividade | Primeiro acesso leva ~30s (cold start) |
| **Tempo mensal** | 750 horas/mês | Suficiente para 24/7 |
| **Banco** | — | Google Sheets (gratuito, sem limite de requisições razoável) |
| **SSL** | Automático | Incluso |
| **CDN** | Global (via Render) | Frontend estático servido via edge |

Para evitar cold start, configure um cron job (ex: [cron-job.org](https://cron-job.org)) pingando `/api/health` a cada 5 min.

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
│  Node.js + Express + googleapis + Gemini SDK       │
│  cookie-session (sessão em cookie assinado)        │
│  Porta 10000 (definida pelo Render)                │
└──────────┬─────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────┐
│           Google Sheets (via API)                  │
│  7 abas = PROFILES, TEAMS, TEAM_MEMBERS,          │
│  CHAT_MESSAGES, TEAM_PROGRESS,                    │
│  SKILL_VERSIONS, SKILL_AUDIT_LOG                  │
└──────────────────────────────────────────────────┘
```
