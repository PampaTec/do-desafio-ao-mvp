import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { teamsApi } from '../lib/api'
import { showToast } from '../lib/toast'

export function AdminNewTeam() {
  const navigate = useNavigate()
  const [projectName, setProjectName] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [emails, setEmails] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  function addEmail() {
    const e = emailInput.trim().toLowerCase()
    if (e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && !emails.includes(e)) {
      setEmails([...emails, e])
      setEmailInput('')
    }
  }

  function removeEmail(email: string) {
    setEmails(emails.filter(e => e !== email))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!projectName.trim()) return
    setSaving(true)
    try {
      const team = await teamsApi.create(projectName.trim(), emails)
      showToast('Time criado com sucesso', 'success')
      navigate(`/admin/team/${team.id}`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao criar time', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      <Header title="Criar Novo Time" />

      <main className="max-w-lg mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-dark-text text-sm mb-2">Nome do Projeto</label>
            <input
              type="text"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              className="w-full px-4 py-2 bg-dark-card border border-secondary/30 rounded-lg text-dark-text
                focus:border-primary outline-none"
              placeholder="Ex: App de delivery rural"
              required
            />
          </div>

          <div>
            <label className="block text-dark-text text-sm mb-2">Membros (e-mails)</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addEmail())}
                className="flex-1 px-4 py-2 bg-dark-card border border-secondary/30 rounded-lg text-dark-text
                  focus:border-primary outline-none"
                placeholder="email@exemplo.com"
              />
              <button
                type="button"
                onClick={addEmail}
                className="px-3 py-2 bg-primary text-white rounded-lg text-sm hover:brightness-110"
              >
                Adicionar
              </button>
            </div>
            {emails.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {emails.map(email => (
                  <span
                    key={email}
                    className="flex items-center gap-1 px-3 py-1 bg-primary/20 text-primary text-sm rounded-full"
                  >
                    {email}
                    <button type="button" onClick={() => removeEmail(email)} className="ml-1 hover:text-white">&times;</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving || !projectName.trim()}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm
                hover:brightness-110 transition-all disabled:opacity-50"
            >
              {saving ? 'Criando...' : 'Criar Time'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="px-4 py-2 border border-primary text-primary rounded-lg text-sm hover:bg-primary/10"
            >
              Cancelar
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
