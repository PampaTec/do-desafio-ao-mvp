interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ModelState {
  model: string
  provider: string
  blockedUntil: number
  failCount: number
}

interface CloudflareChoice {
  index: number
  message: { role: string; content: string }
  finish_reason: string
}

interface CloudflareResponse {
  id: string
  object: string
  created: number
  model: string
  choices: CloudflareChoice[]
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

const MODEL_PRIORITY: { model: string; provider: string }[] = [
  { model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', provider: 'Workers AI' },
  { model: '@cf/meta/llama-4-scout-17b-16e-instruct', provider: 'Workers AI (leve)' },
  { model: 'groq/llama-4-scout', provider: 'Groq' },
  { model: 'deepseek/deepseek-chat', provider: 'DeepSeek' },
  { model: 'google-ai-studio/gemini-2.5-flash', provider: 'Google (BYOK)' },
  { model: 'openai/gpt-4.1-mini', provider: 'OpenAI (BYOK)' },
]

const TIMEOUT_MS = 15_000
const BLOCK_429_MS = 60_000
const BLOCK_5XX_MS = 30_000

const modelStates: ModelState[] = MODEL_PRIORITY.map(m => ({
  model: m.model,
  provider: m.provider,
  blockedUntil: 0,
  failCount: 0,
}))

function getToken(): string | null {
  return process.env.CLOUFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || null
}

function getAccountId(): string | null {
  return process.env.CLOUDFLARE_ACCOUNT_ID || null
}

function isConfigured(): boolean {
  return !!getToken() && !!getAccountId()
}

function getConfigError(): string | null {
  if (!getToken()) return 'CLOUDFLARE_API_TOKEN não configurado'
  if (!getAccountId()) return 'CLOUDFLARE_ACCOUNT_ID não configurado'
  return null
}

function getAvailableModel(): { model: string; provider: string } | null {
  const now = Date.now()

  const firstAvailable = modelStates.find(s => s.blockedUntil <= now)
  if (!firstAvailable) {
    const soonest = modelStates.reduce((a, b) => a.blockedUntil < b.blockedUntil ? a : b)
    console.warn(`[cloudflare-ai] Todos os modelos bloqueados. Desbloqueia em ${Math.ceil((soonest.blockedUntil - now) / 1000)}s (${soonest.provider})`)
    return null
  }

  return { model: firstAvailable.model, provider: firstAvailable.provider }
}

function markModelFailed(modelName: string, is429: boolean) {
  const state = modelStates.find(s => s.model === modelName)
  if (!state) return

  state.failCount++
  state.blockedUntil = Date.now() + (is429 ? BLOCK_429_MS : BLOCK_5XX_MS)
  console.warn(`[cloudflare-ai] ${state.provider} (${modelName}) bloqueado por ${is429 ? '60s (429)' : '30s (erro)'}, fail #${state.failCount}`)
}

function markModelSuccess(modelName: string) {
  const state = modelStates.find(s => s.model === modelName)
  if (!state) return
  state.failCount = 0
  state.blockedUntil = 0
}

function resetAllModels() {
  for (const s of modelStates) {
    s.blockedUntil = 0
    s.failCount = 0
  }
}

export async function callCloudflareAI(messages: ChatMessage[]): Promise<string> {
  if (!isConfigured()) {
    throw new Error(getConfigError() || 'Cloudflare AI não configurado')
  }

  const token = getToken()!
  const accountId = getAccountId()!
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`

  const lastError: { status?: number; message: string } = { message: '' }

  for (let attempt = 0; attempt < modelStates.length; attempt++) {
    const entry = getAvailableModel()
    if (!entry) break

    const { model, provider } = entry

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })

      if (!res.ok) {
        const status = res.status
        const body = await res.text().catch(() => '')

        if (status === 429) {
          markModelFailed(model, true)
          console.warn(`[cloudflare-ai] ${provider}: 429 (quota), tentando próximo modelo...`)
          continue
        }

        if (status >= 500) {
          markModelFailed(model, false)
          console.warn(`[cloudflare-ai] ${provider}: ${status} (erro provedor), tentando próximo modelo...`)
          continue
        }

        throw new Error(`Cloudflare AI erro ${status} (${provider}): ${body.slice(0, 200)}`)
      }

      const data: CloudflareResponse = await res.json()

      if (!data.choices || data.choices.length === 0) {
        throw new Error(`Cloudflare AI resposta sem choices (${provider})`)
      }

      const content = data.choices[0].message?.content
      if (!content) {
        throw new Error(`Cloudflare AI resposta sem conteúdo (${provider})`)
      }

      markModelSuccess(model)
      return content
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'name' in err && (err as Error).name === 'AbortError') {
        markModelFailed(model, false)
        lastError.status = 504
        lastError.message = `Timeout (${TIMEOUT_MS}ms) no modelo ${provider}`
        console.warn(`[cloudflare-ai] ${provider}: timeout, tentando próximo modelo...`)
        continue
      }

      const errMsg = err instanceof Error ? err.message : String(err)
      const is4xx = lastError.status && lastError.status >= 400 && lastError.status < 500 && lastError.status !== 429

      if (is4xx) {
        throw err
      }

      markModelFailed(model, false)
      lastError.message = errMsg
      console.warn(`[cloudflare-ai] ${provider}: ${errMsg}, tentando próximo modelo...`)
    }
  }

  throw new Error(lastError.message || 'Todos os modelos Cloudflare AI falharam')
}

export { isConfigured, getConfigError, getAvailableModel, resetAllModels }
