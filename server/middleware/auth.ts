import type { Request, Response, NextFunction } from 'express'

export interface AuthRequest extends Request {
  userId?: string
  userRole?: string
  userEmail?: string
}

function getSession(req: Request) {
  return req.session as { tokens?: object; userId?: string; role?: string; email?: string } | null | undefined
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const s = getSession(req)
  if (!s?.tokens) {
    res.status(401).json({ error: 'Não autorizado. Faça login primeiro.' })
    return
  }
  req.userId = s.userId
  req.userRole = s.role
  req.userEmail = s.email
  next()
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const s = getSession(req)
  if (!s?.tokens) {
    res.status(401).json({ error: 'Não autorizado. Faça login primeiro.' })
    return
  }
  if (s.role !== 'admin') {
    res.status(403).json({ error: 'Acesso restrito a administradores' })
    return
  }
  req.userId = s.userId
  req.userRole = 'admin'
  req.userEmail = s.email
  next()
}
