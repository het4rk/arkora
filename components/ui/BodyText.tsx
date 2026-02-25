import { Fragment } from 'react'

// Splits on @mentions (not on email@domain — \B prevents matching word-boundary @ signs)
const SPLIT_RE = /(\B@[a-zA-Z0-9_-]{1,50})/g
const MENTION_RE = /^@[a-zA-Z0-9_-]{1,50}$/

interface Props {
  text: string
}

export function BodyText({ text }: Props) {
  if (!text) return null
  const parts = text.split(SPLIT_RE)
  return (
    <>
      {parts.map((part, i) =>
        MENTION_RE.test(part)
          ? <span key={i} className="text-accent font-medium">{part}</span>
          : <Fragment key={i}>{part}</Fragment>
      )}
    </>
  )
}
