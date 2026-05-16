import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import prisma from '../db/prisma.js'

const router = Router()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

router.post('/login', async (req, res) => {
  const { access_token } = req.body
  if (!access_token) {
    res.status(400).json({ error: 'access_token é obrigatório' })
    return
  }

  const { data: { user }, error } = await supabase.auth.getUser(access_token)
  if (error || !user) {
    res.status(401).json({ error: 'Token inválido' })
    return
  }

  const googleId = user.identities?.[0]?.id
  const email = user.email

  if (!email) {
    res.status(400).json({ error: 'Email não disponível' })
    return
  }

  let profile = await prisma.profile.findUnique({ where: { id: user.id } })

  if (!profile) {
    profile = await prisma.profile.create({
      data: {
        id: user.id,
        googleId,
        email,
        name: user.user_metadata?.full_name ?? email.split('@')[0],
        role: 'member',
      },
    })
  }

  const team = await prisma.teamMember.findFirst({
    where: { userId: user.id },
    include: { team: true },
  })

  res.json({
    profile,
    hasTeam: !!team,
    team: team?.team ?? null,
  })
})

export default router
