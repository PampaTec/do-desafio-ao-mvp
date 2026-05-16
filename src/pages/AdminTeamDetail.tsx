import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { teamsApi } from '../lib/api'
import { StageProgressStepper } from '../components/StageProgressStepper'
import { ChatBubble } from '../components/ChatBubble'
import { showToast } from '../lib/toast'

interface TeamDetail {
  id: string
  projectName: string
  currentStage: number
  status: string
  members: { id: string; profile: { name: string | null; email: string } | null; invitedEmail: string | null }[]
  progress: { stage: number; status: string; stageOutput: string | null }[]
  chatMessages: { id: string; role: string; content: string; createdAt: string }[]
}

export function AdminTeamDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [team, setTeam] = useState<TeamDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    teamsApi.get(id)
      .then((data) => {
        const teamData = data as unknown as TeamDetail
        setTeam(teamData)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  async function handleAdvance() {
    if (!id) return
    try {
      await teamsApi.advance(id)
      const data = await teamsApi.get(id)
      setTeam(data as unknown as TeamDetail)
      showToast('Etapa avançada', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao avançar', 'error')
    }
  }

  async function handleDelete() {
    if (!id || !confirm('Excluir este time permanentemente?')) return
    try {
      await teamsApi.delete(id)
      showToast('Time excluído', 'success')
      navigate('/admin')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao excluir', 'error')
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-dark-bg">
        <div className="text-dark-text">Carregando...</div>
      </div>
    )
  }

  if (!team) {
    return (
      <div className="flex h-screen items-center justify-center bg-dark-bg">
        <div className="text-dark-text">Time não encontrado</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      <Header title={team.projectName} />

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <span className={`text-xs px-2 py-1 rounded ${
              team.status === 'active' ? 'bg-primary/20 text-primary' :
              team.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
              'bg-secondary/20 text-secondary'
            }`}>
              {team.status === 'active' ? 'Ativo' : team.status === 'completed' ? 'Concluído' : 'Pausado'}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdvance}
              disabled={team.status === 'completed'}
              className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs hover:brightness-110 disabled:opacity-50"
            >
              Avançar Etapa
            </button>
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 border border-red-500 text-red-500 rounded-lg text-xs hover:bg-red-500/10"
            >
              Excluir
            </button>
          </div>
        </div>

        <StageProgressStepper currentStage={team.currentStage} progress={team.progress} />

        <div>
          <h3 className="text-dark-text text-sm font-semibold mb-2">Membros</h3>
          <div className="space-y-1">
            {team.members.map(m => (
              <div key={m.id} className="text-secondary text-sm">
                {m.profile ? m.profile.name ?? m.profile.email : m.invitedEmail ?? '—'}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-dark-text text-sm font-semibold mb-2">Histórico de Chat</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {team.chatMessages.map(msg => (
              <ChatBubble
                key={msg.id}
                role={msg.role as 'user' | 'assistant'}
                content={msg.content}
                timestamp={new Date(msg.createdAt).toLocaleString('pt-BR')}
              />
            ))}
            {team.chatMessages.length === 0 && (
              <p className="text-secondary text-sm">Nenhuma mensagem ainda.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
