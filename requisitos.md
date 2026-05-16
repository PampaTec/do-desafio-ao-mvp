# Plano de desenvolvimento da aplicação "Meu MVP com IA" · PampaTec
> Versão 1.0.0 · 2026-05-13 · desenvolvendo com IA

---

## 1. PROMPT PARA DESENVOLVIMENTO

---

Crie uma aplicação web full-stack chamada **"Desafio ao MVP"** para o **PampaTec — Parque Tecnológico do Pampa**, fazendo parte do programa Startup Pampa. É uma plataforma de gestão da jornada de empreendedores guiada por IA, com dois perfis de usuário: **Administrador** (equipe PampaTec) e **Membro** (empreendedor do time).

---

## IDENTIDADE VISUAL (OBRIGATÓRIO — sem exceções)

- **Cor primária:** Verde `#00A859`
- **Cor secundária / texto:** Cinza `#727476`
- **Fundo escuro principal:** `#111111` ou `#0D0D0D`
- **Fundo de card / surface:** `#1A1A1A`
- **Texto sobre escuro:** `#F5F5F5`
- **Tipografia:** `Lily UPC` (Google Fonts ou similar — fallback: `'Nunito', sans-serif`)
- **Design:** Mobile-first, premium, vibrante, alto contraste. Dark theme como padrão.
- **Logotipo:** Renderize o logotipo PampaTec em versão negativo (fundo escuro): texto "PampaTec" em branco/cinza claro + arco de quadrados pixelados em verde `#00A859`. Use SVG inline ou imagem importada (`logo-pampatec.png`). Nunca use fundo claro no cabeçalho principal.
- **Botões primários:** Fundo `#00A859`, texto branco, border-radius `8px`, hover com leve brilho.
- **Botões secundários:** Borda `#00A859`, texto `#00A859`, fundo transparente.
- **Acentos e destaques:** Sempre em `#00A859`.
- **Sombras e separadores:** Sutis, tons escuros.

---

## STACK TÉCNICA

- **Frontend:** React + TypeScript + Tailwind CSS (Vite)
- **Backend:** Node.js + Express + TypeScript
- **Banco de dados:** PostgreSQL (Supabase)
- **ORM:** Prisma
- **IA:** Gemini API — modelo `gemini-2.5-pro` (ou mais recente disponível). O usuário faz login com Google (OAuth) e o backend utiliza o token de acesso OAuth para chamar a Gemini API em nome do usuário, consumindo a cota da própria conta Google do usuário. O escopo OAuth deve incluir permissão para a Gemini API.
- **Autenticação:** Supabase Auth (Google OAuth)
- **Deploy:** Render.com (100% gratuito) + Supabase (camada gratuita)

---

## BANCO DE DADOS (Supabase — esquema completo)

```sql
-- Usuários e perfis
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  google_id TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT CHECK (role IN ('admin', 'member')) DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Times de empreendedores
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  current_stage INT DEFAULT 1 CHECK (current_stage BETWEEN 1 AND 7),
  status TEXT CHECK (status IN ('active', 'completed', 'paused')) DEFAULT 'active'
);

-- Membros de cada time
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  invited_email TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- Histórico de chat por time
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user', 'assistant', 'system')) NOT NULL,
  content TEXT NOT NULL,
  stage INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Progresso por etapa
CREATE TABLE team_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  stage INT NOT NULL CHECK (stage BETWEEN 1 AND 7),
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed')) DEFAULT 'pending',
  stage_output TEXT,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Versões da skill
CREATE TABLE skill_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_label TEXT NOT NULL,
  content_md TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT FALSE
);

-- Log de auditoria do editor de skill
CREATE TABLE skill_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  fields_changed JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## AUTENTICAÇÃO E CONTROLE DE ACESSO

- Login via **conta google**
- Cadastro de novos usuários 
- Após login, o backend verifica o campo `role` na tabela `profiles`:
  - `role = 'admin'` → redireciona para `/admin`
  - `role = 'member'` → redireciona para `/team`
- Admins são cadastrados manualmente pelo time PampaTec (seed inicial ou painel)
- Novos usuários via cadastro são criados como `member` por padrão
- Implemente middleware de rota protegida para todas as páginas autenticadas

---

## PÁGINAS E ROTAS

### `/` — Landing / Login
- Logo PampaTec centralizado em fundo escuro
- Tagline: *"Do desafio ao protótipo em 7 etapas guiadas por IA"*
- Botão: `Entrar com Google`
- Rodapé: "Programa Startup Pampa · PampaTec"

### `/admin` — Painel do Administrador
- Header com logo + nome do admin + botão logout
- Cards de métricas: Times ativos / Etapas concluídas / Membros cadastrados
- Lista de todos os times com: nome do projeto, etapa atual (barra de progresso 1–7), status, data de criação
- Botão "Novo Time"
- Link para `/skill-editor`

### `/admin/new-team` — Criar Novo Time
- Formulário: Nome do Projeto + campo para adicionar e-mails dos membros (chips/tags)
- Botão "Criar Time" → cria registro em `teams` e `team_members`
- Redireciona para `/admin/team/:id`

### `/admin/team/:id` — Gerenciar Time (Admin)
- Visualização completa do time: membros, etapa atual, histórico de chat (somente leitura para o admin), progresso por etapa
- Indicador visual de progresso nas 7 etapas (stepper horizontal ou vertical)
- Botão para adicionar novos membros
- Botão para remover membros
- Botão para arquivar ou excluir time

### `/waiting` — Aguardando Time
- Logo PampaTec centralizado
- Mensagem: "Aguardando seu time ser criado pelo PampaTec"
- Botão "Sair" (logout)
- Sem acesso a chat ou admin
- Redirecionamento automático para `/team` quando o time for criado

### `/team` — Painel do Membro / Chat Principal
Layout de chat profissional, mobile-first:
- Header: logo PampaTec + nome do projeto do time + etapa atual
- **Área de chat:** histórico de mensagens com diferenciação visual clara entre `user` (balão direita, verde) e `assistant` (balão esquerda, cinza escuro com borda verde sutil)
- **Stepper de progresso:** 7 etapas com ícones (CYNEFIN, Empatia, 5 Porquês, Crazy Eights, 5W2H, Canvas de Contexto, Protótipo). Etapa atual destacada em verde.
- **Input de mensagem:** textarea responsivo + botão Enviar
- **Indicador de digitação** (três pontos animados) enquanto a IA responde
- Streaming da resposta da IA (character by character ou chunk by chunk)

### `/skill-editor` — Editor de Skill (Admin only)
Formulário estruturado em abas. **Nunca exibe o Markdown bruto.**

**Abas do formulário:**

| Aba | Campos |
|-----|--------|
| Perfil do Agente | Nome, Role, Objetivo, Tom de Voz |
| Etapa 1 — CYNEFIN | Objetivo, Pergunta Socrática (editável), Instrução do Prompt Interno |
| Etapa 2 — Empatia | Objetivo, Perguntas ao usuário (lista editável), Instrução do Prompt Interno |
| Etapa 3 — 5 Porquês | Objetivo, Pergunta Socrática, Instrução do Prompt Interno |
| Etapa 4 — Crazy Eights | Objetivo, Pergunta Socrática, Instrução do Prompt Interno |
| Etapa 5 — 5W2H | Objetivo, Perguntas Socráticas (lista), Instrução do Prompt Interno |
| Etapa 6 — Canvas | Objetivo, Pergunta Socrática, 8 Blocos (lista editável) |
| Etapa 7 — Protótipo | Objetivo, Plataformas disponíveis (lista editável), Instrução do Prompt Interno |
| Análise Crítica Final | Instrução de Visão Sistêmica, Elo Mais Fraco, MVP |
| Prompt Final | Texto de encerramento e opções de plataformas |

**Funcionalidades do editor:**
- Validação em tempo real (campos obrigatórios, listas com ≥ 1 item)
- Indicador: *"Skill em uso por X times ativos"* antes de salvar
- Botão **"Salvar Skill"** → reconstrói o `.md`, salva em `skill_versions` como versão ativa, registra em `skill_audit_log`
- Botão **"Restaurar versão anterior"** → lista as últimas 5 versões com data, permite rollback com 1 clique
- Botão **"Testar Skill"** → abre modal com chat simulado usando a versão atual (não afeta times ativos)
- Toast de confirmação: *"Skill atualizada com sucesso"*

---

## LÓGICA DO CHAT COM IA (CRÍTICO)

### System Prompt dinâmico
A cada mensagem enviada pelo membro, monte o system prompt assim:

```
[CONTEÚDO COMPLETO DA SKILL ATIVA — skill_versions WHERE is_active = true]

---

ESTADO ATUAL DA JORNADA DO TIME:
- Etapa atual: [current_stage]
- Etapas concluídas: [lista de etapas com status 'completed']
- Outputs registrados por etapa: [stage_output de cada etapa concluída]

HISTÓRICO DESTA SESSÃO:
[Últimas 20 mensagens do chat_messages do time, em ordem cronológica]

INSTRUÇÕES DE ENCERRAMENTO (incluir apenas se current_stage >= 6):
- Análise Crítica Final: [campos da aba Análise Crítica Final da skill ativa]
- Prompt Final: [campos da aba Prompt Final da skill ativa]
```

### Detecção de conclusão de etapa
A resposta da IA pode sinalizar conclusão de etapa com a tag:
`[ETAPA_CONCLUIDA: N]` onde N é o número da etapa (1–7).

Ao detectar essa tag na resposta:
1. Remover a tag da mensagem exibida ao usuário
2. Atualizar `team_progress` (stage N → status 'completed', salvar stage_output)
3. Se N < 7: `teams.current_stage` avança somente quando o próprio usuário ou admin solicitar explicitamente (botão "Avançar etapa" na UI)
4. Se N = 7: marcar `teams.status = 'completed'` e exibir tela de jornada finalizada
5. Animar o stepper de progresso na UI

### Persistência
- Salvar toda mensagem em `chat_messages` (team_id, role, content)
- A coluna `stage` é preenchida apenas quando a mensagem contém a tag `[ETAPA_CONCLUIDA: N]`, armazenando o número da etapa concluída (após remover a tag do `content`)
- Carregar histórico completo ao abrir `/team`

---

## COMPONENTES UI ESSENCIAIS

### ChatBubble
```
- role='user': fundo #00A859 opaco 20%, borda esquerda #00A859, alinhado à direita
- role='assistant': fundo #1A1A1A, borda esquerda #727476, alinhado à esquerda
- Timestamp sutil abaixo de cada mensagem
- Avatar: ícone de usuário (membro) ou logo PampaTec miniatura (assistente)
```

### StageProgressStepper
```
7 etapas com ícones distintos:
1. 🔍 CYNEFIN
2. 🧠 Empatia  
3. 🌱 5 Porquês
4. 💡 Crazy Eights
5. 📋 5W2H
6. 🌐 Canvas
7. 🚀 Protótipo

- Etapa concluída: círculo verde sólido com ✓
- Etapa atual: círculo verde pulsante com número
- Etapa pendente: círculo cinza com número
- Linha conectora entre etapas (verde nas concluídas, cinza nas pendentes)
```

### Toast / Notificações
- Sucesso: borda e ícone verde `#00A859`
- Erro: borda e ícone vermelho
- Aviso: borda e ícone âmbar

---

## REGRAS DE NEGÓCIO

1. Um membro só acessa o time ao qual pertence (via `team_members`)
2. Um admin acessa todos os times
3. A skill ativa é única (apenas 1 registro com `is_active = true`)
4. Máximo de 5 versões da skill armazenadas; ao salvar a 6ª, a versão não-ativa mais antiga é descartada. A versão ativa nunca é descartada.
5. O histórico de chat de times existentes não é alterado ao atualizar a skill
6. A nova skill entra em vigor imediatamente para novas mensagens
7. Membros não têm acesso ao `/skill-editor` nem ao `/admin`

---

## FLUXOS COMPLETOS A IMPLEMENTAR

### Fluxo 1 — Primeiro acesso do membro
```
Login → perfil criado como 'member' → verifica team_members → 
se tem time: /team → carrega histórico → chat ativo
se não tem time: /waiting — "Aguardando seu time ser criado pelo PampaTec"
```

### Fluxo 2 — Admin cria time
```
/admin → "Novo Time" → preenche nome + e-mails → 
cria team + team_members com invited_email →
membros recebem e-mail de convite com magic link (Supabase Auth) →
se o membro já tem conta Google e o e-mail bate com invited_email, vincula automaticamente ao time →
se não, o magic link permite criar conta e o vincula ao time na primeira autenticação
```

### Fluxo 3 — Chat e progressão de etapas
```
Membro abre /team → histórico carregado →
digita mensagem → salva em chat_messages →
monta systemPrompt (skill + estado + histórico) →
chama Gemini API com streaming →
exibe resposta chunk a chunk →
salva resposta em chat_messages →
detecta [ETAPA_CONCLUIDA: N] → atualiza progresso → anima stepper
```

### Fluxo 4 — Admin edita skill
```
/skill-editor → carrega versão ativa → exibe formulário preenchido →
admin edita → validação em tempo real →
"Salvar Skill" → monta .md → salva nova versão → 
registra audit_log → toast confirmação
```

---

## DETALHES DE UX MOBILE-FIRST

- **Chat:** altura 100dvh, header fixo, input fixo no rodapé, área de mensagens com scroll
- **Stepper:** em mobile, exibir horizontal com scroll ou recolhível (accordeon)
- **Admin painel:** cards empilhados em mobile, grid em desktop
- **Editor de skill:** abas com scroll horizontal em mobile
- **Touch targets:** mínimo 44x44px em todos os botões
- **Fontes:** mínimo 16px no body para evitar zoom automático no iOS
- **Teclado virtual:** o input de chat não deve ser coberto pelo teclado (usar `dvh`)

---

## SEED INICIAL (para desenvolvimento)

```sql
-- Admin inicial
INSERT INTO profiles (id, google_id, email, name, role) VALUES 
  ('uuid-admin-1', 'google-oauth-id-admin', 'admin@pampatec.org', 'Equipe PampaTec', 'admin');

-- Versão inicial da skill (cole o conteúdo completo do arquivo skill-desafio-ao-mvp.md)
INSERT INTO skill_versions (version_label, content_md, created_by, is_active) VALUES 
  ('v1.1.0 — inicial', '[CONTEÚDO DO ARQUIVO skill-desafio-ao-mvp.md]', 'uuid-admin-1', true);
```

**Nota:** O `google_id` deve ser obtido do payload do token OAuth do Google no momento do login.

---

## RESULTADO ESPERADO

Uma aplicação web funcional, mobile-first, visualmente premium com identidade PampaTec, onde:
- Admins gerenciam times e editam a skill de IA de forma segura e intuitiva
- Membros têm uma experiência de chat profissional com o consultor de Design Thinking guiado por IA
- Todo o progresso é persistido e rastreável
- A skill pode ser evoluída sem impactar times em andamento

**Comece pela autenticação e estrutura de rotas, depois o chat com IA, depois o editor de skill.**

---

## PLANO DE IMPLANTAÇÃO (LOCALHOST-FIRST)

O desenvolvimento segue uma estratégia **local-first**: todo o sistema é desenvolvido e testado
localmente antes de qualquer deploy em produção. O PostgreSQL roda local, o Prisma sincroniza
o schema, e a Gemini API é consumida via chave de API (fallback).

---

### Etapa 1 — Setup do Ambiente Local

| Atividade | Status | Descrição |
|-----------|--------|-----------|
| 1.1 Inicializar projeto | ✅ | Vite + React + Express + TypeScript configurados |
| 1.2 Configurar PostgreSQL local | ✅ | Banco `desafio_ao_mvp_local`, schema `auth`, tabela mock `auth.users` |
| 1.3 Schema Prisma + push | ✅ | 7 modelos (profiles, teams, team_members, chat_messages, team_progress, skill_versions, skill_audit_log) |
| 1.4 Seed inicial | ✅ | Admin `admin@pampatec.org` + skill inicial de `skill-desafio-ao-mvp.md` |
| 1.5 Variáveis de ambiente | ✅ | `.env` (backend) e `.env.local` (frontend) criados |
| 1.6 ESLint + TypeScript | ✅ | `eslint .` limpo, `tsc --noEmit` limpo |
| 1.7 Servidores rodando | ✅ | Backend `localhost:3001`, Frontend `localhost:5174` |

### Etapa 2 — Autenticação e Rotas

| Atividade | Status | Descrição |
|-----------|--------|-----------|
| 2.1 Supabase Auth + Google OAuth | 🔧 | Configurado no frontend; requer credenciais Supabase |
| 2.2 AuthContext + ProtectedRoute | ✅ | Provider de sessão, rotas protegidas por role |
| 2.3 Landing `/` | ✅ | Logo PampaTec + "Entrar com Google" |
| 2.4 Redirecionamento condicional | ✅ | role=admin → `/admin`, member c/ time → `/team`, member s/ time → `/waiting` |

### Etapa 3 — Portal do Administrador

| Atividade | Status | Descrição |
|-----------|--------|-----------|
| 3.1 Layout Admin (`/admin`) | ✅ | Header, cards de métricas, lista de times |
| 3.2 Criar Time (`/admin/new-team`) | ✅ | Nome do projeto + chips de e-mails |
| 3.3 Gerenciar Time (`/admin/team/:id`) | ✅ | Membros, stepper, histórico de chat |
| 3.4 Avançar/Excluir time | ✅ | Controle manual de current_stage |

### Etapa 4 — Chat com IA

| Atividade | Status | Descrição |
|-----------|--------|-----------|
| 4.1 Layout Chat (`/team`) | ✅ | Header, área de mensagens, input (100dvh) |
| 4.2 Página `/waiting` | ✅ | Tela para membros sem time |
| 4.3 ChatBubble component | ✅ | User verde dir., Assistant cinza esq. |
| 4.4 StageProgressStepper | ✅ | 7 etapas com ícones, estados visual |
| 4.5 Integração Gemini API | ✅ | System prompt dinâmico + detecção `[ETAPA_CONCLUIDA:N]` |
| 4.6 Persistência de mensagens | ✅ | Salvar/carregar de `chat_messages` |
| 4.7 Indicador de digitação | ✅ | Três pontos animados |

### Etapa 5 — Editor de Skill

| Atividade | Status | Descrição |
|-----------|--------|-----------|
| 5.1 Editor de Skill (`/skill-editor`) | ✅ | Edição de markdown + versionamento |
| 5.2 Salvar versão | ✅ | Recontruir, salvar em `skill_versions`, ativar |
| 5.3 Limite de 5 versões | ✅ | Versão não-ativa mais antiga descartada |
| 5.4 Restaurar versão | ✅ | Rollback com 1 clique |
| 5.5 Audit log | ✅ | Registro em `skill_audit_log` |

### Etapa 6 — Refinamento

| Atividade | Status | Descrição |
|-----------|--------|-----------|
| 6.1 Responsividade mobile | ✅ | `100dvh`, touch targets 44x44px, scroll |
| 6.2 Animações | ✅ | Stepper pulsante, toast, bounce typing |
| 6.3 Loading/Error states | ✅ | Skeletons, fallbacks, tratamento de erros |

### Etapa 7 — Qualidade

| Atividade | Status | Descrição |
|-----------|--------|-----------|
| 7.1 TypeScript check | ✅ | `tsc --noEmit` limpo |
| 7.2 ESLint | ✅ | `eslint .` limpo |
| 7.3 Testes | ⏳ | Pendente (Jest + Playwright) |

### Etapa 8 — Deploy Futuro (Render + Supabase)

| Atividade | Status | Descrição |
|-----------|--------|-----------|
| 8.1 Deploy Backend no Render | ⏳ | Web Service Node.js |
| 8.2 Deploy Frontend no Render | ⏳ | Static Site |
| 8.3 Supabase produção | ⏳ | Google OAuth configurado, migrations aplicadas |

---

### Arquitetura da aplicação (localhost)

```
┌──────────────────────────────────────────────────────────┐
│                   Vite Dev Server                         │
│            http://localhost:5174                          │
│   Proxy reverso: /api/* → http://localhost:3001          │
└──────────┬─────────────────────────────────┬─────────────┘
           │                                  │
           ▼                                  ▼
┌──────────────────┐           ┌──────────────────────────┐
│  React App       │           │  Express API Server       │
│  (HMR)           │           │  Porta 3001               │
│                  │           ├──────────────────────────┤
│  Auth: Supabase  │           │  Prisma ORM               │
│  Client SDK      │           │  Gemini API SDK           │
└──────────────────┘           └────────┬─────────────────┘
                                        │
                                        ▼
                             ┌──────────────────────┐
                             │   PostgreSQL 16       │
                             │   banco local         │
                             └──────────────────────┘
```

### Variáveis de ambiente (localhost)

```env
# Backend (.env)
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
DATABASE_URL=postgres://usuario:senha@localhost:5432/desafio_ao_mvp_local
FRONTEND_URL=http://localhost:5174
GEMINI_API_KEY=sua_chave_gemini

# Frontend (.env.local)
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon
```

**Nota:** A Gemini API é chamada com chave de API (`GEMINI_API_KEY`) no ambiente local.
Em produção, pode-se usar o token OAuth do usuário logado (escopo Gemini),
configurado via Supabase e Google Cloud Console.
