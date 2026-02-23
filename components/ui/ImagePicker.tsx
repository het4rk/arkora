'use client'

import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  onUpload: (url: string) => void
  onClear: () => void
  previewUrl: string | null
  className?: string
}

const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
const MAX_MB = 8

export function ImagePicker({ onUpload, onClear, previewUrl, className }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)

    if (!ALLOWED.includes(file.type)) {
      setError('Only JPEG, PNG, GIF, WebP allowed')
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Max ${MAX_MB} MB`)
      return
    }

    setIsUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const json = (await res.json()) as { success: boolean; url?: string; error?: string }
      if (!json.success || !json.url) throw new Error(json.error ?? 'Upload failed')
      onUpload(json.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
          e.target.value = ''
        }}
      />

      {/* Preview */}
      {previewUrl && (
        <div className="relative rounded-[var(--r-md)] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Upload preview"
            className="w-full max-h-64 object-cover"
          />
          <button
            onClick={onClear}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center text-xs font-bold active:scale-90 transition-all"
            aria-label="Remove image"
          >
            ✕
          </button>
        </div>
      )}

      {/* Attach button */}
      {!previewUrl && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isUploading}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2.5 glass rounded-[var(--r-md)] text-sm text-text-secondary transition-all active:scale-95',
            isUploading && 'opacity-50'
          )}
        >
          {isUploading ? (
            <>
              <div className="w-4 h-4 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
              <span>Uploading…</span>
            </>
          ) : (
            <>
              {/* Image icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span>Add image / GIF</span>
            </>
          )}
        </button>
      )}

      {error && (
        <p className="text-downvote text-xs px-1">{error}</p>
      )}
    </div>
  )
}
