#!/bin/bash

# Este script lista as contas do GitHub conectadas no 'gh' CLI e permite alternar entre elas.
# Também configura o nome e email do Git local se estiver em um repositório.

echo "--- 🐱 Gerenciador de Contas GitHub ---"

# Lista contas e marca a ativa
echo "Contas logadas atualmente:"
gh auth status

echo ""
echo "Digite o nome do usuário para o qual deseja alternar (ou pressione Enter para manter o atual):"
read -p "> " NEW_USER

if [ -n "$NEW_USER" ]; then
    echo "🔄 Alternando para $NEW_USER..."
    gh auth switch -u "$NEW_USER"
    
    if [ $? -eq 0 ]; then
        echo "✅ Sucesso! Agora você está usando a conta: $NEW_USER"
        
        # Opcional: Se estivermos em um repositório git, perguntar se quer configurar o local user
        if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
            echo ""
            read -p "Deseja configurar este repositório para usar o nome/email de $NEW_USER? (s/n): " SET_LOCAL
            if [[ "$SET_LOCAL" =~ ^[sS]$ ]]; then
                # Tenta pegar o email do perfil do gh
                GH_EMAIL=$(gh api user -q .email 2>/dev/null)
                if [ -z "$GH_EMAIL" ] || [ "$GH_EMAIL" == "null" ]; then
                    read -p "Não foi possível detectar o email. Digite o email para este commit: " GH_EMAIL
                fi
                
                git config user.name "$NEW_USER"
                git config user.email "$GH_EMAIL"
                echo "✅ Configurações locais atualizadas!"
            fi
        fi
    else
        echo "❌ Falha ao alternar conta. Verifique se o nome do usuário está correto."
    fi
else
    echo "Mantendo conta atual."
fi
