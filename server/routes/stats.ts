import { Router } from 'express'
import { requireAdmin, type AuthRequest } from '../middleware/auth.js'
import { getAdminTokens } from '../services/tokenStore.js'
import { listarTeams, listarProfiles } from '../services/sheetsService.js'

const router = Router()

router.get('/', requireAdmin, async (_req: AuthRequest, res) => {
  const tokens = getAdminTokens()
  if (!tokens) { res.status(401).json({ error: 'Tokens não disponíveis' }); return }

  const [teams, profiles] = await Promise.all([
    listarTeams(tokens),
    listarProfiles(tokens),
  ])

  const activeTeams = teams.filter(t => t.status === 'active').length
  const completedTeams = teams.filter(t => t.status === 'completed').length
  const totalMembers = profiles.filter(p => p.role === 'member' || p.role === 'user').length

  res.json({
    activeTeams,
    completedTeams,
    totalMembers,
    totalTeams: teams.length,
    skillsUsing: activeTeams,
  })
})

export default router
