import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { OVAL, drawAlignedImage, type OvalAlignParams } from '../game/faceAlign'
import './FaceAlignPanel.css'

type FaceAlignPanelProps = {
  originalUrl: string
  align: OvalAlignParams
  faceDetected: boolean
  onAlignChange: (align: OvalAlignParams) => void
  onRedetect: () => void
  busy: boolean
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Không đọc được ảnh'))
    img.src = url
  })
}

export function FaceAlignPanel({
  originalUrl,
  align,
  faceDetected,
  onAlignChange,
  onRedetect,
  busy,
}: FaceAlignPanelProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const viewportSizeRef = useRef(0)
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(
    null,
  )

  const alignRef = useRef(align)
  alignRef.current = align

  const paintViewport = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    const size = viewportSizeRef.current
    if (!canvas || !img || size <= 0) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size, size)
    drawAlignedImage(ctx, img, size, alignRef.current)
  }, [])

  useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return

    const syncSize = () => {
      const next = el.clientWidth
      if (next === viewportSizeRef.current) return
      viewportSizeRef.current = next
      paintViewport()
    }

    syncSize()
    const ro = new ResizeObserver(syncSize)
    ro.observe(el)
    return () => ro.disconnect()
  }, [paintViewport])

  useEffect(() => {
    let cancelled = false
    imgRef.current = null
    void loadImage(originalUrl)
      .then((img) => {
        if (cancelled) return
        imgRef.current = img
        paintViewport()
      })
      .catch(() => {
        if (!cancelled) imgRef.current = null
      })
    return () => {
      cancelled = true
    }
  }, [originalUrl, paintViewport])

  useEffect(() => {
    paintViewport()
  }, [align, paintViewport])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (busy) return
      e.currentTarget.setPointerCapture(e.pointerId)
      dragRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: align.panX,
        panY: align.panY,
      }
    },
    [align.panX, align.panY, busy],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const dx = (e.clientX - drag.x) / 180
      const dy = (e.clientY - drag.y) / 180
      onAlignChange({
        ...align,
        panX: Math.max(-1, Math.min(1, drag.panX + dx)),
        panY: Math.max(-1, Math.min(1, drag.panY + dy)),
      })
    },
    [align, onAlignChange],
  )

  const onPointerUp = useCallback(() => {
    dragRef.current = null
  }, [])

  return (
    <div className="align-panel">
      <div
        ref={viewportRef}
        className="align-viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <canvas ref={canvasRef} className="align-canvas" aria-hidden />

        <div
          className="align-dim"
          style={{
            maskImage: `radial-gradient(ellipse ${OVAL.rx * 200}% ${OVAL.ry * 200}% at ${OVAL.cx * 100}% ${OVAL.cy * 100}%, transparent 68%, black 72%)`,
            WebkitMaskImage: `radial-gradient(ellipse ${OVAL.rx * 200}% ${OVAL.ry * 200}% at ${OVAL.cx * 100}% ${OVAL.cy * 100}%, transparent 68%, black 72%)`,
          }}
        />

        <svg className="align-oval-svg" viewBox="0 0 100 100" aria-hidden>
          <ellipse
            cx={OVAL.cx * 100}
            cy={OVAL.cy * 100}
            rx={OVAL.rx * 100}
            ry={OVAL.ry * 100}
            className="align-oval-stroke"
          />
        </svg>
      </div>

      <p className="align-status">
        {faceDetected
          ? 'Kéo ảnh hoặc dùng slider — cho mặt vừa khung oval vàng.'
          : 'Đặt mặt vào oval vàng — kéo ảnh hoặc chỉnh slider.'}
      </p>

      <label className="align-control">
        <span>Phóng to</span>
        <input
          type="range"
          min={0.55}
          max={2.8}
          step={0.01}
          value={align.zoom}
          disabled={busy}
          onChange={(e) => onAlignChange({ ...align, zoom: Number(e.target.value) })}
        />
      </label>

      <label className="align-control">
        <span>Dịch ngang</span>
        <input
          type="range"
          min={-1}
          max={1}
          step={0.005}
          value={align.panX}
          disabled={busy}
          onChange={(e) => onAlignChange({ ...align, panX: Number(e.target.value) })}
        />
      </label>

      <label className="align-control">
        <span>Dịch dọc</span>
        <input
          type="range"
          min={-1}
          max={1}
          step={0.005}
          value={align.panY}
          disabled={busy}
          onChange={(e) => onAlignChange({ ...align, panY: Number(e.target.value) })}
        />
      </label>

      <button
        type="button"
        className="btn btn-secondary align-redetect"
        disabled={busy}
        onClick={onRedetect}
      >
        {busy ? 'Đang căn…' : 'Tự căn vào oval'}
      </button>
    </div>
  )
}
