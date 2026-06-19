# Plano de Migração: Gemini → Cloudflare Workers AI

## Objetivo

Substituir a API Google Gemini (`gemini-2.5-flash`) pelo **Cloudflare AI Gateway** com **fallback automático entre múltiplos provedores** (Workers AI, Groq, DeepSeek, etc.), eliminando a dependência do SDK `@google/generative-ai` e do sistema de rodízio de chaves Gemini.

---

## 1. Credenciais Necessárias

| Variável | Valor |
|---|---|
| `CLOUDFLARE_API_TOKEN` | `[VALOR OCULTADO]` |
| `CLOUDFLARE_ACCOUNT_ID` | `[VALOR OCULTADO]` |
| `CLOUDFLARE_GATEWAY_NAME` | `nome-do-seu-gateway` |

Endpoint Universal (Cloudflare AI Gateway - Recomendado para rotear múltiplos provedores):
```
POST https://gateway.ai.cloudflare.com/v1/{ACCOUNT_ID}/{GATEWAY_NAME}
```
*Nota: Chaves do Groq e DeepSeek precisam ser configuradas no painel do Cloudflare AI Gateway (BYOK) para que o Gateway possa rotear para eles.*

---

## 2. Arquivos a Modificar

### 2.1 `package.json`
- **Remover** dependência: `"@google/generative-ai": "^0.24.1"`
- **Manter** `googleapis` e `google-auth-library` (ainda usados para Google Sheets e OAuth)
- **Não** adicionar SDK nova — usaremos `fetch` nativo (Node 18+) para chamar a API REST OpenAI-compatível

### 2.2 `server/services/geminiKeyRotation.ts` → **renomear para `cloudflareAi.ts`**
- Substituir lógica de rodízio de chaves Gemini por cliente Cloudflare AI Gateway. A lógica de **fallback será delegada 100% para a Cloudflare**, removendo complexidade do nosso código.
- **Lê do ambiente:**
  - `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_GATEWAY_NAME`
- **Novo fluxo da função `callCloudflareAI(messages)`:**
  1. Faz apenas 1 requisição POST para o Endpoint Universal do AI Gateway.
  2. Envia um array de provedores (targets) na configuração de Fallback.
  3. A própria Cloudflare tentará o próximo provedor se houver falha (429, 5xx ou timeout definido no Gateway).
  4. Retorna a resposta ao usuário ou retorna `503` se todos os targets configurados falharem.
- Formato do payload (AI Gateway com Múltiplos Targets em caso de fallback):
```json
[
  {
    "provider": "workers-ai",
    "endpoint": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    "headers": {
      "Authorization": "Bearer $CLOUDFLARE_API_TOKEN",
      "Content-Type": "application/json"
    },
    "query": { "messages": [ { "role": "user", "content": "..." } ] }
  },
  {
    "provider": "groq",
    "endpoint": "chat/completions",
    "query": { "model": "llama-3.3-70b-versatile", "messages": [ { "role": "user", "content": "..." } ] }
  }
]
```
*(As chaves do Groq/DeepSeek e afins devem ser configuradas na interface do AI Gateway em Configurações > "Provider APIs").*

### 2.3 `server/routes/chat.ts`
- **Remover** imports:
  - `import { type Content } from '@google/generative-ai'`
  - `import { getAvailableKey, markKeyFailed, markKeySuccess, createGeminiClient, getKeyCount } from '...geminiKeyRotation'`
- **Adicionar** import: `import { callCloudflareAI } from '../services/cloudflareAi.js'`
- Remover checagem `getKeyCount() === 0` (trocar por checagem de existência do token)
- Remover construção de `history: Content[]` (o histórico agora vai no array `messages`)
- No lugar de `genAI.getGenerativeModel(...)` + `chat.sendMessage(...)`, chamar `callCloudflareAI(messages, systemContent)`
- **Atenção:** Modelos open-source podem ser mais verborrágicos. Reforçar o `systemContent` para NUNCA adicionar formatações (ex: markdown `**`) e retornar APENAS a tag `[ETAPA_CONCLUIDA:N]`.
- Manter lógica de parse do `[ETAPA_CONCLUIDA:N]` e salvamento em sheets (não muda)
- Estrutura do array `messages` (ordem: system, histórico, user):
```javascript
const messages = [
  { role: 'system', content: systemContent },
  ...recentMessages.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  })),
  { role: 'user', content },
]
```

### 2.4 `.env` / `.env-render` / `.env.example`
- **Remover**: `GEMINI_API_KEY`, `GEMINI_API_KEYS`
- **Adicionar**: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_GATEWAY_NAME`
- **Opcional (se não configurar no painel)**: `GROQ_API_KEY`, `DEEPSEEK_API_KEY`

### 2.5 `README.md` e documentação
- Atualizar referências de `gemini-2.5-pro` / `gemini-2.5-flash` para `Cloudflare Workers AI`
- Atualizar setup de env vars

---

## 3. Decisões Técnicas

| Aspecto | Antes (Gemini) | Depois (Cloudflare AI) |
|---|---|---|
| SDK | `@google/generative-ai` | `fetch` nativo (REST) |
| Modelo | `gemini-2.5-flash` (fixo) | Array de requisições com targets de Fallback |
| Fallback | Rodízio no código Node.js | **Nativo no Gateway Cloudflare** (zero código no nosso backend) |
| System prompt | Parâmetro `systemInstruction` no modelo | Mensagem com `role: "system"` no array |
| Histórico | `startChat({ history })` com `role: "model"` | Mensagens no array com `role: "assistant"` |
| Autenticação | API key no SDK | Bearer token no header HTTP |
| Rate limit | Bloqueio de 60s por chave + rodízio | Gateway gerencia as chamadas sucessivas |
| Lentidão | Sem detecção | Gateway pode avançar o fallback e temos timeout total de 15~20s. |
| Custo | Gratuito (cota limitada Gemini) | Cota Workers AI + Necessita Keys (Free Tier) de Groq/DeepSeek |
| Cache | Inexistente | Cache nativo via AI Gateway ativado |

---

## 4. Prioridade de Fallback entre Provedores

*Aviso: Com exceção dos modelos nativos da Cloudflare (`@cf/`), **todos** os demais provedores exigem chaves próprias configuradas (BYOK) no dashboard do Gateway Cloudflare.*

| Prioridade | Model ID / Modelo | Provedor | Necessita Chave Própria (BYOK)? |
|---|---|---|---|
| 1ª | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Workers AI | **Não** (Usa limites da sua cota CF) |
| 2ª | `@cf/meta/llama-3.1-8b-instruct` | Workers AI | **Não** (Usa limites da sua cota CF) |
| 3ª | `llama-3.3-70b-versatile` | Groq | **Sim** (Inserir Key do Groq no Painel) |
| 4ª | `deepseek-chat` | DeepSeek | **Sim** (Inserir Key da DeepSeek no Painel) |
| 5ª | `gemini-2.5-flash` | Google | **Sim** (Inserir Key do Google no Painel) |

---

## 5. Tratamento de Erros com Fallback

Com o **AI Gateway**, o controle de erros fica muito mais limpo:

| Condição | Ação |
|---|---|
| `429` (Quota) / `5xx` (Erro) | Cloudflare AI Gateway detecta erro no provider atual e tenta imediatamente o próximo. |
| Timeout > 15-20s sem resposta | Nossa chamada local ao Gateway encerra, ou o Gateway aborta o provider lento e tenta outro. |
| Todos provedores falham | Nossa função retorna `503 Service Unavailable`, informando o erro. |
| Sucesso | O Gateway repassa a resposta e opcionalmente salva no Cache. |

---

## 6. Etapas da Migração

1. Renomear e reescrever `geminiKeyRotation.ts` → `cloudflareAi.ts`
2. Atualizar `chat.ts` para usar `callCloudflareAI` em vez do Gemini SDK
3. Atualizar `.env`, `.env.example`, `.env-render` (trocar variáveis)
4. Remover `@google/generative-ai` do `package.json`
5. Rodar `npm install` para remover dependência
6. Atualizar README e docs
7. Testar funcionalidade completa (chat, detecção de etapa concluída, sheets)
8. Remover arquivo antigo `geminiKeyRotation.ts` (após confirmar que nada mais importa)
9. Fazer commit e push da branch `cloudflare-ai`
