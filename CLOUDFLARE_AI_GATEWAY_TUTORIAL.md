# Tutorial: Cloudflare AI Gateway

**O que é:** Um gateway unificado para rotear, observar e controlar requisições a modelos de IA (OpenAI, Anthropic, Google, Groq, DeepSeek, etc.) através da infraestrutura da Cloudflare.

**Funcionalidades principais:** cache de respostas, rate limiting, fallback entre provedores, logs, analytics, DLP, guardrails, e billing unificado.

---

## 1. Pré-requisitos

- Conta na Cloudflare (qualquer plano gratuita)
- **Account ID** — veja em: \`https://dash.cloudflare.com/\` → seu perfil → **Account ID**
- **API Token** — crie em: \`https://dash.cloudflare.com/profile/api-tokens\` com permissões:
  - \`AI Gateway - Read\`
  - \`AI Gateway - Edit\`
  - \`Workers AI - Read\`

---

## 2. Criar um Gateway

### Pelo Dashboard (recomendado)
1. Acesse: \`https://dash.cloudflare.com/\` → **AI** → **AI Gateway**
2. Clique em **Create Gateway**
3. Dê um nome (ex: \`meu-gateway\`, max 64 caracteres)

### Ou o gateway `default` é criado automaticamente
Na primeira requisição autenticada sem especificar gateway, a Cloudflare cria um gateway chamado \`default\` com autenticação e logs ligados, cache e rate limiting desligados.

---

## 3. Formas de Usar

### A. REST API (OpenAI-compat — recomendada para começar)

Endpoint unificado compatível com a SDK da OpenAI:

```
POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/v1/chat/completions
```

**Exemplo com cURL:**

```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/ai/v1/chat/completions" \
  --header "Authorization: Bearer $CF_API_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "model": "openai/gpt-4.1-mini",
    "messages": [{"role": "user", "content": "O que é Cloudflare?"}]
  }'
```

Troque \`model\` para qualquer provedor no formato \`{provider}/{model}\`:
| Provider | Exemplo |
|---|---|
| OpenAI | \`openai/gpt-4.1-mini\`, \`openai/gpt-5.2\` |
| Anthropic | \`anthropic/claude-sonnet-4-5\`, \`anthropic/claude-haiku-4-5\` |
| Google | \`google-ai-studio/gemini-2.5-flash\` |
| Groq | \`groq/llama-4-scout\` |
| DeepSeek | \`deepseek/deepseek-chat\` |
| xAI (Grok) | \`grok/grok-4\` |
| Workers AI | \`@cf/meta/llama-3.3-70b-instruct-fp8-fast\` |

### B. Endpoints Provider-Nativos (mesma SDK do provedor)

Use a URL base no lugar da URL original do provedor:

```
https://gateway.ai.cloudflare.com/v1/{ACCOUNT_ID}/{GATEWAY_NAME}/{provider}
```

**OpenAI SDK:**

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "SUA_OPENAI_API_KEY",
  baseURL: "https://gateway.ai.cloudflare.com/v1/{ACCOUNT_ID}/{GATEWAY}/openai",
});

const res = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello" }],
});
```

**Anthropic SDK:**

```javascript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: "SUA_ANTHROPIC_API_KEY",
  baseURL: "https://gateway.ai.cloudflare.com/v1/{ACCOUNT_ID}/{GATEWAY}/anthropic",
});

const msg = await anthropic.messages.create({
  model: "claude-sonnet-4-5",
  messages: [{ role: "user", content: "Hello" }],
  max_tokens: 1024,
});
```

### C. BYOK (Bring Your Own Key) / Billing Unificado

Em vez de passar a API key do provedor em cada requisição:

1. **BYOK:** Vá em **AI Gateway → Settings → Store Keys** e cadastre as chaves
2. **Unified Billing:** Compre créditos no dashboard da Cloudflare (5% de taxa, sem markup nos provedores)

Com isso ativo, a requisição fica mais limpa:

```bash
curl -X POST "https://gateway.ai.cloudflare.com/v1/$ACCOUNT_ID/$GATEWAY/openai/chat/completions" \
  --header "cf-aig-authorization: Bearer $CF_API_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

---

## 4. Cache de Respostas

Reduz latência e custos servindo respostas idênticas do cache.

**Ativar:** Dashboard → AI Gateway → Settings → **Cache Responses** (TTL em segundos, min 60s, max 1 mês)

**Headers por requisição:**

| Header | Efeito |
|---|---|
| \`cf-aig-cache-ttl: 3600\` | Cache por 1 hora |
| \`cf-aig-skip-cache: true\` | Ignorar cache, buscar do provedor |
| \`cf-aig-cache-key: minha-chave\` | Custom cache key |
| \`cf-cache-status: HIT/MISS\` | Response header para debug |

---

## 5. Rate Limiting

Controle quantas requisições passam em um intervalo de tempo.

**Ativar:** Dashboard → Settings → **Rate-limiting**

**Tipos:**
- **Fixed:** Janela fixa de tempo (ex: 100 req/60s)
- **Sliding:** Janela deslizante (ex: max 100 req nos últimos 10min)

Quando estoura, retorna HTTP \`429 Too Many Requests\`.

---

## 6. Dynamic Routing (Fallback, A/B Test, Budget)

Crie fluxos visuais sem mexer no código da aplicação.

**Exemplo de uso:** Usuário **paid** → \`o4-mini-high\` | Usuário **free** → \`gpt-4.1-mini\`

**Como criar (Dashboard):**
1. No gateway, vá em **Dynamic Routes → Add Route**
2. Nomeie (ex: \`customer-support\`)
3. Monte o fluxo: Start → Conditional → Model → End
4. No código, use o nome da rota no lugar do model:

```javascript
const res = await client.chat.completions.create({
  model: "dynamic/customer-support",
  messages: [{ role: "user", content: "Help" }],
});
```

**Tipos de nó:** Conditional, Percentage (A/B), Model, Rate Limit, Budget Limit.

---

## 7. Logging & Analytics

- **Analytics:** Número de requests, tokens, custo, erros
- **Logs:** Armazenados por até tempo determinado conforme plano:
  - Free: 100k logs no total
  - Paid: 10M logs por gateway
- **Logpush:** Exportar logs para armazenamento externo (s3, etc.) — plano Paid
- **OpenTelemetry:** Exportar traces para backends compatíveis

---

## 8. DLP (Data Loss Prevention) & Guardrails

- **DLP:** Escaneia prompts/respostas em busca de dados sensíveis (financeiro, identidade)
- **Guardrails:** Avalia conteúdo nocivo usando \`llama-guard-3-8b\` da Workers AI (cobrado como inferência Workers AI)

---

## 9. Preços

- **Core features (cache, rate limiting, analytics, logs):** Grátis
- **Billing Unificado:** 5% sobre créditos comprados; preço dos provedores é repassado sem markup
- **Guardrails:** Cobrado como Workers AI (token-based)
- **Logpush:** $0.05/milhão de requests (plano Paid)

---

## 10. Dicas Rápidas

| Situação | Solução |
|---|---|
| Primeiro teste | Usar REST API com cURL e gateway \`default\` |
| Migrar app existente | Trocar \`baseURL\` para o endpoint provider-nativo |
| Economizar | Ativar cache de respostas repetitivas |
| Não estourar budget | Rate limiting + Budget Limit no Dynamic Routing |
| App em produção | Ativar autenticação no gateway + BYOK |
| Debug | Header \`cf-aig-cache-status\` e logs no dashboard |

---

## Referências

- Documentação oficial: https://developers.cloudflare.com/ai-gateway/
- Provedores suportados: https://developers.cloudflare.com/ai-gateway/usage/providers/
- Preços: https://developers.cloudflare.com/ai-gateway/reference/pricing/
