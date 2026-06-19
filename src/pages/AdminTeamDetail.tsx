import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { teamsApi, type Team, type Message } from '../lib/api'
import { StageProgressStepper } from '../components/StageProgressStepper'
import { ChatBubble } from '../components/ChatBubble'
import { showToast } from '../lib/toast'

type TeamDetail = Team & { chatMessages: Message[] }

export function AdminTeamDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [team, setTeam] = useState<TeamDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  async function loadTeam() {
    if (!id) return
    try {
      const data = await teamsApi.get(id)
      setTeam(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTeam()
  }, [id])

  async function handleAdvance() {
    if (!id) return
    try {
      await teamsApi.advance(id)
      await loadTeam()
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

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    if (!id || !newMemberEmail.trim()) return
    setAddingMember(true)
    try {
      await teamsApi.addMember(id, newMemberEmail.trim())
      showToast('Membro adicionado', 'success')
      setNewMemberEmail('')
      setShowAddForm(false)
      await loadTeam()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao adicionar membro', 'error')
    } finally {
      setAddingMember(false)
    }
  }

  async function handleRemoveMember(memberId: string, memberName: string) {
    if (!id || !confirm(`Remover "${memberName}" do time?`)) return
    try {
      await teamsApi.removeMember(id, memberId)
      showToast('Membro removido', 'success')
      await loadTeam()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao remover membro', 'error')
    }
  }

  function getMemberDisplayName(m: TeamDetail['members'][0]) {
    if (m.profile?.name) return m.profile.name
    if (m.profile?.email) return m.profile.email
    if (m.invitedEmail) return m.invitedEmail
    return '—'
  }

  function getMemberSubtitle(m: TeamDetail['members'][0]) {
    if (m.profile?.name && m.profile?.email) return m.profile.email
    if (m.profile?.name && m.invitedEmail) return m.invitedEmail
    return null
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

        {/* ─── MEMBROS ─── */}
        <div className="bg-dark-card rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-dark-text text-sm font-semibold">
              Membros ({team.members.length})
            </h3>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-1.5 bg-primary/15 text-primary rounded-lg text-xs font-medium hover:bg-primary/25 transition-colors"
            >
              {showAddForm ? 'Cancelar' : '+ Adicionar'}
            </button>
          </div>

          {showAddForm && (
            <form onSubmit={handleAddMember} className="flex gap-2 mb-4">
              <input
                type="email"
                value={newMemberEmail}
                onChange={e => setNewMemberEmail(e.target.value)}
                placeholder="email@exemplo.com"
                required
                className="flex-1 px-3 py-2 bg-dark-bg border border-secondary/30 rounded-lg text-dark-text text-sm placeholder:text-secondary/50 focus:outline-none focus:border-primary/50"
              />
              <button
                type="submit"
                disabled={addingMember}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:brightness-110 disabled:opacity-50 transition-all"
              >
                {addingMember ? 'Adicionando...' : 'Adicionar'}
              </button>
            </form>
          )}

          <div className="space-y-1">
            {team.members.map(m => {
              const displayName = getMemberDisplayName(m)
              const subtitle = getMemberSubtitle(m)
              const isJoined = !!m.profile

              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-dark-bg/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      isJoined
                        ? 'bg-primary/20 text-primary'
                        : 'bg-secondary/20 text-secondary'
                    }`}>
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-dark-text text-sm font-medium">
                        {displayName}
                      </div>
                      {subtitle && (
                        <div className="text-secondary text-xs">{subtitle}</div>
                      )}
                      {!isJoined && (
                        <div className="text-amber-400/70 text-xs">Convite pendente</div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveMember(m.id, displayName)}
                    className="opacity-0 group-hover:opacity-100 px-2 py-1 text-red-400 hover:bg-red-500/10 rounded text-xs transition-all"
                    title="Remover membro"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
            {team.members.length === 0 && (
              <p className="text-secondary text-sm py-2">Nenhum membro adicionado.</p>
            )}
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
