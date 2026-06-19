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

const cloudflareEnv = loadEnv('.env_cloudflare')
const mainEnv = loadEnv('.env')

const TOKEN =
  process.env.CLOUDFLARE_API_TOKEN ||
  cloudflareEnv.CLOUDFLARE_API_TOKEN ||
  mainEnv.CLOUDFLARE_API_TOKEN

const ACCOUNT_ID =
  process.env.CLOUDFLARE_ACCOUNT_ID ||
  cloudflareEnv.CLOUDFLARE_ACCOUNT_ID ||
  mainEnv.CLOUDFLARE_ACCOUNT_ID

const GATEWAY =
  process.env.CLOUDFLARE_GATEWAY_NAME ||
  cloudflareEnv.CLOUDFLARE_GATEWAY_NAME

function banner(msg) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  ${msg}`)
  console.log(`${'='.repeat(60)}`)
}

function passed(msg) {
  console.log(`  ✅ PASS: ${msg}`)
}

function failed(msg, detail) {
  console.log(`  ❌ FAIL: ${msg}`)
  if (detail) console.log(`     ${typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 300)}`)
}

async function testProviders() {
  if (!TOKEN) { failed('CLOUDFLARE_API_TOKEN não encontrado'); return }
  if (!ACCOUNT_ID) { failed('CLOUDFLARE_ACCOUNT_ID não encontrado'); return }

  console.log(`\n  Token:       ${TOKEN.slice(0, 12)}...${TOKEN.slice(-4)}`)
  console.log(`  Account ID:  ${ACCOUNT_ID}`)
  console.log(`  Gateway:     ${GATEWAY || '(não configurado)'}`)

  const messages = [
    { role: 'system', content: 'Responda em português de forma curta e direta.' },
    { role: 'user', content: 'Fale apenas "Teste OK" se recebeu esta mensagem.' },
  ]

  // ── 1. Dynamic Fallback (mesmo padrão usado no app) ──
  if (GATEWAY) {
    banner('1. Dynamic Fallback (Gateway)')
    await testDynamicFallback(messages)
  } else {
    console.log('\n  ⏭️  Pulando Dynamic Fallback — defina CLOUDFLARE_GATEWAY_NAME')
  }

  // ── 2. Workers AI (Universal Endpoint) ──
  banner('2. Workers AI — Universal Endpoint')
  await testUniversalEndpoint(messages, '@cf/meta/llama-3.3-70b-instruct-fp8-fast')

  // ── 3. Workers AI — modelo leve ──
  banner('3. Workers AI — modelo leve')
  await testUniversalEndpoint(messages, '@cf/meta/llama-4-scout-17b-16e-instruct')
}

async function testDynamicFallback(messages) {
  const url = `https://gateway.ai.cloudflare.com/v1/${ACCOUNT_ID}/${GATEWAY}`
  const payload = [
    {
      provider: 'workers-ai',
      endpoint: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      query: { messages },
    },
    {
      provider: 'workers-ai',
      endpoint: '@cf/meta/llama-3.1-8b-instruct',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      query: { messages },
    },
  ]

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      failed(`HTTP ${res.status}`, body.slice(0, 200))
      return
    }

    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content || data?.result?.response
    if (content) {
      passed(`Gateway respondeu: "${content}"`)
    } else {
      failed('Gateway resposta sem conteúdo', JSON.stringify(data).slice(0, 200))
    }
  } catch (err) {
    failed('Gateway erro', err.message)
  }
}

async function testUniversalEndpoint(messages, model) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/v1/chat/completions`
  const payload = { model, messages }

  try {
    const start = Date.now()
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    })
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      failed(`${model} (HTTP ${res.status}, ${elapsed}s)`, body.slice(0, 200))
      return
    }

    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content || data?.result?.response
    if (content) {
      passed(`${model} (${elapsed}s): "${content}"`)
    } else {
      failed(`${model} resposta sem conteúdo`, JSON.stringify(data).slice(0, 200))
    }
  } catch (err) {
    failed(`${model} erro`, err.message)
  }
}

// ── CLI ──
const gatewayIdx = process.argv.indexOf('--gateway')
if (gatewayIdx !== -1 && process.argv[gatewayIdx + 1]) {
  process.env.CLOUDFLARE_GATEWAY_NAME = process.argv[gatewayIdx + 1]
}

console.log(`
╔══════════════════════════════════════════════════╗
║   Cloudflare AI — Teste de Provedores           ║
╚══════════════════════════════════════════════════╝
`)

testProviders().then(() => {
  console.log(`\n${'─'.repeat(60)}\n`)
}).catch(err => {
  console.error('\n  Erro inesperado:', err)
  process.exit(1)
})
