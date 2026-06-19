interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

function getToken(): string | null {
  return process.env.CLOUFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || null
}

function getAccountId(): string | null {
  return process.env.CLOUDFLARE_ACCOUNT_ID || null
}

function getGatewayName(): string | null {
  return process.env.CLOUDFLARE_GATEWAY_NAME || null
}

export function isConfigured(): boolean {
  return !!getToken() && !!getAccountId() && !!getGatewayName()
}

export function getConfigError(): string | null {
  if (!getToken()) return 'CLOUDFLARE_API_TOKEN não configurado'
  if (!getAccountId()) return 'CLOUDFLARE_ACCOUNT_ID não configurado'
  if (!getGatewayName()) return 'CLOUDFLARE_GATEWAY_NAME não configurado'
  return null
}

export async function callCloudflareAI(messages: ChatMessage[]): Promise<string> {
  if (!isConfigured()) {
    throw new Error(getConfigError() || 'Cloudflare AI não configurado')
  }

  const token = getToken()!
  const accountId = getAccountId()!
  const gatewayName = getGatewayName()!
  
  // URL do Universal Endpoint do AI Gateway
  const url = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayName}`

  // Array de alvos para o Fallback automático (Cloudflare tentará um por um)
  const payload = [
    {
      provider: "workers-ai",
      endpoint: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      query: { messages }
    },
    {
      provider: "workers-ai",
      endpoint: "@cf/meta/llama-3.1-8b-instruct",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      query: { messages }
    },
    // Nota: Para usar Groq e DeepSeek, insira suas API Keys na interface do 
    // Cloudflare AI Gateway em Settings -> Provider APIs. O Gateway repassará a chamada.
    {
      provider: "groq",
      endpoint: "chat/completions",
      query: { 
        model: "llama-3.3-70b-versatile",
        messages 
      }
    },
    {
      provider: "deepseek",
      endpoint: "chat/completions",
      query: { 
        model: "deepseek-chat",
        messages 
      }
    }
  ]

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    // Aumentamos o timeout local pois o Gateway pode demorar enquanto tenta os fallbacks
    signal: AbortSignal.timeout(30_000), 
  })

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '')
    throw new Error(`Erro do AI Gateway (Status ${res.status}): ${errorBody.slice(0, 500)}`)
  }

  const data = await res.json()

  // O Gateway repassa a resposta exata do provedor que funcionou.
  // Padrão OpenAI (Groq, DeepSeek): data.choices[0].message.content
  // Padrão nativo Workers AI: data.result.response
  const content = data?.choices?.[0]?.message?.content || data?.result?.response

  if (!content) {
    throw new Error(`Resposta do Gateway sem conteúdo legível: ${JSON.stringify(data).slice(0, 200)}`)
  }

  return content
}
