import { Router } from 'express'
import { google } from 'googleapis'
import { getAuthUrl, getTokens, getAuthenticatedClient, SCOPES_MEMBER, SCOPES_ADMIN } from '../services/googleAuth.js'
import { getAdminTokens, salvarTokensAdmin } from '../services/tokenStore.js'
import { buscarProfilePorEmail, criarProfile, atualizarTeamMemberPorEmail } from '../services/sheetsService.js'
import type { AuthRequest } from '../middleware/auth.js'

const router = Router()

router.get('/google', (_req, res) => {
  const url = getAuthUrl(SCOPES_MEMBER, 'user')
  res.redirect(url)
})

router.get('/google/admin', (_req, res) => {
  const url = getAuthUrl(SCOPES_ADMIN, 'admin')
  res.redirect(url)
})

router.get('/google/callback', async (req, res) => {
  const { code, error, state } = req.query as { code?: string; error?: string; state?: string }

  if (error) {
    res.status(400).json({ error: 'Falha na autenticação', details: error })
    return
  }

  if (!code) {
    res.status(400).json({ error: 'Código de autorização não fornecido' })
    return
  }

  try {
    const tokens = await getTokens(code)
    console.log('[debug] tokens recebidos, scope:', (tokens as any).scope)
    console.log('[debug] access_token presente:', !!(tokens as any).access_token)
    console.log('[debug] refresh_token presente:', !!(tokens as any).refresh_token)
    const session = req.session as { tokens?: object; userId?: string; role?: string; email?: string }
    session.tokens = tokens

    const client = getAuthenticatedClient(tokens)
    const oauth2 = google.oauth2({ version: 'v2', auth: client })
    const userInfo = await oauth2.userinfo.get()
    const userEmail = userInfo.data.email
    const userName = userInfo.data.name || userEmail?.split('@')[0] || ''
    const googleId = userInfo.data.id || ''

    if (!userEmail) {
      res.status(400).json({ error: 'Email não disponível' })
      return
    }

    // Determinar role: apenas ADMIN_EMAIL é admin
    const isAdmin = userEmail === process.env.ADMIN_EMAIL
    let role = isAdmin ? 'admin' : 'user'

    // Salvar tokens admin apenas se for realmente o admin (para escopos elevados)
    if (isAdmin) {
      salvarTokensAdmin(tokens)
    }

    const adminTokens = getAdminTokens()
    const effectiveTokens = adminTokens || tokens
    console.log('[debug] tokens scope:', (tokens as any).scope)
    console.log('[debug] adminTokens scope:', (adminTokens as any)?.scope)

    let profile = await buscarProfilePorEmail(userEmail, effectiveTokens)

    if (!profile) {
      const id = crypto.randomUUID()
      await criarProfile({
        id,
        google_id: googleId,
        email: userEmail,
        name: userName,
        role,
      }, effectiveTokens)
      profile = { id: id, google_id: googleId, email: userEmail, name: userName, role }
    }

    // Usar a role do profile existente (pode ter sido alterada manualmente na planilha)
    const effectiveRole = profile.role || role

    session.userId = profile.id
    session.role = effectiveRole
    session.email = userEmail

    await atualizarTeamMemberPorEmail(userEmail, { user_id: profile.id }, effectiveTokens)

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174'
    const redirectPath = effectiveRole === 'admin' ? '/admin' : '/team'
    res.redirect(`${frontendUrl}${redirectPath}`)
  } catch (err) {
    console.error('Erro no callback OAuth:', err)
    res.status(500).json({ error: 'Erro ao processar tokens' })
  }
})

router.get('/logout', (req, res) => {
  req.session = null
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174'
  res.redirect(`${frontendUrl}/`)
})

router.get('/status', (req: AuthRequest, res) => {
  const session = req.session as { userId?: string; role?: string; email?: string } | null | undefined
  if (!session?.userId) {
    res.json({ authenticated: false })
    return
  }

  res.json({
    authenticated: true,
    profile: {
      id: session.userId,
      email: session.email,
      name: session.email?.split('@')[0],
      role: session.role,
    },
  })
})

export default router
