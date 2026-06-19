#!/bin/bash
# =============================================
# Carrega a skill do arquivo para o sistema
# Uso: ./scripts/load-skill.sh [URL_BACKEND]
# =============================================

BACKEND=${1:-"https://do-desafio-ao-mvp.onrender.com"}
SKILL_FILE="skill-desafio-ao-mvp.md"

if [ ! -f "$SKILL_FILE" ]; then
  echo "❌ Arquivo $SKILL_FILE não encontrado!"
  exit 1
fi

echo "📄 Lendo $SKILL_FILE..."
CONTENT=$(cat "$SKILL_FILE")

# Escapa o conteúdo para JSON
JSON_CONTENT=$(python3 -c "
import json, sys
with open('$SKILL_FILE', 'r') as f:
    content = f.read()
print(json.dumps({'versionLabel': 'v1.0.0', 'contentMd': content}))
")

echo "🌐 Enviando para $BACKEND/api/skill ..."
echo ""
echo "⚠️  Este endpoint requer sessão de admin."
echo "   Copie o cookie da sessão do navegador (F12 → Application → Cookies → pampatec-session)"
echo ""
read -p "Cole o valor do cookie 'pampatec-session': " COOKIE_VALUE

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$BACKEND/api/skill" \
  -H "Content-Type: application/json" \
  -b "pampatec-session=$COOKIE_VALUE" \
  -d "$JSON_CONTENT")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "201" ]; then
  echo "✅ Skill carregada com sucesso!"
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
  echo "❌ Erro ($HTTP_CODE): $BODY"
fi
