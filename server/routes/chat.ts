import { Router } from 'express'
import { GoogleGenerativeAI, type Content } from '@google/generative-ai'
import prisma from '../db/prisma.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'

const router = Router()

router.get('/:teamId', requireAuth, async (req: AuthRequest, res) => {
  const teamId = req.params.teamId as string
  const messages = await prisma.chatMessage.findMany({
    where: { teamId },
    orderBy: { createdAt: 'asc' },
  })
  res.json(messages)
})

router.post('/:teamId', requireAuth, async (req: AuthRequest, res) => {
  const teamId = req.params.teamId as string
  const { content } = req.body as { content: string }

  const userMessage = await prisma.chatMessage.create({
    data: { teamId, role: 'user', content },
  })

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      progress: { orderBy: { stage: 'asc' } },
      chatMessages: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  })

  if (!team) {
    res.status(404).json({ error: 'Time não encontrado' })
    return
  }

  const skill = await prisma.skillVersion.findFirst({
    where: { isActive: true },
  })

  const systemContent = buildSystemPrompt(skill, {
    currentStage: team.currentStage,
    progress: team.progress,
    chatMessages: team.chatMessages,
  })

  const geminiApiKey = process.env.GEMINI_API_KEY
  if (geminiApiKey && geminiApiKey !== 'sua_chave_gemini') {
    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey)
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: systemContent,
      })

      const history: Content[] = team.chatMessages
        .filter(m => m.role !== 'system')
        .reverse()
        .slice(0, 20)
        .reverse()
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }))

      const chat = model.startChat({ history })
      const result = await chat.sendMessage(content)
      const response = result.response
      const aiText = response.text()

      let stageCompleted: number | null = null
      let cleanContent = aiText

      const stageMatch = aiText.match(/\[ETAPA_CONCLUIDA:\s*(\d)\]/)
      if (stageMatch) {
        stageCompleted = parseInt(stageMatch[1])
        cleanContent = aiText.replace(/\[ETAPA_CONCLUIDA:\s*\d\]/g, '').trim()
      }

      const aiMessage = await prisma.chatMessage.create({
        data: {
          teamId,
          role: 'assistant',
          content: cleanContent,
          stage: stageCompleted ?? undefined,
        },
      })

      if (stageCompleted) {
        await prisma.teamProgress.updateMany({
          where: { teamId, stage: stageCompleted },
          data: {
            status: 'completed',
            stageOutput: cleanContent.slice(0, 500),
            completedAt: new Date(),
          },
        })

        if (stageCompleted === 7) {
          await prisma.team.update({
            where: { id: teamId },
            data: { status: 'completed' },
          })
        }
      }

      res.json({ userMessage, aiMessage, content: cleanContent, stageCompleted })
    } catch (err: unknown) {
      console.error('Gemini API error:', err)
      const isQuota = err && typeof err === 'object' && 'status' in err &&
        (err as { status: number }).status === 429
      res.status(isQuota ? 429 : 503).json({
        error: isQuota
          ? 'Cota de uso da IA excedida. Aguarde alguns minutos ou contate o administrador.'
          : 'IA temporariamente indisponível. Tente novamente em instantes.',
      })
    }
  } else {
    res.status(503).json({ error: 'Chave da API Gemini não configurada. Contate o administrador.' })
  }
})

function buildSystemPrompt(skill: { contentMd: string } | null, team: {
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
    prompt += skill.contentMd + '\n\n---\n\n'
  }

  prompt += 'ESTADO ATUAL DA JORNADA DO TIME:\n'
  prompt += `- Etapa atual: ${team.currentStage}\n`
  prompt += `- Etapas concluídas: ${completed.map(p => p.stage).join(', ')}\n`
  prompt += `- Outputs registrados: ${completed.map(p => `${p.stage}: ${p.stageOutput ?? '—'}`).join('; ')}\n\n`

  prompt += `HISTÓRICO DESTA SESSÃO:\n${history || '(vazio)'}`
  return prompt
}

export default router
