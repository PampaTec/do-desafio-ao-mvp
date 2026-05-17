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

NODE_VER=$(node --version)
NPM_VER=$(npm --version)
ok "Node.js $NODE_VER / npm $NPM_VER"

# ─── 2. Verificar .env ──────────────────────────────────────
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

# ─── 3. npm install ─────────────────────────────────────────
info "Instalando dependências (se necessário)..."
if [ ! -d node_modules ] || [ ! -f node_modules/.package-lock.json ]; then
  npm install
  ok "Dependências instaladas."
else
  ok "node_modules OK."
fi

# ─── 4. Inicializar planilha Google (se admin logado) ───────
if [ -f .admin-tokens.json ]; then
  info "Tokens admin encontrados. Verificando abas da planilha..."
  if npm run sheets:init 2>/dev/null; then
    ok "Planilha OK."
  else
    aviso "Não foi possível inicializar a planilha. Faça login como admin primeiro."
  fi
else
  aviso "Nenhum token admin. As abas serão criadas automaticamente no primeiro login."
fi

# ─── 5. Parar processos nas portas conflitantes ─────────────
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

# ─── 6. Iniciar backend ─────────────────────────────────────
info "Iniciando backend (Express, porta 3001)..."
npm run dev:server &
BACKEND_PID=$!
sleep 2

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

# ─── 7. Iniciar frontend ────────────────────────────────────
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

# ─── 8. Verificar proxy ─────────────────────────────────────
if curl -sf http://localhost:5174/api/health >/dev/null 2>&1; then
  ok "Proxy Vite → Backend funcionando"
else
  aviso "Proxy Vite pode não estar respondendo (normal se frontend ainda estiver compilando)"
fi

# ─── 9. Resumo final ────────────────────────────────────────
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
