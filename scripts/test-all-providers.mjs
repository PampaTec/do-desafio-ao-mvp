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

const env = { ...loadEnv('.env_cloudflare'), ...loadEnv('.env') }
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || env.CLOUDFLARE_API_TOKEN
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID

if (!TOKEN || !ACCOUNT_ID) {
  console.error('❌ Configure CLOUDFLARE_API_TOKEN e CLOUDFLARE_ACCOUNT_ID')
  process.exit(1)
}

const SKILL_PATH = resolve(ROOT, 'skill-desafio-ao-mvp.md')
const SKILL_CONTENT = readFileSync(SKILL_PATH, 'utf-8')

const URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/v1/chat/completions`

const MODELS = [
  { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', provider: 'Workers AI',          byok: false },
  { id: 'groq/llama-4-scout',                         provider: 'Groq',               byok: false },
  { id: 'deepseek/deepseek-chat',                     provider: 'DeepSeek',           byok: false },
  { id: 'google-ai-studio/gemini-2.5-flash',          provider: 'Google (AI Studio)', byok: true  },
  { id: 'openai/gpt-4.1-mini',                        provider: 'OpenAI',             byok: true  },
  { id: 'anthropic/claude-sonnet-4-5',                provider: 'Anthropic',          byok: true  },
  { id: 'grok/grok-4',                                provider: 'xAI (Grok)',         byok: true  },
]

// Prompt simples: responder apenas "Teste OK"
const SIMPLE_PROMPT = [
  { role: 'system', content: 'Responda em português de forma curta e direta. Apenas a palavra "Teste OK" se entendeu.' },
  { role: 'user', content: 'Você me entende? Responda apenas "Teste OK".' },
]

// Prompt da skill: pergunta da Etapa 1
const SKILL_SYSTEM = SKILL_CONTENT + `

INSTRUÇÕES CRÍTICAS: Quando os critérios da etapa forem atingidos, retorne [ETAPA_CONCLUIDA:N] exatamente neste formato. Não use markdown.`

const SKILL_PROMPT = [
  { role: 'system', content: SKILL_SYSTEM },
  { role: 'user', content: 'Olá! Quero começar a jornada. Meu maior desafio é conseguir mais clientes para minha marmitaria.' },
]

async function testModel(modelId, provider, byok, messages, label) {
  const needByok = byok

  try {
    const start = Date.now()
    const res = await fetch(URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelId, messages }),
      signal: AbortSignal.timeout(30_000),
    })
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      const shortBody = body.slice(0, 150)
      // 401 ou 403 = BYOK não configurado
      if (res.status === 401 || res.status === 403) {
        return { status: 'byok', elapsed, detail: shortBody }
      }
      return { status: 'error', elapsed, detail: `HTTP ${res.status}: ${shortBody}` }
    }

    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content || data?.result?.response
    if (!content) {
      return { status: 'error', elapsed, detail: 'Resposta sem conteúdo' }
    }

    const stageMatch = content.match(/\[ETAPA_CONCLUIDA:\s*(\d)\]/)
    const hasTag = !!stageMatch

    return {
      status: 'ok',
      elapsed,
      content: content.slice(0, 400),
      hasTag,
      stage: stageMatch ? stageMatch[1] : null,
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      return { status: 'timeout', elapsed: '>30', detail: 'Timeout 30s' }
    }
    return { status: 'error', elapsed: '-', detail: err.message.slice(0, 150) }
  }
}

function statusIcon(status) {
  return status === 'ok' ? '✅' : status === 'byok' ? '⚠️' : status === 'timeout' ? '⏰' : '❌'
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║   Comparação de Provedores Cloudflare AI Gateway            ║
║   ${ACCOUNT_ID}                            ║
╚══════════════════════════════════════════════════════════════╝
`)

  // ── TESTE 1: Prompt Simples ──
  console.log(`\n${'━'.repeat(70)}`)
  console.log('  TESTE 1 — Prompt simples (curto)')
  console.log(`${'━'.repeat(70)}`)
  console.log(`  ${'PROVEDOR'.padEnd(22)} ${'STATUS'.padEnd(8)} ${'TEMPO'.padEnd(8)}  RESPOSTA`)
  console.log(`  ${'─'.repeat(68)}`)

  for (const m of MODELS) {
    const r = await testModel(m.id, m.provider, m.byok, SIMPLE_PROMPT, 'simples')
    const icon = statusIcon(r.status)
    const time = r.status === 'ok' ? `${r.elapsed}s` : r.status === 'byok' ? '—' : r.elapsed
    const resp = r.status === 'ok' ? `"${r.content.slice(0, 60).replace(/\n/g, ' ')}..."` : r.status === 'byok' ? 'Requer BYOK' : r.detail?.slice(0, 60) || ''
    console.log(`  ${icon} ${m.provider.padEnd(20)} ${r.status.padEnd(8)} ${String(time).padEnd(8)} ${resp}`)
  }

  // ── TESTE 2: Prompt da Skill ──
  console.log(`\n${'━'.repeat(70)}`)
  console.log('  TESTE 2 — Prompt da Skill (Etapa 1 — CYNEFIN)')
  console.log(`${'━'.repeat(70)}`)
  console.log(`  ${'PROVEDOR'.padEnd(22)} ${'STATUS'.padEnd(8)} ${'TEMPO'.padEnd(8)}  ETAPA_CONCLUIDA? | INÍCIO DA RESPOSTA`)
  console.log(`  ${'─'.repeat(68)}`)

  for (const m of MODELS) {
    const r = await testModel(m.id, m.provider, m.byok, SKILL_PROMPT, 'skill')
    const icon = statusIcon(r.status)
    const time = r.status === 'ok' ? `${r.elapsed}s` : r.status === 'byok' ? '—' : r.elapsed
    const tagInfo = r.status === 'ok' ? (r.hasTag ? `✅ Etapa ${r.stage}` : '❌ Ausente') : '—'
    const snippet = r.status === 'ok' ? r.content.slice(0, 100).replace(/\n/g, ' ') : (r.status === 'byok' ? 'Requer BYOK' : r.detail?.slice(0, 60) || '')

    // Detecta se vazou prompt interno (problema comum com LLMs open-source)
    const vazou = r.status === 'ok' && (
      r.content.includes('[PROMPT INTERNO') ||
      r.content.includes('[PROMPT INTERNO — CYNEFIN]')
    )

    console.log(`  ${icon} ${m.provider.padEnd(20)} ${r.status.padEnd(8)} ${String(time).padEnd(8)} ${tagInfo.padEnd(20)} ${snippet}${vazou ? ' ⚠️ VAZOU PROMPT' : ''}`)
  }

  // ── RESUMO ──
  console.log(`\n${'━'.repeat(70)}`)
  console.log('  RESUMO')
  console.log(`${'━'.repeat(70)}`)
  console.log(`
  ✅ = Funcionou     ⚠️ = Requer BYOK (não testado)     ❌ = Erro     ⏰ = Timeout
  `)
}

main().catch(err => {
  console.error('Erro:', err)
  process.exit(1)
})
