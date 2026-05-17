import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const BACKEND_URL = process.argv[2] || 'http://localhost:3001'
const SKILL_FILE = path.join(__dirname, '..', 'skill-desafio-ao-mvp.md')

async function main() {
  const contentMd = fs.readFileSync(SKILL_FILE, 'utf-8')
  console.log(`[seed-skill] Lendo skill de ${SKILL_FILE} (${contentMd.length} chars)`)
  console.log(`[seed-skill] Backend: ${BACKEND_URL}`)

  const res = await fetch(`${BACKEND_URL}/api/skill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      versionLabel: 'v1.0.0',
      contentMd,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    console.error(`[seed-skill] Erro ${res.status}:`, err)
    process.exit(1)
  }

  const data = await res.json()
  console.log('[seed-skill] Skill salva com sucesso:', data)
}

main().catch(console.error)
