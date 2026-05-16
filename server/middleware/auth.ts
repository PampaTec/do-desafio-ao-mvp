import type { Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export interface AuthRequest extends Request {
  userId?: string
  userRole?: string
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    res.status(401).json({ error: 'Token não fornecido' })
    return
  }

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    res.status(401).json({ error: 'Token inválido' })
    return
  }

  req.userId = user.id
  next()
}

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  await requireAuth(req, res, async () => {
    const profile = await import('../db/prisma.js').then(m => m.default.profile.findUnique({
      where: { id: req.userId },
    }))

    if (!profile || profile.role !== 'admin') {
      res.status(403).json({ error: 'Acesso restrito a administradores' })
      return
    }

    req.userRole = 'admin'
    next()
  })
}
