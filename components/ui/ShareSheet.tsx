'use client'

import { useState } from 'react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { haptic } from '@/lib/utils'

interface Props {
  isOpen: boolean
  onClose: () => void
  url: string
  title: string
  text?: string | undefined
}

export function ShareSheet({ isOpen, onClose, url, title, text }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    haptic('light')
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard not available
    }
  }

  async function handleNativeShare() {
    haptic('light')
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url, ...(text ? { text } : {}) })
      } catch {
        // User dismissed or not supported
      }
    }
    onClose()
  }

  function openExternal(href: string) {
    haptic('light')
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  const encodedUrl = encodeURIComponent(url)
  const encodedText = encodeURIComponent(text || title)

  const socials = [
    {
      label: 'X',
      href: `https://x.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    {
      label: 'WhatsApp',
      href: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      ),
    },
    {
      label: 'Telegram',
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      ),
    },
  ]

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Share">
      {/* Preview */}
      <div className="glass rounded-[var(--r-lg)] px-4 py-3 mb-5">
        <p className="text-text font-semibold text-sm line-clamp-2">{title}</p>
        {text && (
          <p className="text-text-muted text-xs mt-1 line-clamp-2">{text}</p>
        )}
        <p className="text-text-muted/50 text-[11px] mt-1.5 truncate">{url}</p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => void handleCopy()}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-[var(--r-lg)] text-sm font-semibold transition-all active:scale-[0.97] ${
            copied
              ? 'bg-accent/15 text-accent'
              : 'glass text-text-secondary'
          }`}
        >
          {copied ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
          {copied ? 'Copied' : 'Copy link'}
        </button>

        {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
          <button
            onClick={() => void handleNativeShare()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-[var(--r-lg)] bg-accent text-background text-sm font-semibold transition-all active:scale-[0.97]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            Share
          </button>
        )}
      </div>

      {/* Social quick-share */}
      <div className="flex items-center gap-3 justify-center">
        {socials.map((s) => (
          <button
            key={s.label}
            onClick={() => openExternal(s.href)}
            aria-label={`Share on ${s.label}`}
            className="flex flex-col items-center gap-1.5 px-4 py-3 glass rounded-[var(--r-lg)] text-text-secondary active:scale-95 transition-all"
          >
            {s.icon}
            <span className="text-[10px] font-medium text-text-muted">{s.label}</span>
          </button>
        ))}
      </div>
    </BottomSheet>
  )
}
