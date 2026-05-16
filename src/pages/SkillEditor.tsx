import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { skillApi } from '../lib/api'
import { showToast } from '../lib/toast'

interface SkillVersion {
  id: string
  versionLabel: string
  contentMd: string
  isActive: boolean
  createdAt: string
}

const TABS = [
  'Perfil do Agente',
  'Etapa 1 — CYNEFIN',
  'Etapa 2 — Empatia',
  'Etapa 3 — 5 Porquês',
  'Etapa 4 — Crazy Eights',
  'Etapa 5 — 5W2H',
  'Etapa 6 — Canvas',
  'Etapa 7 — Protótipo',
  'Análise Crítica Final',
  'Prompt Final',
]

export function SkillEditor() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(0)
  const [versions, setVersions] = useState<SkillVersion[]>([])
  const [contentMd, setContentMd] = useState('')
  const [versionLabel, setVersionLabel] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    skillApi.active().then((skill: SkillVersion | null) => {
      if (skill) {
        setContentMd(skill.contentMd)
        setVersionLabel(skill.versionLabel)
      }
    }).catch(console.error)

    skillApi.list().then(setVersions).catch(console.error)
  }, [])

  async function handleSave() {
    if (!versionLabel.trim() || !contentMd.trim()) return
    setSaving(true)
    try {
      await skillApi.save(versionLabel.trim(), contentMd)
      showToast('Skill atualizada com sucesso', 'success')
      const updated = await skillApi.list()
      setVersions(updated)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleRestore(id: string) {
    try {
      const skill = await skillApi.restore(id)
      setContentMd(skill.contentMd)
      setVersionLabel(skill.versionLabel)
      showToast('Versão restaurada', 'success')
      const updated = await skillApi.list()
      setVersions(updated)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao restaurar', 'error')
    }
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      <Header title="Editor de Skill" />

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex gap-1 overflow-x-auto mb-4 pb-2">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap transition-all
                ${activeTab === i ? 'bg-primary text-white' : 'bg-dark-card text-secondary hover:text-dark-text'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="bg-dark-card rounded-lg p-4 border border-secondary/10 mb-4">
          <label className="block text-dark-text text-sm mb-2">Versão</label>
          <input
            type="text"
            value={versionLabel}
            onChange={e => setVersionLabel(e.target.value)}
            className="w-full px-3 py-1.5 bg-dark-bg border border-secondary/30 rounded text-dark-text text-sm
              focus:border-primary outline-none"
            placeholder="Ex: v1.2.0 — novos prompts"
          />
        </div>

        <div className="bg-dark-card rounded-lg p-4 border border-secondary/10 mb-4">
          <div className="flex justify-between items-center mb-2">
            <label className="text-dark-text text-sm">Conteúdo da Skill (Markdown)</label>
            <span className="text-secondary text-xs">Versões anteriores: {versions.length}/5</span>
          </div>
          <textarea
            value={contentMd}
            onChange={e => setContentMd(e.target.value)}
            className="w-full h-96 px-3 py-2 bg-dark-bg border border-secondary/30 rounded text-dark-text text-xs
              font-mono focus:border-primary outline-none resize-y"
          />
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={handleSave}
            disabled={saving || !versionLabel.trim() || !contentMd.trim()}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:brightness-110 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar Skill'}
          </button>
          <button
            onClick={() => navigate('/admin')}
            className="px-4 py-2 border border-primary text-primary rounded-lg text-sm hover:bg-primary/10"
          >
            Voltar
          </button>
        </div>

        {versions.length > 0 && (
          <div>
            <h3 className="text-dark-text text-sm font-semibold mb-2">Versões Anteriores</h3>
            <div className="space-y-2">
              {versions.map(v => (
                <div key={v.id} className="flex items-center justify-between bg-dark-card rounded-lg p-3 border border-secondary/10">
                  <div>
                    <span className="text-dark-text text-sm">{v.versionLabel}</span>
                    <span className="text-secondary text-xs ml-2">
                      {new Date(v.createdAt).toLocaleString('pt-BR')}
                    </span>
                    {v.isActive && (
                      <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Ativa</span>
                    )}
                  </div>
                  {!v.isActive && (
                    <button
                      onClick={() => handleRestore(v.id)}
                      className="text-primary text-xs hover:underline"
                    >
                      Restaurar
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
