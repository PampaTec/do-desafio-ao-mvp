import 'dotenv/config'
import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TOKEN_FILE = path.join(__dirname, '..', '.admin-tokens.json')

const REQUIRED_TABS: Record<string, string[]> = {
  PROFILES: ['id', 'google_id', 'email', 'name', 'role', 'created_at'],
  TEAMS: ['id', 'project_name', 'created_by', 'created_at', 'current_stage', 'status'],
  TEAM_MEMBERS: ['id', 'team_id', 'user_id', 'invited_email', 'joined_at'],
  CHAT_MESSAGES: ['id', 'team_id', 'role', 'content', 'stage', 'created_at'],
  TEAM_PROGRESS: ['id', 'team_id', 'stage', 'status', 'stage_output', 'completed_at', 'updated_at'],
  SKILL_VERSIONS: ['id', 'version_label', 'content_md', 'created_by', 'created_at', 'is_active'],
  SKILL_AUDIT_LOG: ['id', 'admin_id', 'action', 'fields_changed', 'created_at'],
}

async function main() {
  const sheetId = process.env.PROGRESS_SHEET_ID
  if (!sheetId) {
    console.error('❌ PROGRESS_SHEET_ID não definido no .env')
    process.exit(1)
  }

  if (!fs.existsSync(TOKEN_FILE)) {
    console.error('❌ Arquivo .admin-tokens.json não encontrado.')
    console.error('')
    console.error('Para gerá-lo:')
    console.error('  1. Inicie o servidor: npm run dev:server')
    console.error('  2. Inicie o frontend: npm run dev')
    console.error('  3. Acesse http://localhost:5174')
    console.error('  4. Faça login com Google usando o email do ADMIN_EMAIL no .env')
    console.error('  5. Execute este script novamente')
    process.exit(1)
  }

  const tokensRaw = fs.readFileSync(TOKEN_FILE, 'utf-8')
  const tokens = JSON.parse(tokensRaw)

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  )
  oauth2Client.setCredentials(tokens)

  const sheets = google.sheets({ version: 'v4', auth: oauth2Client })

  console.log(`📄 Obtendo planilha ${sheetId}...`)
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId })
  const existingTabs = spreadsheet.data.sheets
    ?.map(s => s.properties?.title)
    .filter(Boolean) as string[] || []

  console.log(`   Abas existentes: ${existingTabs.join(', ') || '(nenhuma)'}`)

  for (const [tabName, headers] of Object.entries(REQUIRED_TABS)) {
    if (existingTabs.includes(tabName)) {
      console.log(`   ✅ "${tabName}" já existe`)
      continue
    }

    console.log(`   ➕ Criando aba "${tabName}"...`)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName } } }],
      },
    })

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${tabName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [headers] },
    })

    console.log(`      Cabeçalhos: ${headers.join(', ')}`)
  }

  console.log('')
  console.log('✅ Planilha inicializada com sucesso!')
}

main().catch(err => {
  console.error('❌ Erro:', err.message)
  process.exit(1)
})
