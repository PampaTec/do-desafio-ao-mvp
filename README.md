# Desafio ao MVP

**Plataforma de gestão da jornada de empreendedores guiada por IA**  
Parte do programa **Startup Pampa** do **PampaTec — Parque Tecnológico do Pampa**

> Do desafio ao protótipo em 7 etapas guiadas por IA

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + TypeScript + Tailwind CSS 4 (Vite) |
| Backend | Node.js + Express 5 + TypeScript |
| Banco | PostgreSQL 16 (local) / Supabase (produção) |
| ORM | Prisma 6 |
| Autenticação | Supabase Auth (Google OAuth) |
| IA | Cloudflare AI Gateway (Workers AI, Groq, DeepSeek — fallback automático) |

---

## Identidade Visual

- **Primária:** Verde `#00A859`
- **Secundária:** Cinza `#727476`
- **Fundo:** `#111111` / cartões `#1A1A1A`
- **Texto:** `#F5F5F5`
- **Tipografia:** Lily UPC / Nunito (fallback)
- **Design:** Dark theme, mobile-first, alto contraste

---

## Pré-requisitos

- Node.js 18+
- PostgreSQL 16 rodando na porta 5432
- Projeto no Supabase (free tier) com Google OAuth configurado
- Conta Cloudflare com AI Gateway ativo e API Token

---

## Setup rápido

```bash
# 1. Clonar e instalar
npm install

# 2. Criar banco local e schema auth (para FK de auth.users)
createdb desafio_ao_mvp
psql -d desafio_ao_mvp -c "CREATE SCHEMA IF NOT EXISTS auth; CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY);"

# 3. Configurar variáveis de ambiente
cp .env.example .env         # backend
cp .env.example .env.local   # frontend (prefixo VITE_)

# 4. Sincronizar banco e seed
npx prisma generate
npx prisma db push
npx prisma db seed
```

---

## Variáveis de Ambiente

### `.env` (backend)

```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
DATABASE_URL=postgres://user:pass@localhost:5432/desafio_ao_mvp
FRONTEND_URL=http://localhost:5174
CLOUDFLARE_API_TOKEN=seu_token_cloudflare
CLOUDFLARE_ACCOUNT_ID=seu_account_id
```

### `.env.local` (frontend)

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon
```

---

## Rodar em Desenvolvimento

```bash
# Terminal 1 — Backend (porta 3001)
npm run dev:server

# Terminal 2 — Frontend (porta 5174)
npm run dev
```

- Frontend: `http://localhost:5174`
- Backend: `http://localhost:3001`
- O Vite faz proxy de `/api/*` para o backend.

---

## Rotas da Aplicação

| Rota | Descrição |
|------|-----------|
| `/` | Landing + Login com Google |
| `/admin` | Painel administrativo |
| `/admin/new-team` | Criar novo time |
| `/admin/team/:id` | Gerenciar time (admin) |
| `/team` | Chat do membro com a IA |
| `/waiting` | Aguardando time ser criado |
| `/skill-editor` | Editor de skill (admin) |

---

## Estrutura do Projeto

```
/
├── src/                  # Frontend React + Vite
│   ├── components/       # Header, ChatBubble, Stepper, Toast, ProtectedRoute
│   ├── hooks/            # useAuth (AuthProvider + contexto)
│   ├── lib/              # api.ts (cliente HTTP), supabase.ts
│   ├── pages/            # Landing, Admin, AdminNewTeam, AdminTeamDetail,
│   │                     # MemberChat, Waiting, SkillEditor
│   ├── App.tsx           # Rotas
│   ├── main.tsx          # Entry point
│   └── index.css         # Tailwind + theme tokens
├── server/               # Backend Express + TypeScript
│   ├── index.ts          # Servidor
│   ├── db/prisma.ts      # Prisma client
│   ├── middleware/auth.ts # requireAuth, requireAdmin
│   └── routes/           # auth, teams, chat, skill, stats
├── prisma/
│   ├── schema.prisma     # Modelo de dados (7 tabelas)
│   └── seed.ts           # Seed: admin + skill inicial
├── skill-desafio-ao-mvp.md  # Conteúdo da skill de IA
├── requisitos.md         # Documento de requisitos completo
└── servidor_localhost.md # Guia de setup local
```

---

## Banco de Dados

7 tabelas gerenciadas pelo Prisma:

- `profiles` — Usuários e perfis (admin/member)
- `teams` — Times de empreendedores
- `team_members` — Associação membro-time
- `chat_messages` — Histórico do chat
- `team_progress` — Progresso por etapa (1-7)
- `skill_versions` — Versões da skill (máx 5)
- `skill_audit_log` — Log de alterações da skill

---

## Fluxo do Chat com IA

1. Membro envia mensagem → salva em `chat_messages`
2. Backend monta system prompt dinâmico:
   - Conteúdo completo da skill ativa
   - Estado atual da jornada do time
   - Últimas 20 mensagens do histórico
3. Chama Cloudflare AI Gateway (com fallback entre Workers AI, Groq, DeepSeek)
4. Detecta tag `[ETAPA_CONCLUIDA: N]` → atualiza progresso
5. Salva resposta e avança stepper na UI

---

## Comandos Úteis

```bash
npm run dev            # Frontend Vite
npm run dev:server     # Backend Express
npx prisma studio      # Visualizar banco
npx prisma db push     # Sincronizar schema
npx prisma db seed     # Popular dados iniciais
npm run build          # Build produção
npm run lint           # ESLint
npm run typecheck      # TypeScript check
```

---

## Licença

MIT — Equipe PampaTec · Parque Tecnológico do Pampa
