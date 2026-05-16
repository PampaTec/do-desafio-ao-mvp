import { useAuth } from '../hooks/useAuth'

export function Waiting() {
  const { signOut } = useAuth()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-dark-bg px-6">
      <div className="flex flex-col items-center gap-4 max-w-sm text-center">
        <svg width="40" height="40" viewBox="0 0 40 40">
          <rect x="0" y="20" width="8" height="20" fill="#00A859" rx="2" />
          <rect x="10" y="10" width="8" height="30" fill="#00A859" rx="2" />
          <rect x="20" y="0" width="8" height="40" fill="#00A859" rx="2" />
          <rect x="30" y="15" width="8" height="25" fill="#00A859" rx="2" />
        </svg>
        <h1 className="text-dark-text text-xl font-bold">Aguardando seu time</h1>
        <p className="text-secondary text-sm leading-relaxed">
          Seu time ainda não foi criado pelo PampaTec. 
          Você receberá um e-mail quando estiver pronto.
        </p>
        <button
          onClick={signOut}
          className="mt-4 px-4 py-2 border border-primary text-primary rounded-lg text-sm hover:bg-primary/10"
        >
          Sair
        </button>
      </div>
    </div>
  )
}
