#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

function loadEnv(file) {
  const path = resolve(ROOT, file)
  if (!existsSync(path)) return {}
  const env = {}
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const sep = trimmed.indexOf('=')
    if (sep === -1) continue
    env[trimmed.slice(0, sep).trim()] = trimmed.slice(sep + 1).trim()
  }
  return env
}

const env = loadEnv('.env_cloudflare')
const TOKEN = env.CLOUDFLARE_API_TOKEN
const ACCOUNT_ID = env.CLOUDFLARE_ACCOUNT_ID

const URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/v1/chat/completions`

const MODELS = [
  '@cf/qwen/qwq-32b',
  '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
  'deepseek/deepseek-v4-pro',
  '@cf/meta/llama-3.2-11b-vision-instruct',
  '@cf/baai/bge-reranker-base',
]

const MSG = [
  { role: 'system', content: 'Responda apenas a palavra "Teste OK" se entendeu.' },
  { role: 'user', content: 'Você me entende?' },
]

console.log(`\n  Account: ${ACCOUNT_ID}`)
console.log(`  Token: ${TOKEN.slice(0, 12)}...${TOKEN.slice(-4)}\n`)

for (const m of MODELS) {
  const start = Date.now()
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: m, messages: MSG }),
      signal: AbortSignal.timeout(20_000),
    })
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    const body = await res.text().catch(() => '')

    if (res.ok) {
      const data = JSON.parse(body)
      const content = data?.choices?.[0]?.message?.content || data?.result?.response || '(sem conteudo)'
      console.log(`  ✅ ${m}`)
      console.log(`     (${elapsed}s) "${content.slice(0, 120)}"\n`)
    } else {
      console.log(`  ❌ ${m} (HTTP ${res.status}, ${elapsed}s)`)
      console.log(`     ${body.slice(0, 150)}\n`)
    }
  } catch (e) {
    console.log(`  ❌ ${m} erro: ${e.message.slice(0, 120)}\n`)
  }
}
