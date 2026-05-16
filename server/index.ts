import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth.js'
import teamsRoutes from './routes/teams.js'
import chatRoutes from './routes/chat.js'
import skillRoutes from './routes/skill.js'
import statsRoutes from './routes/stats.js'

const app = express()
const PORT = process.env.PORT ?? 3001

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5174' }))
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/auth', authRoutes)
app.use('/api/teams', teamsRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/skill', skillRoutes)
app.use('/api/stats', statsRoutes)

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`)
})
