import { GoogleGenerativeAI } from '@google/generative-ai'

interface KeyState {
  key: string
  blockedUntil: number // timestamp
  failCount: number
}

const keys: KeyState[] = []
let currentIndex = 0

function initKeys() {
  if (keys.length > 0) return

  const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || ''
  const keyList = raw.split(',').map(k => k.trim()).filter(Boolean)

  for (const key of keyList) {
    keys.push({ key, blockedUntil: 0, failCount: 0 })
  }

  if (keys.length > 0) {
    console.log(`[gemini] ${keys.length} chave(s) Gemini configurada(s) para rodízio.`)
  } else {
    console.warn('[gemini] Nenhuma chave Gemini configurada!')
  }
}

export function getAvailableKey(): string | null {
  initKeys()
  if (keys.length === 0) return null

  const now = Date.now()

  // Tenta a partir do índice atual, percorre todas as chaves
  for (let i = 0; i < keys.length; i++) {
    const idx = (currentIndex + i) % keys.length
    const state = keys[idx]

    if (state.blockedUntil <= now) {
      currentIndex = (idx + 1) % keys.length // próxima chamada usa a próxima chave
      return state.key
    }
  }

  // Todas bloqueadas — retorna a que desbloqueia mais cedo
  const soonest = keys.reduce((a, b) => a.blockedUntil < b.blockedUntil ? a : b)
  console.warn(`[gemini] Todas as chaves bloqueadas. Mais cedo desbloqueia em ${Math.ceil((soonest.blockedUntil - now) / 1000)}s`)
  return null
}

export function markKeyFailed(key: string, is429: boolean) {
  const state = keys.find(k => k.key === key)
  if (!state) return

  state.failCount++

  if (is429) {
    // Bloqueia por 60s no rate limit
    state.blockedUntil = Date.now() + 60_000
    console.warn(`[gemini] Chave ...${key.slice(-6)} bloqueada por 60s (429 rate limit, fail #${state.failCount})`)
  } else {
    // Erro genérico — bloqueia por 10s
    state.blockedUntil = Date.now() + 10_000
    console.warn(`[gemini] Chave ...${key.slice(-6)} bloqueada por 10s (erro genérico, fail #${state.failCount})`)
  }
}

export function markKeySuccess(key: string) {
  const state = keys.find(k => k.key === key)
  if (!state) return
  state.failCount = 0
  state.blockedUntil = 0
}

export function createGeminiClient(apiKey: string) {
  return new GoogleGenerativeAI(apiKey)
}

export function getKeyCount(): number {
  initKeys()
  return keys.length
}
