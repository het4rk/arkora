'use client'

import { useState, useCallback, useRef } from 'react'

interface MentionSuggestion {
  nullifierHash: string
  pseudoHandle: string | null
  identityMode: 'anonymous' | 'alias' | 'named'
  avatarUrl: string | null
}

interface UseMentionAutocompleteReturn {
  suggestions: MentionSuggestion[]
  isOpen: boolean
  activeIndex: number
  mentionQuery: string
  mentionStart: number
  onTextChange: (text: string, cursorPos: number) => void
  selectSuggestion: (handle: string) => string // returns updated text
  setActiveIndex: (i: number) => void
  close: () => void
}

const MENTION_TRIGGER = /\B@([a-zA-Z0-9_-]{0,50})$/

export function useMentionAutocomplete(
  text: string
): UseMentionAutocompleteReturn {
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStart, setMentionStart] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const close = useCallback(() => {
    setIsOpen(false)
    setSuggestions([])
    setActiveIndex(0)
    setMentionQuery('')
    setMentionStart(-1)
  }, [])

  const onTextChange = useCallback((newText: string, cursorPos: number) => {
    const textUpToCursor = newText.slice(0, cursorPos)
    const match = textUpToCursor.match(MENTION_TRIGGER)

    if (!match) {
      if (isOpen) close()
      return
    }

    const query = match[1] ?? ''
    const start = cursorPos - match[0].length
    setMentionQuery(query)
    setMentionStart(start)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (!query.trim()) {
        setIsOpen(false)
        setSuggestions([])
        return
      }
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}&limit=5`)
        const json = (await res.json()) as { success: boolean; data?: MentionSuggestion[] }
        if (json.success && json.data && json.data.length > 0) {
          setSuggestions(json.data)
          setIsOpen(true)
          setActiveIndex(0)
        } else {
          setSuggestions([])
          setIsOpen(false)
        }
      } catch {
        setIsOpen(false)
      }
    }, 150)
  }, [isOpen, close])

  const selectSuggestion = useCallback((handle: string): string => {
    if (mentionStart === -1) return text
    // Replace from mentionStart (@query) with @handle + space
    const before = text.slice(0, mentionStart)
    const after = text.slice(mentionStart + mentionQuery.length + 1) // +1 for the @
    const updated = `${before}@${handle} ${after}`
    close()
    return updated
  }, [text, mentionStart, mentionQuery, close])

  return {
    suggestions,
    isOpen,
    activeIndex,
    mentionQuery,
    mentionStart,
    onTextChange,
    selectSuggestion,
    setActiveIndex,
    close,
  }
}
