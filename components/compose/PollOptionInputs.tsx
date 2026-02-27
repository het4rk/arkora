'use client'

export interface PollOption {
  id: number
  text: string
}

interface Props {
  options: PollOption[]
  onChange: (options: PollOption[]) => void
  onAdd: () => void
}

export function PollOptionInputs({ options, onChange, onAdd }: Props) {
  function updateOption(id: number, value: string) {
    onChange(options.map((o) => o.id === id ? { ...o, text: value.slice(0, 100) } : o))
  }

  function removeOption(id: number) {
    if (options.length <= 2) return
    onChange(options.filter((o) => o.id !== id))
  }

  return (
    <div className="space-y-2">
      {options.map((opt, i) => (
        <div key={opt.id} className="flex items-center gap-2">
          <input
            type="text"
            value={opt.text}
            onChange={(e) => updateOption(opt.id, e.target.value)}
            placeholder={`Option ${i + 1}`}
            maxLength={100}
            className="glass-input flex-1 rounded-[var(--r-lg)] px-4 py-3 text-sm"
            autoComplete="off"
          />
          {options.length > 2 && (
            <button
              type="button"
              onClick={() => removeOption(opt.id)}
              aria-label={`Remove option ${i + 1}`}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted/50 hover:text-downvote active:scale-90 transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      ))}
      {options.length < 4 && (
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-2 text-accent text-sm font-medium py-2 active:opacity-60 transition-opacity"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add option
        </button>
      )}
    </div>
  )
}
