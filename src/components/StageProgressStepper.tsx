const STAGES = [
  { num: 1, label: 'CYNEFIN', icon: '🔍' },
  { num: 2, label: 'Empatia', icon: '🧠' },
  { num: 3, label: '5 Porquês', icon: '🌱' },
  { num: 4, label: 'Crazy Eights', icon: '💡' },
  { num: 5, label: '5W2H', icon: '📋' },
  { num: 6, label: 'Canvas', icon: '🌐' },
  { num: 7, label: 'Protótipo', icon: '🚀' },
]

interface Props {
  currentStage: number
  progress: { stage: number; status: string }[]
}

export function StageProgressStepper({ currentStage, progress }: Props) {
  const progressMap = new Map(progress.map(p => [p.stage, p.status]))

  return (
    <div className="flex justify-center gap-1 overflow-x-auto py-2 px-1">
      {STAGES.map((s, i) => {
        const status = progressMap.get(s.num) ?? 'pending'

        return (
          <div key={s.num} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                ${status === 'completed' ? 'bg-primary text-white' : ''}
                ${status === 'in_progress' || s.num === currentStage ? 'bg-primary text-white animate-pulse' : ''}
                ${status === 'pending' && s.num !== currentStage ? 'bg-dark-card border border-secondary text-dark-text' : ''}
              `}>
                {status === 'completed' ? '✓' : s.num}
              </div>
              <span className="text-[10px] text-secondary mt-1 whitespace-nowrap">{s.icon} {s.label}</span>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`w-6 h-0.5 mx-1 mt-[-1rem] ${
                status === 'completed' ? 'bg-primary' : 'bg-secondary/30'
              }`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
