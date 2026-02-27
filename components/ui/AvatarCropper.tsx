'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  file: File
  onConfirm: (blob: Blob) => void
  onCancel: () => void
}

const MIN_SCALE = 1
const MAX_SCALE = 4

/**
 * Instagram/X-style circular avatar cropper.
 * Shows a circular mask preview. User can pinch-zoom and drag to position.
 * On confirm, draws the visible circle to a 400x400 canvas and exports as JPEG.
 */
export function AvatarCropper({ file, onConfirm, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Draw params
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [imgNaturalSize, setImgNaturalSize] = useState({ w: 0, h: 0 })
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  const [ready, setReady] = useState(false)

  // Drag state
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  // Pinch state
  const lastPinchDist = useRef<number | null>(null)
  const lastPinchScale = useRef<number>(1)

  const CIRCLE_FRACTION = 0.82 // crop circle = 82% of the container width

  // Load image
  useEffect(() => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      setImgNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
      setReady(true)
      URL.revokeObjectURL(url)
    }
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Measure container
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setContainerSize({ w: entry.contentRect.width, h: entry.contentRect.height })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Reset pan/scale when image loads or container sizes
  useEffect(() => {
    if (!ready || containerSize.w === 0 || imgNaturalSize.w === 0) return
    // Fit image to fill the circle by default (cover)
    const circleR = (containerSize.w * CIRCLE_FRACTION) / 2
    const circleDiam = circleR * 2
    const fitScale = Math.max(circleDiam / imgNaturalSize.w, circleDiam / imgNaturalSize.h)
    setScale(fitScale)
    setOffset({ x: 0, y: 0 })
  }, [ready, containerSize.w, containerSize.h, imgNaturalSize.w, imgNaturalSize.h])

  // Clamp offset so image always fills the circle
  const clampOffset = useCallback((ox: number, oy: number, sc: number): { x: number; y: number } => {
    const circleDiam = containerSize.w * CIRCLE_FRACTION
    const circleR = circleDiam / 2
    const imgW = imgNaturalSize.w * sc
    const imgH = imgNaturalSize.h * sc
    // The image is centered at (containerW/2 + ox, containerH/2 + oy)
    // We need: left edge of img <= center - circleR  →  ox >= circleR - imgW/2
    //          right edge of img >= center + circleR →  ox <= imgW/2 - circleR
    const maxX = Math.max(0, imgW / 2 - circleR)
    const maxY = Math.max(0, imgH / 2 - circleR)
    return {
      x: Math.max(-maxX, Math.min(maxX, ox)),
      y: Math.max(-maxY, Math.min(maxY, oy)),
    }
  }, [containerSize.w, imgNaturalSize.w, imgNaturalSize.h])

  // Render preview to canvas
  useEffect(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || !ready || containerSize.w === 0) return

    const dpr = window.devicePixelRatio || 1
    const cw = containerSize.w
    const ch = containerSize.h
    canvas.width = cw * dpr
    canvas.height = ch * dpr
    canvas.style.width = `${cw}px`
    canvas.style.height = `${ch}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Dark background
    ctx.fillStyle = '#111'
    ctx.fillRect(0, 0, cw, ch)

    // Dimmed image behind the overlay
    const imgW = imgNaturalSize.w * scale
    const imgH = imgNaturalSize.h * scale
    const cx = cw / 2 + offset.x
    const cy = ch / 2 + offset.y
    ctx.globalAlpha = 0.4
    ctx.drawImage(img, cx - imgW / 2, cy - imgH / 2, imgW, imgH)

    // Circular clip - bright image inside
    const circleR = (cw * CIRCLE_FRACTION) / 2
    ctx.globalAlpha = 1
    ctx.save()
    ctx.beginPath()
    ctx.arc(cw / 2, ch / 2, circleR, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(img, cx - imgW / 2, cy - imgH / 2, imgW, imgH)
    ctx.restore()

    // Circle border
    ctx.beginPath()
    ctx.arc(cw / 2, ch / 2, circleR, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.lineWidth = 2
    ctx.stroke()
  }, [ready, scale, offset, containerSize, imgNaturalSize])

  // Pointer events for drag
  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === 'touch') return // handled by touch events
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragStart.current) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    setOffset(clampOffset(dragStart.current.ox + dx, dragStart.current.oy + dy, scale))
  }
  function onPointerUp() { dragStart.current = null }

  // Touch events for drag + pinch
  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const dx = e.touches[1]!.clientX - e.touches[0]!.clientX
      const dy = e.touches[1]!.clientY - e.touches[0]!.clientY
      lastPinchDist.current = Math.hypot(dx, dy)
      lastPinchScale.current = scale
    } else if (e.touches.length === 1) {
      dragStart.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY, ox: offset.x, oy: offset.y }
    }
  }
  function onTouchMove(e: React.TouchEvent) {
    e.preventDefault()
    if (e.touches.length === 2 && lastPinchDist.current !== null) {
      const dx = e.touches[1]!.clientX - e.touches[0]!.clientX
      const dy = e.touches[1]!.clientY - e.touches[0]!.clientY
      const dist = Math.hypot(dx, dy)
      const ratio = dist / lastPinchDist.current
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, lastPinchScale.current * ratio))
      setScale(newScale)
      setOffset((prev) => clampOffset(prev.x, prev.y, newScale))
    } else if (e.touches.length === 1 && dragStart.current) {
      const dx = e.touches[0]!.clientX - dragStart.current.x
      const dy = e.touches[0]!.clientY - dragStart.current.y
      setOffset(clampOffset(dragStart.current.ox + dx, dragStart.current.oy + dy, scale))
    }
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (e.touches.length < 2) lastPinchDist.current = null
    if (e.touches.length === 0) dragStart.current = null
  }

  // Zoom slider
  function onZoomChange(e: React.ChangeEvent<HTMLInputElement>) {
    const circleDiam = containerSize.w * CIRCLE_FRACTION
    const fitScale = Math.max(circleDiam / imgNaturalSize.w, circleDiam / imgNaturalSize.h)
    const newScale = fitScale * (1 + parseFloat(e.target.value) * (MAX_SCALE - 1))
    setScale(newScale)
    setOffset((prev) => clampOffset(prev.x, prev.y, newScale))
  }

  function currentZoomValue(): number {
    const circleDiam = containerSize.w * CIRCLE_FRACTION
    const fitScale = Math.max(circleDiam / imgNaturalSize.w, circleDiam / imgNaturalSize.h)
    return Math.max(0, Math.min(1, (scale - fitScale) / (fitScale * (MAX_SCALE - 1))))
  }

  // Export cropped circle as 400x400 JPEG
  function handleConfirm() {
    const img = imgRef.current
    if (!img || containerSize.w === 0) return

    const OUTPUT = 400
    const out = document.createElement('canvas')
    out.width = OUTPUT
    out.height = OUTPUT
    const ctx = out.getContext('2d')
    if (!ctx) return

    const circleR = (containerSize.w * CIRCLE_FRACTION) / 2
    const cx = containerSize.w / 2 + offset.x
    const cy = containerSize.h / 2 + offset.y
    const imgW = imgNaturalSize.w * scale
    const imgH = imgNaturalSize.h * scale
    // Crop region: square around the circle
    const srcLeft = cx - circleR
    const srcTop = cy - circleR
    const srcDiam = circleR * 2

    // Draw clipped circle
    ctx.beginPath()
    ctx.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(
      img,
      srcLeft - (cx - imgW / 2), srcTop - (cy - imgH / 2),
      imgW, imgH,
      // Wait: we need to map (srcLeft, srcTop) from image coordinate space
      // Actually simpler: scale the full image relative to where it sits in the output
      0, 0, 0, 0 // placeholder - redone below
    )

    // Redo: scale factor from preview coords to output coords
    const previewToOutput = OUTPUT / srcDiam
    // Image top-left in preview coords: (cx - imgW/2, cy - imgH/2)
    // Translate to crop-relative coords: subtract (srcLeft, srcTop)
    const imgX = (cx - imgW / 2 - srcLeft) * previewToOutput
    const imgY = (cy - imgH / 2 - srcTop) * previewToOutput
    const outImgW = imgW * previewToOutput
    const outImgH = imgH * previewToOutput

    // Clear and redraw correctly
    const out2 = document.createElement('canvas')
    out2.width = OUTPUT
    out2.height = OUTPUT
    const ctx2 = out2.getContext('2d')
    if (!ctx2) return
    ctx2.beginPath()
    ctx2.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2, 0, Math.PI * 2)
    ctx2.clip()
    ctx2.drawImage(img, imgX, imgY, outImgW, outImgH)

    out2.toBlob(
      (blob) => { if (blob) onConfirm(blob) },
      'image/jpeg',
      0.92
    )
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex flex-col bg-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),16px)] pb-3">
          <button
            type="button"
            onClick={onCancel}
            className="text-white/70 text-sm font-medium active:opacity-60"
          >
            Cancel
          </button>
          <p className="text-white text-sm font-semibold">Adjust Photo</p>
          <button
            type="button"
            onClick={handleConfirm}
            className="text-[var(--accent,#9f6ef5)] text-sm font-semibold active:opacity-60"
          >
            Use Photo
          </button>
        </div>

        {/* Canvas preview */}
        <div
          ref={containerRef}
          className="flex-1 min-h-0 relative overflow-hidden touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Zoom slider */}
        <div className="px-10 py-5 pb-[max(env(safe-area-inset-bottom),20px)]">
          <div className="flex items-center gap-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50 shrink-0">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
            </svg>
            <input
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={currentZoomValue()}
              onChange={onZoomChange}
              className="flex-1 accent-[var(--accent,#9f6ef5)]"
              aria-label="Zoom"
            />
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50 shrink-0">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
