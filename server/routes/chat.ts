import { Router } from 'express'
import { callCloudflareAI, isConfigured, getConfigError } from '../services/cloudflareAi.js'
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

  if (!isConfigured()) {
    res.status(503).json({
      error: `Cloudflare AI não configurado: ${getConfigError()}. Contate o administrador.`,
    })
    return
  }

  const messages = [
    { role: 'system' as const, content: systemContent },
    ...recentMessages.map(m => ({
      role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content },
  ]

  try {
    const aiText = await callCloudflareAI(messages)

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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[cloudflare-ai] Erro no chat:', msg)
    res.status(503).json({
      error: 'IA temporariamente indisponível. Todos os provedores falharam. Tente novamente em instantes.',
    })
  }
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

  // Instrução para incluir tag de conclusão ao final da resposta
  prompt += `\n\nINSTRUÇÕES DE FORMATAÇÃO: Quando os critérios da etapa forem atingidos, inclua a tag [ETAPA_CONCLUIDA:N] (onde N é o número da etapa) ao final da sua resposta. Não use formatação markdown (como **). Exemplo: Sua análise completa aqui... [ETAPA_CONCLUIDA:2]`

  return prompt
}

export default router
