# Desafio ao MVP — Desenvolvimento e Implantação Local

## Stack

| Camada       | Tecnologia                                    |
|-------------|-----------------------------------------------|
| Frontend    | React 19 + TypeScript + Tailwind CSS 4 (Vite) |
| Backend     | Node.js + Express 5 + TypeScript              |
| Banco       | PostgreSQL 16 (local)                         |
| ORM         | Prisma 6                                      |
| Autenticação | Supabase Auth (Google OAuth) — cloud        |
| IA          | Gemini API (`gemini-2.5-pro`) via chave de API |

---

## Arquitetura (localhost)

```
┌──────────────────────────────────────────────────────┐
│                   Vite Dev Server                      │
│            http://localhost:5174                       │
│   Proxy reverso: /api/* → http://localhost:3001       │
└──────────┬───────────────────────────────┬────────────┘
           │ req frontend                  │ req API
           ▼                               ▼
┌──────────────────┐          ┌──────────────────────┐
│  React App       │          │  Express API Server   │
│  (Vite HMR)      │   ───►  │  (tsx watch)          │
│                  │          │  Porta 3001           │
│  Auth: Supabase  │          ├──────────────────────┤
│  Client SDK      │          │  Prisma ORM           │
└──────────────────┘          │  Gemini API SDK       │
                              └──────┬───────────────┘
                                     │
                                     ▼
                          ┌──────────────────────┐
                          │   PostgreSQL 16       │
                          │   banco: desafio_ao_mvp_local │
                          └──────────────────────┘
```

---

## Pré-requisitos

- **Node.js** 18+ (v22.22.2 usado em dev)
- **npm** 9+
- **PostgreSQL** 16 rodando (localhost:5432)
- **Conta Supabase** (free) com Google OAuth configurado
- **Chave Gemini API** (opcional para fallback local)

---

## Setup Passo a Passo

### 1. Banco de dados

```bash
# Criar banco (usuário atual deve ter permissão CREATE DB)
createdb desafio_ao_mvp_local

# Criar schema auth e tabela mock (para FK auth.users)
psql -d desafio_ao_mvp_local -c "
  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY);
"
```

> A tabela `auth.users` é interna do Supabase em produção.
> No banco local criamos uma versão mock para a FK funcionar com Prisma.

### 2. Variáveis de ambiente

**`.env` (backend)**

```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
DATABASE_URL=postgres://SEU_USUARIO:SENHA@localhost:5432/desafio_ao_mvp_local
FRONTEND_URL=http://localhost:5174
GEMINI_API_KEY=sua_chave_gemini
```

**`.env.local` (frontend)**

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon
```

### 3. Instalar dependências e sincronizar banco

```bash
npm install

# Gerar Prisma client
npx prisma generate

# Sincronizar schema com banco local
npx prisma db push

# Seed: admin + skill inicial (skill-desafio-ao-mvp.md)
npx prisma db seed
```

### 4. Rodar servidores

```bash
# Terminal 1 — Backend (Express, porta 3001)
npm run dev:server

# Terminal 2 — Frontend (Vite, porta 5174)
npm run dev
```

---

## Rotas da Aplicação

| Rota | Descrição | Acesso |
|------|-----------|--------|
| `/` | Landing + Login Google | Público |
| `/admin` | Painel do admin | role=admin |
| `/admin/new-team` | Criar time | role=admin |
| `/admin/team/:id` | Gerenciar time | role=admin |
| `/team` | Chat com IA | role=member (com time) |
| `/waiting` | Aguardando time | role=member (sem time) |
| `/skill-editor` | Editar skill | role=admin |

---

## API Endpoints

| Método | Rota | Autenticação | Descrição |
|--------|------|--------------|-----------|
| GET | `/api/health` | — | Health check |
| POST | `/api/auth/login` | — | Login com token OAuth |
| GET | `/api/teams` | admin | Listar times |
| GET | `/api/teams/my` | auth | Meu time |
| POST | `/api/teams` | admin | Criar time |
| GET | `/api/teams/:id` | admin | Detalhes do time |
| PATCH | `/api/teams/:id/advance` | auth | Avançar etapa |
| DELETE | `/api/teams/:id` | admin | Excluir time |
| GET | `/api/chat/:teamId` | auth | Histórico de chat |
| POST | `/api/chat/:teamId` | auth | Enviar mensagem |
| GET | `/api/skill` | — | Listar versões |
| GET | `/api/skill/active` | — | Skill ativa |
| POST | `/api/skill` | admin | Salvar skill |
| POST | `/api/skill/:id/restore` | admin | Restaurar versão |
| GET | `/api/stats` | admin | Estatísticas |

---

## Chat com IA — Fluxo

1. Membro envia mensagem pelo frontend (`POST /api/chat/:teamId`)
2. Backend monta system prompt com:
   - Conteúdo completo da skill ativa (tabela `skill_versions`)
   - Estado atual da jornada (`current_stage`, progresso)
   - Últimas 20 mensagens do histórico
3. Backend chama Gemini API (`gemini-2.5-pro`) com o system prompt
4. Resposta da IA é salva em `chat_messages`
5. Se resposta contém `[ETAPA_CONCLUIDA: N]`:
   - Remove a tag do conteúdo exibido
   - Atualiza `team_progress` (stage N → completed)
   - Se N=7, marca `teams.status = 'completed'`
6. Frontend exibe resposta e anima stepper

---

## Detecção de Conclusão de Etapa

A resposta da IA pode conter: `[ETAPA_CONCLUIDA: N]` (N = 1 a 7)

- A tag é removida antes de exibir ao usuário
- O progresso é atualizado automaticamente no backend
- O frontend consulta o estado atual a cada 10s
- Admin ou membro clica em "Avançar Etapa" para ir à próxima

---

## Editor de Skill

- **Acesso:** `/skill-editor` (admin apenas)
- **Funcionalidades:**
  - Editar markdown completo da skill
  - Nomear versões
  - Salvar como nova versão ativa
  - Restaurar versão anterior
  - Máximo 5 versões (a ativa nunca é descartada)
- **Auditoria:** Toda alteração é registrada em `skill_audit_log`

---

## Variáveis de Ambiente — Referência

| Variável | Onde | Descrição |
|----------|------|-----------|
| `SUPABASE_URL` | `.env` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env` | Chave service role (backend) |
| `DATABASE_URL` | `.env` | Connection string PostgreSQL local |
| `FRONTEND_URL` | `.env` | URL do frontend (CORS) |
| `GEMINI_API_KEY` | `.env` | Chave Gemini API (fallback) |
| `VITE_SUPABASE_URL` | `.env.local` | URL do Supabase (frontend) |
| `VITE_SUPABASE_ANON_KEY` | `.env.local` | Chave anônima Supabase |

---

## Comandos

```bash
npm run dev            # Frontend (Vite, porta 5174)
npm run dev:server     # Backend (Express, porta 3001)
npm run build          # Build frontend produção
npm run lint           # ESLint
npm run typecheck      # TypeScript check
npx prisma generate    # Regenerar Prisma Client
npx prisma db push     # Sincronizar schema com banco
npx prisma db seed     # Seed (admin + skill inicial)
npx prisma studio      # UI do banco de dados
```

---

## Observações

- **Google OAuth:** O Supabase Auth é usado tanto em dev quanto em produção.
  Adicione `http://localhost:5174` como redirect URL autorizada no Google Cloud Console
  e no Supabase Auth settings.
- **Gemini:** Sem chave configurada, o chat retorna o system prompt gerado como fallback.
- **Banco local:** A tabela `auth.users` é uma mock. Em produção (Supabase), usa a tabela real.
- **Portas:** Frontend 5174, Backend 3001.
- **Proxy:** Vite faz proxy de `/api/*` para o backend em `localhost:3001`.
