import { google } from 'googleapis'

export const SCOPES_MEMBER = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
]

export const SCOPES_ADMIN = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/gmail.send',
]

export function getAuthUrl(scopes: string[], state = 'user'): string {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  )
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
    state,
  })
}

export async function getTokens(code: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  )

  const maxRetries = 3
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { tokens } = await oauth2Client.getToken(code)
      return tokens
    } catch (err) {
      if (attempt === maxRetries) throw err
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Premature close') || msg.includes('ERR_STREAM_PREMATURE_CLOSE') || msg.includes('ECONNRESET')) {
        console.warn(`[googleAuth] Tentativa ${attempt}/${maxRetries} falhou (${msg}), retentando em 1s...`)
        await new Promise(r => setTimeout(r, 1000))
        continue
      }
      throw err
    }
  }

  throw new Error('Falha ao obter tokens após todas as tentativas')
}

export function getAuthenticatedClient(tokens: object) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  )
  client.setCredentials(tokens)
  return client
}
