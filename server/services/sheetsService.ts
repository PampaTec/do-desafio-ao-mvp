import { google } from 'googleapis'
import { getAuthenticatedClient } from './googleAuth.js'

const SHEET_ID = process.env.PROGRESS_SHEET_ID!

const REQUIRED_TABS: Record<string, string[]> = {
  PROFILES: ['id', 'google_id', 'email', 'name', 'role', 'created_at'],
  TEAMS: ['id', 'project_name', 'created_by', 'created_at', 'current_stage', 'status'],
  TEAM_MEMBERS: ['id', 'team_id', 'user_id', 'invited_email', 'joined_at'],
  CHAT_MESSAGES: ['id', 'team_id', 'role', 'content', 'stage', 'created_at'],
  TEAM_PROGRESS: ['id', 'team_id', 'stage', 'status', 'stage_output', 'completed_at', 'updated_at'],
  SKILL_VERSIONS: ['id', 'version_label', 'content_md', 'created_by', 'created_at', 'is_active'],
  SKILL_AUDIT_LOG: ['id', 'admin_id', 'action', 'fields_changed', 'created_at'],
}

let initPromise: Promise<void> | null = null
let initSuccess = false

export async function ensureSheetsInitialized(tokens: object): Promise<void> {
  const auth = getAuthenticatedClient(tokens)
  const sheets = google.sheets({ version: 'v4', auth })

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID })
  const existingTabs = spreadsheet.data.sheets
    ?.map(s => s.properties?.title)
    .filter(Boolean) as string[] || []

  for (const [tabName, headers] of Object.entries(REQUIRED_TABS)) {
    if (existingTabs.includes(tabName)) continue

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName } } }],
      },
    })

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${tabName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [headers] },
    })

    console.log(`[sheets] Aba "${tabName}" criada com cabeçalhos.`)
  }

  initSuccess = true
  console.log('[sheets] Todas as abas verificadas/criadas com sucesso.')
}

async function getSheetsClient(tokens: object) {
  const auth = getAuthenticatedClient(tokens)
  const sheets = google.sheets({ version: 'v4', auth })
  if (!initPromise || !initSuccess) {
    initPromise = ensureSheetsInitialized(tokens).catch(err => {
      console.warn('[sheets] Não foi possível inicializar abas:', (err as Error).message)
      initPromise = null // Reset para tentar novamente na próxima chamada
      throw err
    })
  }
  await initPromise
  return sheets
}

function normalizarChave(key: string) {
  return key.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

function montarObjeto(cabecalho: string[], row: string[]) {
  const obj: Record<string, string> = {}
  cabecalho.forEach((key, i) => {
    obj[normalizarChave(key)] = row[i] || ''
  })
  return obj
}

// ─── PROFILES ────────────────────────────────────────────

export async function criarProfile(dados: {
  id: string; google_id: string; email: string; name: string; role: string
}, tokens: object) {
  const sheets = await getSheetsClient(tokens)
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'PROFILES!A:F',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[dados.id, dados.google_id, dados.email, dados.name, dados.role, new Date().toISOString()]],
    },
  })
}

export async function listarProfiles(tokens: object) {
  const sheets = await getSheetsClient(tokens)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'PROFILES!A:F',
  })
  const rows = res.data.values || []
  if (rows.length === 0) return []
  const cabecalho = rows[0]
  return rows.slice(1).map(row => montarObjeto(cabecalho, row))
}

export async function buscarProfilePorEmail(email: string, tokens: object) {
  const profiles = await listarProfiles(tokens)
  return profiles.find(p => p.email === email) || null
}

export async function buscarProfilePorId(id: string, tokens: object) {
  const profiles = await listarProfiles(tokens)
  return profiles.find(p => p.id === id) || null
}

// ─── TEAMS ───────────────────────────────────────────────

export async function criarTeam(dados: {
  id: string; project_name: string; created_by: string; current_stage: string; status: string
}, tokens: object) {
  const sheets = await getSheetsClient(tokens)
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'TEAMS!A:F',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[dados.id, dados.project_name, dados.created_by, new Date().toISOString(), dados.current_stage, dados.status]],
    },
  })
}

export async function listarTeams(tokens: object) {
  const sheets = await getSheetsClient(tokens)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'TEAMS!A:F',
  })
  const rows = res.data.values || []
  if (rows.length === 0) return []
  const cabecalho = rows[0]
  return rows.slice(1).map(row => montarObjeto(cabecalho, row))
}

export async function buscarTeamPorId(id: string, tokens: object) {
  const teams = await listarTeams(tokens)
  return teams.find(t => t.id === id) || null
}

export async function atualizarTeam(id: string, dados: Partial<Record<string, string>>, tokens: object) {
  const sheets = await getSheetsClient(tokens)
  const teams = await listarTeams(tokens)
  const team = teams.find(t => t.id === id)
  if (!team) return

  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'TEAMS!A1:F1',
  })
  const cabecalho = headerRes.data.values?.[0] || []
  const rowIndex = teams.indexOf(team) + 2

  for (const [key, value] of Object.entries(dados)) {
    const colIndex = cabecalho.findIndex(h => normalizarChave(h) === key)
    if (colIndex === -1) continue
    const col = String.fromCharCode(65 + colIndex)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `TEAMS!${col}${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[value]] },
    })
  }
}

// ─── TEAM MEMBERS ────────────────────────────────────────

export async function criarTeamMember(dados: {
  id: string; team_id: string; user_id: string; invited_email: string
}, tokens: object) {
  const sheets = await getSheetsClient(tokens)
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'TEAM_MEMBERS!A:E',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[dados.id, dados.team_id, dados.user_id, dados.invited_email, new Date().toISOString()]],
    },
  })
}

export async function listarTeamMembers(tokens: object) {
  const sheets = await getSheetsClient(tokens)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'TEAM_MEMBERS!A:E',
  })
  const rows = res.data.values || []
  if (rows.length === 0) return []
  const cabecalho = rows[0]
  return rows.slice(1).map(row => montarObjeto(cabecalho, row))
}

export async function buscarMembroPorUserId(userId: string, tokens: object) {
  const members = await listarTeamMembers(tokens)
  return members.find(m => m.user_id === userId) || null
}

export async function atualizarTeamMemberPorEmail(email: string, dados: Partial<Record<string, string>>, tokens: object) {
  const sheets = await getSheetsClient(tokens)
  const members = await listarTeamMembers(tokens)
  const member = members.find(m => m.invited_email === email && !m.user_id)
  if (!member) return

  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'TEAM_MEMBERS!A1:E1',
  })
  const cabecalho = headerRes.data.values?.[0] || []
  const rowIndex = members.indexOf(member) + 2

  for (const [key, value] of Object.entries(dados)) {
    const colIndex = cabecalho.findIndex(h => normalizarChave(h) === key)
    if (colIndex === -1) continue
    const col = String.fromCharCode(65 + colIndex)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `TEAM_MEMBERS!${col}${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[value]] },
    })
  }
}

// ─── CHAT MESSAGES ───────────────────────────────────────

export async function salvarMensagemChat(dados: {
  id: string; team_id: string; role: string; content: string; stage: string
}, tokens: object) {
  const sheets = await getSheetsClient(tokens)
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'CHAT_MESSAGES!A:F',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[dados.id, dados.team_id, dados.role, dados.content, dados.stage, new Date().toISOString()]],
    },
  })
}

export async function carregarMensagensChat(teamId: string, tokens: object) {
  const sheets = await getSheetsClient(tokens)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'CHAT_MESSAGES!A:F',
  })
  const rows = res.data.values || []
  if (rows.length === 0) return []
  const cabecalho = rows[0]
  return rows.slice(1)
    .filter(row => row[1] === teamId)
    .map(row => montarObjeto(cabecalho, row))
}

// ─── TEAM PROGRESS ───────────────────────────────────────

export async function criarProgresso(dados: {
  id: string; team_id: string; stage: string; status: string
}, tokens: object) {
  const sheets = await getSheetsClient(tokens)
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'TEAM_PROGRESS!A:G',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[dados.id, dados.team_id, dados.stage, dados.status, '', '', new Date().toISOString()]],
    },
  })
}

export async function listarProgresso(tokens: object) {
  const sheets = await getSheetsClient(tokens)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'TEAM_PROGRESS!A:G',
  })
  const rows = res.data.values || []
  if (rows.length === 0) return []
  const cabecalho = rows[0]
  return rows.slice(1).map(row => montarObjeto(cabecalho, row))
}

export async function carregarProgressoPorTeam(teamId: string, tokens: object) {
  const progresso = await listarProgresso(tokens)
  return progresso.filter(p => p.team_id === teamId)
}

export async function atualizarProgresso(id: string, dados: Partial<Record<string, string>>, tokens: object) {
  const sheets = await getSheetsClient(tokens)
  const allProgress = await listarProgresso(tokens)
  const prog = allProgress.find(p => p.id === id)
  if (!prog) return

  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'TEAM_PROGRESS!A1:G1',
  })
  const cabecalho = headerRes.data.values?.[0] || []
  const rowIndex = allProgress.indexOf(prog) + 2

  for (const [key, value] of Object.entries(dados)) {
    const colIndex = cabecalho.findIndex(h => normalizarChave(h) === key)
    if (colIndex === -1) continue
    const col = String.fromCharCode(65 + colIndex)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `TEAM_PROGRESS!${col}${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[value]] },
    })
  }
}

// ─── SKILL VERSIONS ──────────────────────────────────────

export async function criarSkillVersion(dados: {
  id: string; version_label: string; content_md: string; created_by: string; is_active: string
}, tokens: object) {
  const sheets = await getSheetsClient(tokens)
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'SKILL_VERSIONS!A:F',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[dados.id, dados.version_label, dados.content_md, dados.created_by, new Date().toISOString(), dados.is_active]],
    },
  })
}

export async function listarSkillVersions(tokens: object) {
  const sheets = await getSheetsClient(tokens)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'SKILL_VERSIONS!A:F',
  })
  const rows = res.data.values || []
  if (rows.length === 0) return []
  const cabecalho = rows[0]
  return rows.slice(1).map(row => montarObjeto(cabecalho, row))
}

export async function buscarSkillAtiva(tokens: object) {
  const versions = await listarSkillVersions(tokens)
  return versions.find(v => v.is_active === 'true') || null
}

export async function buscarSkillVersionPorId(id: string, tokens: object) {
  const versions = await listarSkillVersions(tokens)
  return versions.find(v => v.id === id) || null
}

export async function desativarTodasSkills(tokens: object) {
  const versions = await listarSkillVersions(tokens)
  for (const v of versions) {
    if (v.is_active === 'true') {
      await atualizarSheetCell('SKILL_VERSIONS', 'F', versions.indexOf(v) + 2, 'false', tokens)
    }
  }
}

export async function deletarSkillVersion(id: string, tokens: object) {
  const sheets = await getSheetsClient(tokens)
  const versions = await listarSkillVersions(tokens)
  const version = versions.find(v => v.id === id)
  if (!version) return
  const rowIndex = versions.indexOf(version) + 2
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: 0,
            dimension: 'ROWS',
            startIndex: rowIndex - 1,
            endIndex: rowIndex,
          },
        },
      }],
    },
  })
}

// ─── SKILL AUDIT LOG ─────────────────────────────────────

export async function registrarAuditoriaSkill(dados: {
  id: string; admin_id: string; action: string; fields_changed: string
}, tokens: object) {
  const sheets = await getSheetsClient(tokens)
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'SKILL_AUDIT_LOG!A:E',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[dados.id, dados.admin_id, dados.action, dados.fields_changed, new Date().toISOString()]],
    },
  })
}

// ─── HELPERS ─────────────────────────────────────────────

async function getSheetIdByName(tabName: string, tokens: object): Promise<number | null> {
  const auth = getAuthenticatedClient(tokens)
  const sheets = google.sheets({ version: 'v4', auth })
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID })
  const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === tabName)
  return sheet?.properties?.sheetId ?? null
}

export async function deletarTeamMember(memberId: string, tokens: object) {
  const sheets = await getSheetsClient(tokens)
  const members = await listarTeamMembers(tokens)
  const member = members.find(m => m.id === memberId)
  if (!member) return

  const sheetId = await getSheetIdByName('TEAM_MEMBERS', tokens)
  if (sheetId === null) return

  const rowIndex = members.indexOf(member) + 2
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex - 1,
            endIndex: rowIndex,
          },
        },
      }],
    },
  })
}

async function atualizarSheetCell(range: string, col: string, rowIndex: number, value: string, tokens: object) {
  const sheets = await getSheetsClient(tokens)
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${range}!${col}${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] },
  })
}
