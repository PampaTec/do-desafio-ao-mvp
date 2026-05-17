import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieSession from 'cookie-session'
import authRoutes from './routes/auth.js'
import teamsRoutes from './routes/teams.js'
import chatRoutes from './routes/chat.js'
import skillRoutes from './routes/skill.js'
import statsRoutes from './routes/stats.js'

const app = express()
const PORT = process.env.PORT ?? 3001
const isProd = process.env.NODE_ENV === 'production' || !!process.env.RENDER

if (isProd) {
  app.set('trust proxy', 1)
}

app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5174',
  credentials: true,
}))
app.use(express.json())
app.use(cookieSession({
  name: 'pampatec-session',
  keys: [process.env.COOKIE_KEY || 'pampatec-secret-key'],
  maxAge: 24 * 60 * 60 * 1000,
  sameSite: isProd ? 'none' : 'lax',
  secure: isProd,
}))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/auth', authRoutes)
app.use('/api/teams', teamsRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/skill', skillRoutes)
app.use('/api/stats', statsRoutes)

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`)
})
