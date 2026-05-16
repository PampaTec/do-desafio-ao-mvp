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
          <svg width="24" height="24" viewBox="0 0 40 40">
            <rect x="0" y="20" width="8" height="20" fill="#00A859" rx="2" />
            <rect x="10" y="10" width="8" height="30" fill="#00A859" rx="2" />
            <rect x="20" y="0" width="8" height="40" fill="#00A859" rx="2" />
            <rect x="30" y="15" width="8" height="25" fill="#00A859" rx="2" />
          </svg>
          <span className="text-dark-text font-bold text-sm">PampaTec</span>
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
