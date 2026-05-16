import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { teamsApi, chatApi } from '../lib/api'
import { Header } from '../components/Header'
import { ChatBubble } from '../components/ChatBubble'
import { StageProgressStepper } from '../components/StageProgressStepper'
import { showToast } from '../lib/toast'

interface TeamData {
  id: string
  projectName: string
  currentStage: number
  status: string
  progress: { stage: number; status: string; stageOutput: string | null }[]
  members: { id: string; profile: { name: string | null; email: string } | null }[]
}

interface Message {
  id: string
  role: string
  content: string
  createdAt: string
}

export function MemberChat() {
  const navigate = useNavigate()
  const [team, setTeam] = useState<TeamData | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const endRef = useRef<HTMLDivElement>(null)
  const [typing, setTyping] = useState(false)

  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    teamsApi.my()
      .then((data: TeamData | null) => {
        if (!data) {
          navigate('/waiting', { replace: true })
          return null
        }
        setTeam(data)
        return chatApi.list(data.id)
      })
      .then((msgs: Message[] | undefined) => {
        if (msgs) setMessages(msgs)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [navigate])

  useEffect(() => {
    scrollToBottom()
  }, [messages, typing, scrollToBottom])

  useEffect(() => {
    if (!team || loading) return
    const interval = setInterval(async () => {
      try {
        const updated = await teamsApi.my()
        if (updated) setTeam(updated)
      }       catch { /* polling error - ignore */ }
    }, 10000)
    return () => clearInterval(interval)
  }, [team, loading])

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !team || sending) return
    const content = input.trim()
    setInput('')
    setSending(true)
    setTyping(true)

    const tempId = `temp-${Date.now()}`
    setMessages(prev => [...prev, {
      id: tempId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }])

    try {
      const result = await chatApi.send(team.id, content)

      if (result.aiMessage) {
        setMessages(prev => [...prev, {
          id: result.aiMessage.id,
          role: 'assistant',
          content: result.aiMessage.content,
          createdAt: result.aiMessage.createdAt,
        }])
      } else {
        setMessages(prev => [...prev, {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: result.content,
          createdAt: new Date().toISOString(),
        }])
      }

      if (result.stageCompleted) {
        const updated = await teamsApi.my()
        if (updated) setTeam(updated)
        showToast(`Etapa ${result.stageCompleted} concluída!`, 'success')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao enviar mensagem', 'error')
    } finally {
      setSending(false)
      setTyping(false)
    }
  }, [input, team, sending])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-dark-bg">
        <div className="text-dark-text">Carregando...</div>
      </div>
    )
  }

  if (!team) return null

  return (
    <div className="flex flex-col h-dvh bg-dark-bg">
      <Header title={`${team.projectName} · Etapa ${team.currentStage}/7`} />

      {team.status === 'completed' && (
        <div className="bg-primary/20 border-b border-primary/30 px-4 py-3 text-center">
          <p className="text-primary text-sm font-semibold">🎉 Jornada finalizada! Parabéns!</p>
        </div>
      )}

      <div className="bg-dark-card border-b border-secondary/10 px-4">
        <StageProgressStepper currentStage={team.currentStage} progress={team.progress} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map(msg => (
          <ChatBubble
            key={msg.id}
            role={msg.role as 'user' | 'assistant'}
            content={msg.content}
            timestamp={new Date(msg.createdAt).toLocaleString('pt-BR')}
          />
        ))}
        {typing && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-dark-card border border-secondary flex items-center justify-center text-sm">
              🟢
            </div>
            <div className="bg-dark-card border-l-4 border-secondary rounded-lg px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        {messages.length === 0 && !typing && (
          <div className="flex flex-col items-center justify-center h-full text-secondary text-sm">
            <p>Comece a conversa com seu consultor de Design Thinking.</p>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-secondary/10 px-4 py-3 bg-dark-card">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder="Digite sua mensagem..."
            rows={1}
            className="flex-1 px-4 py-2 bg-dark-bg border border-secondary/30 rounded-lg text-dark-text
              resize-none focus:border-primary outline-none text-sm"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm
              hover:brightness-110 transition-all disabled:opacity-50 self-end"
          >
            {sending ? '...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}
