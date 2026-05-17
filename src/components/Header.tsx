import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'

interface Props {
  title: string
}

export function Header({ title }: Props) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="bg-dark-card border-b border-secondary/10 px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <button onClick={() => navigate('/')} className="flex items-center gap-2">
          <img src="/logo-pampatec.png" alt="PampaTec" className="h-6" />
          <span className="text-dark-text font-bold text-sm">Desafio ao MVP</span>
          {title && <span className="text-secondary text-xs ml-2 hidden sm:inline">· {title}</span>}
        </button>

        <div className="flex items-center gap-3">
          <span className="text-secondary text-xs">{profile?.name ?? profile?.email}</span>
          <button
            onClick={signOut}
            className="text-xs text-secondary hover:text-dark-text transition-colors"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  )
}
