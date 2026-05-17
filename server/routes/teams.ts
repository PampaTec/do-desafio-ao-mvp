import { Router } from 'express'
import { google } from 'googleapis'
import { requireAuth, requireAdmin, type AuthRequest } from '../middleware/auth.js'
import { getAuthenticatedClient } from '../services/googleAuth.js'
import { getAdminTokens } from '../services/tokenStore.js'
import {
  listarTeams,
  buscarTeamPorId,
  criarTeam,
  criarTeamMember,
  criarProgresso,
  carregarProgressoPorTeam,
  carregarMensagensChat,
  listarTeamMembers,
  listarProfiles,
  deletarTeamMember,
} from '../services/sheetsService.js'

const router = Router()

function getEffectiveTokens(req: AuthRequest) {
  const s = req.session as { tokens?: object } | null | undefined
  return getAdminTokens() || s?.tokens
}

async function enrichMembersWithProfiles(members: Record<string, string>[], tokens: object) {
  const profiles = await listarProfiles(tokens)
  return members.map(m => {
    const profile = m.user_id ? profiles.find(p => p.id === m.user_id) : null
    return {
      id: m.id,
      profile: profile
        ? { name: profile.name || null, email: profile.email }
        : m.user_id
          ? { name: null, email: m.invited_email || m.user_id }
          : null,
      invitedEmail: m.invited_email || null,
    }
  })
}

router.get('/', requireAdmin, async (req: AuthRequest, res) => {
  const tokens = getEffectiveTokens(req)
  if (!tokens) { res.status(401).json({ error: 'Tokens não disponíveis' }); return }

  const [teams, allMembers] = await Promise.all([
    listarTeams(tokens),
    listarTeamMembers(tokens),
  ])

  const enriched = await Promise.all(teams.map(async (team) => {
    const members = allMembers.filter(m => m.team_id === team.id)
    const progress = await carregarProgressoPorTeam(team.id, tokens)
    const messages = await carregarMensagensChat(team.id, tokens)
    const enrichedMembers = await enrichMembersWithProfiles(members, tokens)
    return {
      id: team.id,
      projectName: team.project_name,
      currentStage: parseInt(team.current_stage || '1'),
      status: team.status,
      createdAt: team.created_at,
      members: enrichedMembers,
      progress: progress.sort((a, b) => parseInt(a.stage) - parseInt(b.stage)).map(p => ({
        stage: parseInt(p.stage),
        status: p.status,
        stageOutput: p.stage_output || null,
      })),
      _count: { chatMessages: messages.length },
    }
  }))

  res.json(enriched)
})

router.get('/my', requireAuth, async (req: AuthRequest, res) => {
  const tokens = getEffectiveTokens(req)
  if (!tokens) { res.status(401).json({ error: 'Tokens não disponíveis' }); return }

  const allMembers = await listarTeamMembers(tokens)
  const membership = allMembers.find(m => m.user_id === req.userId)
  if (!membership) {
    res.json(null)
    return
  }

  const team = await buscarTeamPorId(membership.team_id, tokens)
  if (!team) { res.json(null); return }

  const members = allMembers.filter(m => m.team_id === team.id)
  const progress = await carregarProgressoPorTeam(team.id, tokens)

  const enrichedMembers = await enrichMembersWithProfiles(members, tokens)

  res.json({
    id: team.id,
    projectName: team.project_name,
    currentStage: parseInt(team.current_stage || '1'),
    status: team.status,
    createdAt: team.created_at,
    members: enrichedMembers,
    progress: progress.sort((a, b) => parseInt(a.stage) - parseInt(b.stage)).map(p => ({
      stage: parseInt(p.stage),
      status: p.status,
      stageOutput: p.stage_output || null,
    })),
  })
})

router.post('/', requireAdmin, async (req: AuthRequest, res) => {
  const tokens = getEffectiveTokens(req)
  if (!tokens) { res.status(401).json({ error: 'Tokens não disponíveis' }); return }

  const { projectName, memberEmails } = req.body as {
    projectName: string
    memberEmails: string[]
  }

  const teamId = crypto.randomUUID()
  await criarTeam({
    id: teamId,
    project_name: projectName,
    created_by: req.userId || '',
    current_stage: '1',
    status: 'active',
  }, tokens)

  for (const email of memberEmails) {
    await criarTeamMember({
      id: crypto.randomUUID(),
      team_id: teamId,
      user_id: '',
      invited_email: email,
    }, tokens)
  }

  for (let i = 0; i < 7; i++) {
    await criarProgresso({
      id: crypto.randomUUID(),
      team_id: teamId,
      stage: String(i + 1),
      status: i === 0 ? 'in_progress' : 'pending',
    }, tokens)
  }

  res.status(201).json({
    id: teamId,
    projectName,
    currentStage: 1,
    status: 'active',
    createdAt: new Date().toISOString(),
    members: memberEmails.map(email => ({
      id: '',
      profile: null,
      invitedEmail: email,
    })),
    progress: Array.from({ length: 7 }, (_, i) => ({
      stage: i + 1,
      status: i === 0 ? 'in_progress' : 'pending',
      stageOutput: null,
    })),
  })
})

router.get('/:id', requireAdmin, async (req, res) => {
  const tokens = getAdminTokens()
  if (!tokens) { res.status(401).json({ error: 'Tokens não disponíveis' }); return }

  const id = req.params.id as string
  const team = await buscarTeamPorId(id, tokens)
  if (!team) { res.status(404).json({ error: 'Time não encontrado' }); return }

  const [members, progress, messages] = await Promise.all([
    listarTeamMembers(tokens).then(m => m.filter(m => m.team_id === id)),
    carregarProgressoPorTeam(id, tokens),
    carregarMensagensChat(id, tokens),
  ])

  const enrichedMembers = await enrichMembersWithProfiles(members, tokens)

  res.json({
    id: team.id,
    projectName: team.project_name,
    currentStage: parseInt(team.current_stage || '1'),
    status: team.status,
    createdAt: team.created_at,
    members: enrichedMembers,
    progress: progress.sort((a, b) => parseInt(a.stage) - parseInt(b.stage)).map(p => ({
      stage: parseInt(p.stage),
      status: p.status,
      stageOutput: p.stage_output || null,
    })),
    chatMessages: messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.created_at,
    })),
  })
})

// ─── MEMBER MANAGEMENT ───────────────────────────────────

router.post('/:id/members', requireAdmin, async (req: AuthRequest, res) => {
  const tokens = getEffectiveTokens(req)
  if (!tokens) { res.status(401).json({ error: 'Tokens não disponíveis' }); return }

  const teamId = req.params.id as string
  const { email } = req.body as { email: string }

  if (!email) {
    res.status(400).json({ error: 'Email é obrigatório' })
    return
  }

  const team = await buscarTeamPorId(teamId, tokens)
  if (!team) { res.status(404).json({ error: 'Time não encontrado' }); return }

  // Verifica se já é membro
  const allMembers = await listarTeamMembers(tokens)
  const existing = allMembers.find(m => m.team_id === teamId && (m.invited_email === email || m.user_id === email))
  if (existing) {
    res.status(400).json({ error: 'Este email já é membro do time' })
    return
  }

  await criarTeamMember({
    id: crypto.randomUUID(),
    team_id: teamId,
    user_id: '',
    invited_email: email,
  }, tokens)

  res.status(201).json({ message: 'Membro adicionado' })
})

router.delete('/:id/members/:memberId', requireAdmin, async (req: AuthRequest, res) => {
  const tokens = getEffectiveTokens(req)
  if (!tokens) { res.status(401).json({ error: 'Tokens não disponíveis' }); return }

  const memberId = req.params.memberId as string

  try {
    await deletarTeamMember(memberId, tokens)
    res.json({ message: 'Membro removido' })
  } catch (err) {
    console.error('Erro ao remover membro:', err)
    res.status(500).json({ error: 'Erro ao remover membro' })
  }
})

router.patch('/:id/advance', requireAuth, async (req: AuthRequest, res) => {
  const tokens = getEffectiveTokens(req)
  if (!tokens) { res.status(401).json({ error: 'Tokens não disponíveis' }); return }

  const id = req.params.id as string
  const team = await buscarTeamPorId(id, tokens)
  if (!team) { res.status(404).json({ error: 'Time não encontrado' }); return }

  let currentStage = parseInt(team.current_stage || '1')
  if (currentStage >= 7) {
    const sheets = google.sheets({ version: 'v4', auth: getAuthenticatedClient(tokens) })
    const teamsList = await listarTeams(tokens)
    const teamIdx = teamsList.findIndex(t => t.id === id) + 2
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.PROGRESS_SHEET_ID!,
      range: `TEAMS!F${teamIdx}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['completed']] },
    })
    res.json({ message: 'Jornada concluída' })
    return
  }

  const nextStage = currentStage + 1
  const sheets = google.sheets({ version: 'v4', auth: getAuthenticatedClient(tokens) })
  const teamsList = await listarTeams(tokens)
  const teamIdx = teamsList.findIndex(t => t.id === id) + 2
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.PROGRESS_SHEET_ID!,
    range: `TEAMS!E${teamIdx}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[String(nextStage)]] },
  })

  res.json({ id, currentStage: nextStage })
})

router.delete('/:id', requireAdmin, async (req, res) => {
  const tokens = getAdminTokens()
  if (!tokens) { res.status(401).json({ error: 'Tokens não disponíveis' }); return }

  const id = req.params.id as string
  const sheets = google.sheets({ version: 'v4', auth: getAuthenticatedClient(tokens) })

  const deleteTeamRows = async (range: string) => {
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.PROGRESS_SHEET_ID!,
      range,
    })
    const rows = result.data.values || []
    for (let i = rows.length - 1; i > 0; i--) {
      if (rows[i][1] === id) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: process.env.PROGRESS_SHEET_ID!,
          requestBody: {
            requests: [{
              deleteDimension: {
                range: { sheetId: 0, dimension: 'ROWS', startIndex: i, endIndex: i + 1 },
              },
            }],
          },
        })
      }
    }
  }

  try {
    await Promise.all([
      deleteTeamRows('TEAM_MEMBERS!A:E'),
      deleteTeamRows('CHAT_MESSAGES!A:F'),
      deleteTeamRows('TEAM_PROGRESS!A:G'),
      deleteTeamRows('TEAMS!A:F'),
    ])
  } catch (err) {
    console.error('Erro ao excluir time:', err)
  }

  res.json({ message: 'Time excluído' })
})

export default router
