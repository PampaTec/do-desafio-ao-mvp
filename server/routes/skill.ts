import { Router } from 'express'
import { google } from 'googleapis'
import { requireAdmin, type AuthRequest } from '../middleware/auth.js'
import { getAuthenticatedClient as getAuthClient } from '../services/googleAuth.js'
import { getAdminTokens } from '../services/tokenStore.js'
import {
  listarSkillVersions,
  buscarSkillAtiva,
  buscarSkillVersionPorId,
  criarSkillVersion,
  desativarTodasSkills,
  registrarAuditoriaSkill,
} from '../services/sheetsService.js'

const router = Router()

function getTokens() {
  const t = getAdminTokens()
  return t
}

router.get('/', async (_req, res) => {
  const tokens = getTokens()
  if (!tokens) { res.status(401).json({ error: 'Tokens não disponíveis' }); return }

  const skills = await listarSkillVersions(tokens)
  res.json(skills.slice(0, 5).map(s => ({
    id: s.id,
    versionLabel: s.version_label,
    contentMd: s.content_md,
    isActive: s.is_active === 'true',
    createdAt: s.created_at,
  })))
})

router.get('/active', async (_req, res) => {
  const tokens = getTokens()
  if (!tokens) { res.status(401).json({ error: 'Tokens não disponíveis' }); return }

  const skill = await buscarSkillAtiva(tokens)
  if (!skill) { res.json(null); return }

  res.json({
    id: skill.id,
    versionLabel: skill.version_label,
    contentMd: skill.content_md,
    isActive: true,
    createdAt: skill.created_at,
  })
})

router.post('/', requireAdmin, async (req: AuthRequest, res) => {
  const tokens = getTokens()
  if (!tokens) { res.status(401).json({ error: 'Tokens não disponíveis' }); return }

  const { versionLabel, contentMd } = req.body as {
    versionLabel: string
    contentMd: string
  }

  await desativarTodasSkills(tokens)

  const skillId = crypto.randomUUID()
  await criarSkillVersion({
    id: skillId,
    version_label: versionLabel,
    content_md: contentMd,
    created_by: req.userId || '',
    is_active: 'true',
  }, tokens)

  await registrarAuditoriaSkill({
    id: crypto.randomUUID(),
    admin_id: req.userId || '',
    action: 'create',
    fields_changed: JSON.stringify({ versionLabel, isActive: true }),
  }, tokens)

  const allVersions = await listarSkillVersions(tokens)
  if (allVersions.length > 5) {
    const inactiveVersions = allVersions
      .filter(v => v.is_active !== 'true')
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
    if (inactiveVersions.length > 0) {
      const sheets = google.sheets({ version: 'v4', auth: getAuthClient(tokens) })
      const idx = allVersions.indexOf(inactiveVersions[0]) + 1
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: process.env.PROGRESS_SHEET_ID!,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: { sheetId: 5, dimension: 'ROWS', startIndex: idx, endIndex: idx + 1 },
            },
          }],
        },
      })
    }
  }

  res.status(201).json({
    id: skillId,
    versionLabel,
    contentMd,
    isActive: true,
    createdAt: new Date().toISOString(),
  })
})

router.post('/:id/restore', requireAdmin, async (req: AuthRequest, res) => {
  const tokens = getTokens()
  if (!tokens) { res.status(401).json({ error: 'Tokens não disponíveis' }); return }

  const id = req.params.id as string
  const version = await buscarSkillVersionPorId(id, tokens)
  if (!version) {
    res.status(404).json({ error: 'Versão não encontrada' })
    return
  }

  await desativarTodasSkills(tokens)

  const sheets = google.sheets({ version: 'v4', auth: getAuthClient(tokens) })
  const allVersions = await listarSkillVersions(tokens)
  const idx = allVersions.findIndex(v => v.id === version.id) + 1
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.PROGRESS_SHEET_ID!,
    range: `SKILL_VERSIONS!F${idx}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [['true']] },
  })

  await registrarAuditoriaSkill({
    id: crypto.randomUUID(),
    admin_id: req.userId || '',
    action: 'restore',
    fields_changed: JSON.stringify({ restoredVersionId: id }),
  }, tokens)

  res.json({
    id: version.id,
    versionLabel: version.version_label,
    contentMd: version.content_md,
    isActive: true,
    createdAt: version.created_at,
  })
})

export default router
