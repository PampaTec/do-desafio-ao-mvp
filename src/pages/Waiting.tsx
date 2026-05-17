import { useAuth } from '../hooks/useAuth'

export function Waiting() {
  const { signOut } = useAuth()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-dark-bg px-6">
      <div className="flex flex-col items-center gap-4 max-w-sm text-center">
        <img src="/logo-pampatec.png" alt="PampaTec" className="h-10" />
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
