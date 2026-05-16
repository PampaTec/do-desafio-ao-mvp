import { Router } from 'express'
import prisma from '../db/prisma.js'
import { requireAdmin, type AuthRequest } from '../middleware/auth.js'

const router = Router()

router.get('/', async (_req, res) => {
  const skills = await prisma.skillVersion.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  })
  res.json(skills)
})

router.get('/active', async (_req, res) => {
  const skill = await prisma.skillVersion.findFirst({
    where: { isActive: true },
  })
  res.json(skill)
})

router.post('/', requireAdmin, async (req: AuthRequest, res) => {
  const { versionLabel, contentMd } = req.body as {
    versionLabel: string
    contentMd: string
  }

  await prisma.skillVersion.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  })

  const skill = await prisma.skillVersion.create({
    data: {
      versionLabel,
      contentMd,
      createdBy: req.userId,
      isActive: true,
    },
  })

  await prisma.skillAuditLog.create({
    data: {
      adminId: req.userId,
      action: 'create',
      fieldsChanged: { versionLabel, isActive: true },
    },
  })

  const totalVersions = await prisma.skillVersion.count()
  if (totalVersions > 5) {
    const oldest = await prisma.skillVersion.findFirst({
      where: { isActive: false },
      orderBy: { createdAt: 'asc' },
    })
    if (oldest) {
      await prisma.skillVersion.delete({ where: { id: oldest.id } })
    }
  }

  res.status(201).json(skill)
})

router.post('/:id/restore', requireAdmin, async (req: AuthRequest, res) => {
  const id = req.params.id as string
  const version = await prisma.skillVersion.findUnique({
    where: { id },
  })

  if (!version) {
    res.status(404).json({ error: 'Versão não encontrada' })
    return
  }

  await prisma.skillVersion.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  })

  await prisma.skillVersion.update({
    where: { id },
    data: { isActive: true },
  })

  await prisma.skillAuditLog.create({
    data: {
      adminId: req.userId,
      action: 'restore',
      fieldsChanged: { restoredVersionId: id },
    },
  })

  res.json(version)
})

export default router
