#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createInterface } from 'readline'

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
  console.error('❌ Configure CLOUDFLARE_API_TOKEN e CLOUDFLARE_ACCOUNT_ID no .env_cloudflare')
  process.exit(1)
}

const SKILL_PATH = resolve(ROOT, 'skill-desafio-ao-mvp.md')
const SKILL_CONTENT = readFileSync(SKILL_PATH, 'utf-8')

const MODEL = process.env.MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
const URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/v1/chat/completions`

let currentStage = 1
let completedStages = []
let stageOutputs = []
let history = []
let userResponses = []

// Mapa de respostas simuladas para cada etapa
const SIMULATED_ANSWERS = {
  1: 'Meu maior desafio é conseguir mais clientes para minha marmitaria. Tenho uma boa cozinha e os clientes que experimentam gostam, mas as pessoas não me conhecem. Já tentei panfletagem e Instagram mas não deu resultado consistente.',
  2: 'Donas de casa que trabalham fora e não têm tempo de cozinhar. Famílias pequenas no bairro. Profissionais que moram sozinhos.',
  3: 'Acho que as pessoas não compram porque não sabem que existimos. E também porque desconfiam de comida congelada. Já ouvi comentários de que "comida congelada não é saudável".',
  4: 'Poderia fazer delivery em parceria com academias locais, criar um plano de assinatura semanal, ou oferecer degustação em pontos estratégicos.',
  5: 'Preciso definir quais ações fazer primeiro, com quanto investimento e em quanto tempo. Talvez começar com degustação em 2 pontos da cidade e campanha no Instagram.',
  6: 'O mercado de marmitas fitness está crescendo na cidade, mas tem bastante concorrência. A economia local está estável. As pessoas estão cada vez mais buscando conveniência.',
  7: 'Quero testar um plano de assinatura semanal com um MVP simples: 10 clientes piloto, cardápio rotativo semanal, delivery em 2 dias fixos.',
}

async function callAI(messages) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages }),
    signal: AbortSignal.timeout(60_000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content || data?.result?.response
  if (!content) throw new Error('Resposta vazia')

  return content
}

function buildSystemPrompt() {
  const completed = completedStages.map(s => ({
    stage: s,
    output: stageOutputs[s - 1]?.slice(0, 200) || null,
  }))

  let prompt = SKILL_CONTENT + '\n\n---\n\n'
  prompt += 'ESTADO ATUAL DA JORNADA DO TIME:\n'
  prompt += `- Etapa atual: ${currentStage}\n`
  prompt += `- Etapas concluídas: ${completed.map(c => c.stage).join(', ') || 'nenhuma'}\n`
  prompt += `- Outputs registrados: ${completed.map(c => `${c.stage}: ${c.output ?? '—'}`).join('; ') || 'nenhum'}\n\n`

  const histStr = [...history].reverse().map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n')
  prompt += `HISTÓRICO DESTA SESSÃO:\n${histStr || '(vazio)'}\n\n`

  prompt += `INSTRUÇÕES CRÍTICAS DE FORMATAÇÃO: Quando identificar que os critérios da etapa foram atingidos e a etapa foi concluída, você DEVE retornar APENAS a tag [ETAPA_CONCLUIDA:N] (onde N é o número da etapa). Não inclua explicações, parágrafos, e não use NENHUMA formatação em markdown (como **). Retorne estritamente o texto entre os colchetes e nada mais. Exemplo exato: [ETAPA_CONCLUIDA:2]`

  return prompt
}

function detectStageCompletion(text) {
  const match = text.match(/\[ETAPA_CONCLUIDA:\s*(\d)\]/)
  if (match) {
    const stage = parseInt(match[1])
    const clean = text.replace(/\[ETAPA_CONCLUIDA:\s*\d\]/g, '').trim()
    return { stage, cleanContent: clean }
  }
  return null
}

function waitForEnter(prompt) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(prompt || 'Pressione Enter para continuar...', () => {
      rl.close()
      resolve()
    })
  })
}

async function simulateStage(stageNum, userAnswer, isManual) {
  console.log(`\n${'━'.repeat(66)}`)
  console.log(`  🌟 ETAPA ${stageNum}`)
  console.log(`${'━'.repeat(66)}`)

  const systemContent = buildSystemPrompt()

  const messages = [
    { role: 'system', content: systemContent },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userAnswer },
  ]

  console.log(`\n  🤖 Enviando resposta do usuário...\n`)

  if (isManual) {
    await waitForEnter('  Pressione Enter para enviar para a IA...')
  }

  const start = Date.now()

  try {
    const aiResponse = await callAI(messages)

    const elapsed = ((Date.now() - start) / 1000).toFixed(1)

    console.log(`  ⏱️  ${elapsed}s\n`)
    console.log(`  💬 RESPOSTA DA IA:\n`)
    console.log(`  ${aiResponse.replace(/\n/g, '\n  ')}\n`)

    // Salva no histórico como assistant
    history.push({ role: 'assistant', content: aiResponse })

    // Verifica conclusão de etapa
    const completed = detectStageCompletion(aiResponse)
    if (completed) {
      console.log(`  🎯 ETAPA ${completed.stage} CONCLUÍDA!`)
      completedStages.push(completed.stage)
      stageOutputs[completed.stage - 1] = completed.cleanContent || aiResponse
      if (completed.stage >= currentStage) {
        currentStage = completed.stage + 1
      }
    }

    return aiResponse
  } catch (err) {
    console.error(`\n  ❌ ERRO: ${err.message}`)
    return null
  }
}

// ── MAIN ──
async function main() {
  const isManual = process.argv.includes('--manual')

  console.log(`
╔══════════════════════════════════════════════════════╗
║   Teste de Interação com Skill Desafio ao MVP       ║
║   ${MODEL}                          ║
║   Modo: ${isManual ? 'MANUAL (digite suas respostas)' : 'AUTOMÁTICO (respostas simuladas)'}        ║
╚══════════════════════════════════════════════════════╝
  `)

  // Mensagem inicial do sistema (skill se apresenta)
  const greeting = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: 'Olá! Quero começar a jornada.' },
  ]

  console.log('  🤖 Enviando mensagem inicial...\n')

  try {
    const initialResponse = await callAI(greeting)
    console.log(`  💬 IA:\n`)
    console.log(`  ${initialResponse.replace(/\n/g, '\n  ')}\n`)
    history.push({ role: 'assistant', content: initialResponse })

    const greetingCompleted = detectStageCompletion(initialResponse)
    if (greetingCompleted) {
      completedStages.push(greetingCompleted.stage)
      stageOutputs[greetingCompleted.stage - 1] = greetingCompleted.cleanContent
      if (greetingCompleted.stage >= currentStage) currentStage = greetingCompleted.stage + 1
    }
  } catch (err) {
    console.error(`❌ Erro na mensagem inicial: ${err.message}`)
    return
  }

  if (isManual) {
    // Modo interativo
    while (currentStage <= 7) {
      console.log(`\n  📝 Agora na Etapa ${currentStage}. Digite sua resposta:`)
      const rl = createInterface({ input: process.stdin, output: process.stdout })
      const answer = await new Promise(resolve => {
        rl.question('  > ', (ans) => {
          rl.close()
          resolve(ans)
        })
      })
      history.push({ role: 'user', content: answer })
      await simulateStage(currentStage, answer, false)
    }
    console.log(`\n${'━'.repeat(66)}`)
    console.log('  🏁 Jornada completa!')
    console.log(`${'━'.repeat(66)}\n`)
  } else {
    // Modo automático — simula todas as 7 etapas
    for (let stage = 1; stage <= 7; stage++) {
      const answer = SIMULATED_ANSWERS[stage]
      if (!answer) {
        console.log(`\n  ⏭️  Pulando etapa ${stage} — resposta simulada não definida`)
        continue
      }
      history.push({ role: 'user', content: answer })
      await simulateStage(stage, answer, false)

      // Se a etapa não foi concluída, tenta uma segunda mensagem
      if (!completedStages.includes(stage) && stage === currentStage) {
        console.log(`\n  🔄 Etapa ${stage} não concluída. Enviando confirmação...`)
        history.push({ role: 'user', content: 'Sim, estou satisfeito com o resultado. Podemos avançar para a próxima etapa.' })
        await simulateStage(stage, 'Sim, estou satisfeito. Podemos avançar.', false)
      }

      // Se mesmo assim não concluiu, para o teste
      if (!completedStages.includes(stage) && stage === currentStage) {
        console.log(`\n  ⚠️  Etapa ${stage} não foi concluída após 2 tentativas. Encerrando.`)
        break
      }
    }

    console.log(`\n${'━'.repeat(66)}`)
    console.log(`  📊 RESUMO`)
    console.log(`${'━'.repeat(66)}`)
    console.log(`  Etapas concluídas: ${completedStages.join(', ') || 'nenhuma'}`)
    console.log(`  Total de mensagens: ${history.length}`)
    console.log(`  Última etapa: ${currentStage > 7 ? '🏁 Todas concluídas!' : `Etapa ${currentStage}`}`)
    console.log(`\n${'─'.repeat(66)}\n`)
  }
}

main().catch(err => {
  console.error('Erro:', err)
  process.exit(1)
})
