'use client'

interface Props {
  options: string[]
  onChange: (options: string[]) => void
}

export function PollOptionInputs({ options, onChange }: Props) {
  function updateOption(index: number, value: string) {
    const next = [...options]
    next[index] = value.slice(0, 100)
    onChange(next)
  }

  function addOption() {
    if (options.length >= 4) return
    onChange([...options, ''])
  }

  function removeOption(index: number) {
    if (options.length <= 2) return
    onChange(options.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={opt}
            onChange={(e) => updateOption(i, e.target.value)}
            placeholder={`Option ${i + 1}`}
            maxLength={100}
            className="glass-input flex-1 rounded-[var(--r-lg)] px-4 py-3 text-sm"
            autoComplete="off"
          />
          {options.length > 2 && (
            <button
              type="button"
              onClick={() => removeOption(i)}
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
          onClick={addOption}
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
