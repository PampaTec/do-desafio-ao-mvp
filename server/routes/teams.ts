import { Router } from 'express'
import prisma from '../db/prisma.js'
import { requireAuth, requireAdmin, type AuthRequest } from '../middleware/auth.js'

const router = Router()

router.get('/', requireAdmin, async (_req: AuthRequest, res) => {
  const teams = await prisma.team.findMany({
    include: {
      members: { include: { profile: true } },
      progress: true,
      _count: { select: { chatMessages: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  res.json(teams)
})

router.get('/my', requireAuth, async (req: AuthRequest, res) => {
  const membership = await prisma.teamMember.findFirst({
    where: { userId: req.userId },
    include: {
      team: {
        include: {
          progress: { orderBy: { stage: 'asc' } },
          members: { include: { profile: true } },
        },
      },
    },
  })

  if (!membership) {
    res.json(null)
    return
  }

  res.json(membership.team)
})

router.post('/', requireAdmin, async (req: AuthRequest, res) => {
  const { projectName, memberEmails } = req.body as {
    projectName: string
    memberEmails: string[]
  }

  const team = await prisma.team.create({
    data: {
      projectName,
      createdBy: req.userId,
      members: {
        create: memberEmails.map(email => ({ invitedEmail: email })),
      },
      progress: {
        create: Array.from({ length: 7 }, (_, i) => ({
          stage: i + 1,
          status: i === 0 ? 'in_progress' : 'pending',
        })),
      },
    },
    include: { members: true, progress: true },
  })

  res.status(201).json(team)
})

router.get('/:id', requireAdmin, async (req, res) => {
  const id = req.params.id as string
  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      members: { include: { profile: true } },
      progress: { orderBy: { stage: 'asc' } },
      chatMessages: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!team) {
    res.status(404).json({ error: 'Time não encontrado' })
    return
  }

  res.json(team)
})

router.patch('/:id/advance', requireAuth, async (req: AuthRequest, res) => {
  const id = req.params.id as string
  const team = await prisma.team.findUnique({ where: { id } })
  if (!team) {
    res.status(404).json({ error: 'Time não encontrado' })
    return
  }

  if (team.currentStage >= 7) {
    await prisma.team.update({
      where: { id },
      data: { status: 'completed' },
    })
    res.json({ message: 'Jornada concluída' })
    return
  }

  const nextStage = team.currentStage + 1
  await prisma.teamProgress.updateMany({
    where: { teamId: id, stage: nextStage },
    data: { status: 'in_progress' },
  })

  const updated = await prisma.team.update({
    where: { id },
    data: { currentStage: nextStage },
  })

  res.json(updated)
})

router.delete('/:id', requireAdmin, async (req, res) => {
  const id = req.params.id as string
  await prisma.team.delete({ where: { id } })
  res.json({ message: 'Time excluído' })
})

export default router
