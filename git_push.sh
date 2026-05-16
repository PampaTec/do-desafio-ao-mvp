#!/bin/bash

# =================================================================
# CONFIGURAÇÕES DO PROJETO (Ajuste conforme necessário)
# =================================================================
GITHUB_USER="emersonrizzatti"       # O usuário que deve ser usado neste projeto
GITHUB_EMAIL="emersonrizzatti@unipampa.edu.br" # O email associado a este usuário
REPO_URL="https://github.com/PampaTec/do-desafio-ao-mvp.git"
# =================================================================

# Se um argumento for passado, usa como mensagem de commit.
COMMIT_MSG=${1:-"Atualização de arquivos"}

echo "--- 🛡️ Verificando Identidade GitHub ---"

# 1. Verifica qual conta do 'gh' está ativa no momento
ACTIVE_GH_USER=$(gh api user -q .login 2>/dev/null)

if [ "$ACTIVE_GH_USER" != "$GITHUB_USER" ]; then
    echo "⚠️ Conta atual ($ACTIVE_GH_USER) não é a correta para este projeto."
    echo "🔄 Alternando para a conta: $GITHUB_USER..."
    
    # Tenta alternar. Se a conta não estiver logada, o gh pedirá login.
    gh auth switch -u "$GITHUB_USER"
    
    if [ $? -ne 0 ]; then
        echo "❌ Erro ao alternar conta. Verifique se você está logado com 'gh auth login'."
        exit 1
    fi
else
    echo "✅ Já conectado como: $GITHUB_USER"
fi

# 2. Garante que o git local está usando o usuário/email corretos (evita commits com conta errada)
git config user.name "$GITHUB_USER"
git config user.email "$GITHUB_EMAIL"

# 3. Garante que o remote origin está usando a URL correta
git remote set-url origin "$REPO_URL"

echo "--- 🔄 Verificando Sincronização com GitHub ---"

# Busca atualizações do remoto
git fetch origin

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
BASE=$(git merge-base HEAD origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    echo "✅ Repositório local está sincronizado com o GitHub."
elif [ "$LOCAL" = "$BASE" ]; then
    echo "⚠️ Você está desatualizado (atrás do GitHub). Rodando git pull..."
    git pull origin main
elif [ "$REMOTE" = "$BASE" ]; then
    echo "🚀 Você tem alterações locais (à frente do GitHub). Preparando push..."
else
    echo "❌ Erro: Os repositórios divergiram (ambos têm novos commits)."
    echo "Por favor, resolva os conflitos manualmente antes de usar este script."
    exit 1
fi

echo "--- 🚀 Iniciando Push ---"

echo "Adicionando alterações (git add .)..."
git add .

# Verifica se há algo para commit
if git diff-index --quiet HEAD --; then
    echo "Nenhuma alteração para commitar."
else
    echo "Criando commit com a mensagem: '$COMMIT_MSG'..."
    git commit -m "$COMMIT_MSG"
fi

echo "Enviando para o GitHub (git push origin main)..."
git push origin main

echo "✨ Processo concluído com sucesso!"
