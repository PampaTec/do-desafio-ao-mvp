interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const PRIMARY_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
const FALLBACK_MODEL = '@cf/meta/llama-3.1-8b-instruct'

function getToken(): string | null {
  return process.env.CLOUFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || null
}

function getAccountId(): string | null {
  return process.env.CLOUDFLARE_ACCOUNT_ID || null
}

export function isConfigured(): boolean {
  return !!getToken() && !!getAccountId()
}

export function getConfigError(): string | null {
  if (!getToken()) return 'CLOUDFLARE_API_TOKEN não configurado'
  if (!getAccountId()) return 'CLOUDFLARE_ACCOUNT_ID não configurado'
  return null
}

async function tryModel(messages: ChatMessage[], model: string): Promise<string | null> {
  const token = getToken()!
  const accountId = getAccountId()!
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.warn(`[cloudflare-ai] ${model} falhou (HTTP ${res.status}): ${body.slice(0, 200)}`)
    return null
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content || data?.result?.response
  if (!content) {
    console.warn(`[cloudflare-ai] ${model} resposta sem conteúdo`)
    return null
  }

  return content
}

export async function callCloudflareAI(messages: ChatMessage[]): Promise<string> {
  if (!isConfigured()) {
    throw new Error(getConfigError() || 'Cloudflare AI não configurado')
  }

  const result = await tryModel(messages, PRIMARY_MODEL)
  if (result) return result

  console.warn(`[cloudflare-ai] ${PRIMARY_MODEL} falhou, tentando fallback ${FALLBACK_MODEL}...`)
  const fallback = await tryModel(messages, FALLBACK_MODEL)
  if (fallback) return fallback

  throw new Error(`Todos os modelos Cloudflare AI falharam (${PRIMARY_MODEL}, ${FALLBACK_MODEL})`)
}
