import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TOKEN_FILE = path.join(__dirname, '..', '..', '.admin-tokens.json')

let adminTokens: object | null = null

function carregarTokensDoArquivo() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = fs.readFileSync(TOKEN_FILE, 'utf-8')
      const tokens = JSON.parse(data)
      if (tokens && (tokens as Record<string, unknown>).access_token) {
        adminTokens = tokens
        console.log('[tokenStore] Tokens Admin restaurados do arquivo.')
      }
    }
  } catch (err) {
    console.warn('[tokenStore] Erro ao ler tokens do arquivo:', (err as Error).message)
  }
}

export function salvarTokensAdmin(tokens: object) {
  adminTokens = tokens
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), 'utf-8')
    console.log('[tokenStore] Tokens Admin salvos em disco.')
  } catch (err) {
    console.warn('[tokenStore] Erro ao salvar tokens em disco:', (err as Error).message)
  }
}

export function getAdminTokens(): object | null {
  if (!adminTokens) {
    carregarTokensDoArquivo()
  }
  if (!adminTokens) {
    console.warn('[tokenStore] Nenhum token Admin disponível. Faça login como Admin primeiro.')
  }
  return adminTokens
}
