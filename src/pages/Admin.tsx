import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Header } from '../components/Header'
import { teamsApi, statsApi, type Team } from '../lib/api'

interface Stats {
  activeTeams: number
  completedTeams: number
  totalMembers: number
  totalTeams: number
}

export function Admin() {
  const [teams, setTeams] = useState<Team[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([teamsApi.list(), statsApi.get()])
      .then(([t, s]) => {
        setTeams(t)
        setStats(s)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-dark-bg">
        <div className="text-dark-text">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      <Header title="Painel Administrativo" />

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Times Ativos" value={stats?.activeTeams ?? 0} />
          <StatCard label="Etapas Concluídas" value={stats?.completedTeams ?? 0} />
          <StatCard label="Membros" value={stats?.totalMembers ?? 0} />
          <StatCard label="Total de Times" value={stats?.totalTeams ?? 0} />
        </div>

        <div className="flex justify-between items-center">
          <h2 className="text-dark-text text-lg font-semibold">Times</h2>
          <Link
            to="/admin/new-team"
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:brightness-110 transition-all"
          >
            + Novo Time
          </Link>
        </div>

        <div className="space-y-3">
          {teams.map(team => (
            <Link
              key={team.id}
              to={`/admin/team/${team.id}`}
              className="block bg-dark-card rounded-lg p-4 border border-dark-card hover:border-primary/30 transition-all"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-dark-text font-medium">{team.projectName}</h3>
                  <p className="text-secondary text-xs mt-1">
                    {team.members.length} membro(s) · {team._count?.chatMessages ?? 0} mensagens
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-1 rounded ${
                    team.status === 'active' ? 'bg-primary/20 text-primary' :
                    team.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-secondary/20 text-secondary'
                  }`}>
                    {team.status === 'active' ? 'Ativo' : team.status === 'completed' ? 'Concluído' : 'Pausado'}
                  </span>
                  <p className="text-secondary text-xs mt-2">
                    Etapa {team.currentStage}/7
                  </p>
                </div>
              </div>
              <div className="mt-3 w-full bg-dark-bg rounded-full h-1.5">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all"
                  style={{ width: `${(team.currentStage / 7) * 100}%` }}
                />
              </div>
              <p className="text-[10px] text-secondary/50 mt-1">
                Criado em {new Date(team.createdAt).toLocaleDateString('pt-BR')}
              </p>
            </Link>
          ))}

          {teams.length === 0 && (
            <p className="text-secondary text-center py-8">Nenhum time cadastrado ainda.</p>
          )}
        </div>

        <div className="pt-4">
          <Link
            to="/skill-editor"
            className="text-primary text-sm hover:underline"
          >
            Editor de Skill →
          </Link>
        </div>
      </main>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-dark-card rounded-lg p-4 border border-dark-card">
      <p className="text-secondary text-xs">{label}</p>
      <p className="text-dark-text text-2xl font-bold mt-1">{value}</p>
    </div>
  )
}
