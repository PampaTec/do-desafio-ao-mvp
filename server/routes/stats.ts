import { Router } from 'express'
import prisma from '../db/prisma.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()

router.get('/', requireAdmin, async (_req, res) => {
  const [activeTeams, completedTeams, totalMembers, skillsUsing] = await Promise.all([
    prisma.team.count({ where: { status: 'active' } }),
    prisma.team.count({ where: { status: 'completed' } }),
    prisma.profile.count({ where: { role: 'member' } }),
    prisma.team.count({ where: { status: 'active' } }),
  ])

  res.json({
    activeTeams,
    completedTeams,
    totalMembers,
    totalTeams: activeTeams + completedTeams,
    skillsUsing,
  })
})

export default router
