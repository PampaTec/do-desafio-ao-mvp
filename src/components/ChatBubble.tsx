interface Props {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export function ChatBubble({ role, content, timestamp }: Props) {
  const isUser = role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm
        ${isUser ? 'bg-primary text-white' : 'bg-dark-card border border-secondary'}`}
      >
        {isUser ? '👤' : '🟢'}
      </div>
      <div className={`max-w-[80%] px-4 py-2 rounded-lg ${
        isUser
          ? 'bg-primary/20 border-l-4 border-primary text-right'
          : 'bg-dark-card border-l-4 border-secondary text-dark-text'
      }`}>
        <p className="whitespace-pre-wrap">{content}</p>
        <span className="text-xs text-secondary mt-1 block">{timestamp}</span>
      </div>
    </div>
  )
}
