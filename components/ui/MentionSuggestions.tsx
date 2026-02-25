'use client'

interface Suggestion {
  nullifierHash: string
  pseudoHandle: string | null
  identityMode: 'anonymous' | 'alias' | 'named'
  avatarUrl: string | null
}

interface MentionSuggestionsProps {
  suggestions: Suggestion[]
  activeIndex: number
  onSelect: (handle: string) => void
  onHover: (index: number) => void
}

export function MentionSuggestions({ suggestions, activeIndex, onSelect, onHover }: MentionSuggestionsProps) {
  if (suggestions.length === 0) return null

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1.5 z-40 glass rounded-[var(--r-lg)] overflow-hidden border border-white/[0.08] shadow-xl">
      {suggestions.map((s, i) => (
        <button
          key={s.nullifierHash}
          onMouseDown={(e) => { e.preventDefault(); onSelect(s.pseudoHandle ?? '') }}
          onMouseEnter={() => onHover(i)}
          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
            i === activeIndex ? 'bg-accent/15' : 'hover:bg-white/[0.04]'
          }`}
        >
          <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent shrink-0">
            {(s.pseudoHandle ?? '?').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-text text-sm font-medium truncate">@{s.pseudoHandle}</p>
            <p className="text-text-muted text-[10px]">{s.identityMode}</p>
          </div>
        </button>
      ))}
    </div>
  )
}
