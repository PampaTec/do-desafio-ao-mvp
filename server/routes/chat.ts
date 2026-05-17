import { Router } from 'express'
import { type Content } from '@google/generative-ai'
import { getAvailableKey, markKeyFailed, markKeySuccess, createGeminiClient, getKeyCount } from '../services/geminiKeyRotation.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { getAdminTokens } from '../services/tokenStore.js'
import {
  salvarMensagemChat,
  carregarMensagensChat,
  carregarProgressoPorTeam,
  buscarTeamPorId,
  buscarSkillAtiva,
  atualizarProgresso,
} from '../services/sheetsService.js'


const router = Router()

function getTokens(req: AuthRequest) {
  const s = req.session as { tokens?: object } | null | undefined
  return getAdminTokens() || s?.tokens
}

router.get('/:teamId', requireAuth, async (req: AuthRequest, res) => {
  const tokens = getTokens(req)
  if (!tokens) { res.status(401).json({ error: 'Tokens não disponíveis' }); return }

  const teamId = req.params.teamId as string
  const messages = await carregarMensagensChat(teamId, tokens)
  res.json(messages.map(m => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.created_at,
  })))
})

router.post('/:teamId', requireAuth, async (req: AuthRequest, res) => {
  const tokens = getTokens(req)
  if (!tokens) { res.status(401).json({ error: 'Tokens não disponíveis' }); return }

  const teamId = req.params.teamId as string
  const { content } = req.body as { content: string }

  await salvarMensagemChat({
    id: crypto.randomUUID(),
    team_id: teamId,
    role: 'user',
    content,
    stage: '',
  }, tokens)

  const team = await buscarTeamPorId(teamId, tokens)
  if (!team) {
    res.status(404).json({ error: 'Time não encontrado' })
    return
  }

  const [allProgress, chatMessages] = await Promise.all([
    carregarProgressoPorTeam(teamId, tokens),
    carregarMensagensChat(teamId, tokens),
  ])
  const recentMessages = chatMessages.slice(-20)

  const skill = await buscarSkillAtiva(tokens)

  const systemContent = buildSystemPrompt(
    skill ? { content_md: skill.content_md } : null,
    {
      currentStage: parseInt(team.current_stage || '1'),
      progress: allProgress.map(p => ({
        stage: parseInt(p.stage),
        status: p.status,
        stageOutput: p.stage_output || null,
      })),
      chatMessages: recentMessages.map(m => ({ role: m.role, content: m.content })),
    },
  )

  if (getKeyCount() === 0) {
    res.status(503).json({ error: 'Chave da API Gemini não configurada. Contate o administrador.' })
    return
  }

  const history: Content[] = recentMessages
    .filter(m => m.role !== 'system')
    .reverse()
    .slice(0, 20)
    .reverse()
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

  // Tenta com rodízio de chaves (até 3 tentativas)
  const maxRetries = Math.min(getKeyCount(), 3)
  let lastError: unknown = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const apiKey = getAvailableKey()
    if (!apiKey) break

    try {
      const genAI = createGeminiClient(apiKey)
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: systemContent,
      })

      const chat = model.startChat({ history })
      const result = await chat.sendMessage(content)
      const aiText = result.response.text()

      markKeySuccess(apiKey)

      let stageCompleted: number | null = null
      let cleanContent = aiText

      const stageMatch = aiText.match(/\[ETAPA_CONCLUIDA:\s*(\d)\]/)
      if (stageMatch) {
        stageCompleted = parseInt(stageMatch[1])
        cleanContent = aiText.replace(/\[ETAPA_CONCLUIDA:\s*\d\]/g, '').trim()
      }

      const aiMsgId = crypto.randomUUID()
      await salvarMensagemChat({
        id: aiMsgId,
        team_id: teamId,
        role: 'assistant',
        content: cleanContent,
        stage: stageCompleted ? String(stageCompleted) : '',
      }, tokens)

      if (stageCompleted) {
        const progressItem = allProgress.find(p => parseInt(p.stage) === stageCompleted)
        if (progressItem) {
          await atualizarProgresso(progressItem.id, {
            status: 'completed',
            stage_output: cleanContent.slice(0, 500),
            completed_at: new Date().toISOString(),
          }, tokens)
        }
      }

      res.json({
        userMessage: { id: '', role: 'user', content, createdAt: new Date().toISOString() },
        aiMessage: { id: aiMsgId, role: 'assistant', content: cleanContent, createdAt: new Date().toISOString() },
        content: cleanContent,
        stageCompleted,
      })
      return
    } catch (err: unknown) {
      lastError = err
      const is429 = err && typeof err === 'object' && 'status' in err &&
        (err as { status: number }).status === 429
      markKeyFailed(apiKey, !!is429)

      if (!is429) break // Erro não-429 = não adianta tentar outra chave
      console.warn(`[gemini] Chave bloqueada (429), tentando próxima... (tentativa ${attempt + 1}/${maxRetries})`)
    }
  }

  // Todas as tentativas falharam
  console.error('Gemini API error (todas as chaves falharam):', lastError)
  const is429 = lastError && typeof lastError === 'object' && 'status' in lastError &&
    (lastError as { status: number }).status === 429
  res.status(is429 ? 429 : 503).json({
    error: is429
      ? 'Cota de uso da IA excedida. Aguarde alguns minutos ou contate o administrador.'
      : 'IA temporariamente indisponível. Tente novamente em instantes.',
  })
})

function buildSystemPrompt(skill: { content_md: string } | null, team: {
  currentStage: number
  progress: { stage: number; status: string; stageOutput: string | null }[]
  chatMessages: { role: string; content: string }[]
}) {
  const completed = team.progress.filter(p => p.status === 'completed')
  const history = [...team.chatMessages].reverse().map(m =>
    `[${m.role.toUpperCase()}]: ${m.content}`
  ).join('\n')

  let prompt = ''
  if (skill) {
    prompt += skill.content_md + '\n\n---\n\n'
  }

  prompt += 'ESTADO ATUAL DA JORNADA DO TIME:\n'
  prompt += `- Etapa atual: ${team.currentStage}\n`
  prompt += `- Etapas concluídas: ${completed.map(p => p.stage).join(', ')}\n`
  prompt += `- Outputs registrados: ${completed.map(p => `${p.stage}: ${p.stageOutput ?? '—'}`).join('; ')}\n\n`

  prompt += `HISTÓRICO DESTA SESSÃO:\n${history || '(vazio)'}`
  return prompt
}

export default router
