#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# restart_server.sh
# Desafio ao MVP — PampaTec
# Para totalmente serviços locais e reinicia tudo.
# ─────────────────────────────────────────────────────────────

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

# ─── Cores ─────────────────────────────────────────────────
VERDE='\033[0;32m'
AMARELO='\033[1;33m'
VERMELHO='\033[0;31m'
CIANO='\033[0;36m'
RESET='\033[0m'

info()  { echo -e "${CIANO}[INFO]${RESET}  $1"; }
ok()    { echo -e "${VERDE}[OK]${RESET}    $1"; }
aviso() { echo -e "${AMARELO}[AVISO]${RESET} $1"; }
erro()  { echo -e "${VERMELHO}[ERRO]${RESET} $1"; }

# ─── Utilitários ────────────────────────────────────────────
cleanup() {
  info "Parando servidores..."
  kill "$BACKEND_PID" 2>/dev/null || true
  kill "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" 2>/dev/null || true
  wait "$FRONTEND_PID" 2>/dev/null || true
  ok "Servidores parados."
}
trap cleanup EXIT

# ─── 1. Verificar dependências ──────────────────────────────
info "Verificando dependências..."

command -v node >/dev/null 2>&1 || { erro "Node.js não encontrado"; exit 1; }
command -v npm  >/dev/null 2>&1 || { erro "npm não encontrado"; exit 1; }
command -v psql >/dev/null 2>&1 || { erro "psql não encontrado"; exit 1; }

NODE_VER=$(node --version)
NPM_VER=$(npm --version)
ok "Node.js $NODE_VER / npm $NPM_VER"

# ─── 2. Verificar PostgreSQL ────────────────────────────────
info "Verificando PostgreSQL..."
if pg_isready -q 2>/dev/null; then
  ok "PostgreSQL está rodando (localhost:5432)"
else
  erro "PostgreSQL não está rodando. Execute: sudo systemctl start postgresql"
  exit 1
fi

# ─── 3. Verificar / criar banco ─────────────────────────────
DB_EXISTE=$(psql -lqt 2>/dev/null | cut -d\| -f1 | tr -d ' ' | grep -c "^desafio_ao_mvp_local$" || true)
if [ "$DB_EXISTE" -eq 0 ]; then
  aviso "Banco 'desafio_ao_mvp_local' não existe. Criando..."
  createdb desafio_ao_mvp_local
  psql -d desafio_ao_mvp_local -c "
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY);
  " >/dev/null 2>&1
  ok "Banco criado com schema auth."
else
  # Garantir que schema auth existe
  SCHEMA_EXISTE=$(psql -d desafio_ao_mvp_local -t -c "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='auth'" 2>/dev/null | tr -d ' ')
  if [ "$SCHEMA_EXISTE" = "0" ]; then
    aviso "Schema 'auth' não existe. Criando..."
    psql -d desafio_ao_mvp_local -c "
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY);
    " >/dev/null 2>&1
  fi
  ok "Banco 'desafio_ao_mvp_local' OK."
fi

# ─── 4. Verificar .env ──────────────────────────────────────
if [ ! -f .env ]; then
  aviso "Arquivo .env não encontrado. Criando a partir de .env.example..."
  if [ -f .env.example ]; then
    cp .env.example .env
    aviso "Edite .env com suas credenciais antes de iniciar."
  else
    erro "Nenhum .env ou .env.example encontrado."
    exit 1
  fi
fi

if [ ! -f .env.local ]; then
  aviso "Arquivo .env.local não encontrado. Criando template..."
  cat > .env.local <<-EOF
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon_do_supabase
EOF
  aviso "Edite .env.local com suas credenciais do Supabase."
fi

# ─── 5. npm install ─────────────────────────────────────────
info "Instalando dependências (se necessário)..."
if [ ! -d node_modules ] || [ ! -f node_modules/.package-lock.json ]; then
  npm install
  ok "Dependências instaladas."
else
  ok "node_modules OK."
fi

# ─── 6. Prisma generate + push ──────────────────────────────
info "Sincronizando banco com Prisma..."
npx prisma generate >/dev/null 2>&1
npx prisma db push --accept-data-loss 2>&1 | grep -v "^$" | tail -1
ok "Schema sincronizado."

# ─── 7. Seed (se profiles vazio) ────────────────────────────
QTD_PROFILES=$(psql -d desafio_ao_mvp_local -t -c "SELECT COUNT(*) FROM profiles" 2>/dev/null | tr -d ' ')
if [ -z "$QTD_PROFILES" ] || [ "$QTD_PROFILES" -eq 0 ]; then
  info "Executando seed inicial..."
  npx prisma db seed >/dev/null 2>&1
  ok "Seed concluído (admin + skill inicial)."
else
  ok "Banco já possui dados — seed pulado."
fi

# ─── 8. Parar processos nas portas conflitantes ─────────────
info "Liberando portas..."
for PORT in 3001 5174; do
  PID=$(lsof -ti :"$PORT" 2>/dev/null || true)
  if [ -n "$PID" ]; then
    kill "$PID" 2>/dev/null || true
    sleep 0.3
    aviso "Porta $PORT liberada (PID $PID finalizado)"
  else
    ok "Porta $PORT livre"
  fi
done

# ─── 9. Iniciar backend ─────────────────────────────────────
info "Iniciando backend (Express, porta 3001)..."
npm run dev:server &
BACKEND_PID=$!
sleep 2

# Aguardar backend ficar pronto
for i in $(seq 1 10); do
  if curl -sf http://localhost:3001/api/health >/dev/null 2>&1; then
    ok "Backend rodando em http://localhost:3001"
    break
  fi
  if [ "$i" -eq 10 ]; then
    erro "Backend não iniciou após 10s."
    exit 1
  fi
  sleep 0.5
done

# ─── 10. Iniciar frontend ──────────────────────────────────
info "Iniciando frontend (Vite, porta 5174)..."
npm run dev &
FRONTEND_PID=$!
sleep 3

if curl -sf http://localhost:5174 >/dev/null 2>&1; then
  ok "Frontend rodando em http://localhost:5174"
else
  aviso "Aguardando frontend ficar pronto..."
  sleep 2
fi

# ─── 11. Verificar proxy ────────────────────────────────────
if curl -sf http://localhost:5174/api/health >/dev/null 2>&1; then
  ok "Proxy Vite → Backend funcionando"
else
  aviso "Proxy Vite pode não estar respondendo (normal se frontend ainda estiver compilando)"
fi

# ─── 12. Resumo final ───────────────────────────────────────
echo ""
echo -e "${VERDE}══════════════════════════════════════════════════════${RESET}"
echo -e "${VERDE}  Sistema rodando!${RESET}"
echo -e "${VERDE}  Frontend: http://localhost:5174${RESET}"
echo -e "${VERDE}  Backend:  http://localhost:3001${RESET}"
echo -e "${VERDE}  Health:   http://localhost:3001/api/health${RESET}"
echo -e "${VERDE}══════════════════════════════════════════════════════${RESET}"
echo ""
echo "  Pressione Ctrl+C para parar todos os servidores."
echo ""

wait
