import { useCallback, useEffect, useRef, useState } from 'react'
import { FaceAlignPanel } from '../components/FaceAlignPanel'
import { FaceFighterPreview } from '../components/FaceFighterPreview'
import type { OvalAlignParams } from '../game/faceAlign'
import { detectFaceAlign } from '../game/faceDetect'
import {
  processFaceFile,
  reprocessFaceAlign,
  revokeFaceImage,
  type ProcessedFaceImage,
} from '../game/faceImage'
import './FaceUploadScreen.css'

type FaceUploadScreenProps = {
  onEnterFight: (face: ProcessedFaceImage) => void
  onBack?: () => void
  backLabel?: string
  submitLabel?: string
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read image'))
    img.src = url
  })
}

export function FaceUploadScreen({
  onEnterFight,
  onBack,
  backLabel = '← Back',
  submitLabel = 'Looks good — fight!',
}: FaceUploadScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const faceRef = useRef<ProcessedFaceImage | null>(null)
  const [face, setFace] = useState<ProcessedFaceImage | null>(null)
  const [align, setAlign] = useState<OvalAlignParams | null>(null)
  const [loading, setLoading] = useState(false)
  const [aligning, setAligning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const replaceFace = useCallback((next: ProcessedFaceImage | null) => {
    setFace((prev) => {
      revokeFaceImage(prev)
      return next
    })
    setAlign(next?.align ?? null)
  }, [])

  useEffect(() => {
    faceRef.current = face
  }, [face])

  useEffect(() => () => revokeFaceImage(faceRef.current), [])

  const applyAlignPreview = useCallback(
    async (current: ProcessedFaceImage, nextAlign: OvalAlignParams) => {
      setAligning(true)
      try {
        const next = await reprocessFaceAlign(current, nextAlign)
        setFace((prev) => {
          if (prev?.previewUrl && prev.previewUrl !== next.previewUrl) {
            URL.revokeObjectURL(prev.previewUrl)
          }
          return { ...next, originalUrl: prev?.originalUrl ?? next.originalUrl }
        })
        setAlign(next.align)
      } finally {
        setAligning(false)
      }
    },
    [],
  )

  const alignDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleAlignChange = useCallback(
    (nextAlign: OvalAlignParams) => {
      setAlign(nextAlign)
      if (!face) return
      if (alignDebounceRef.current) clearTimeout(alignDebounceRef.current)
      alignDebounceRef.current = setTimeout(() => {
        const current = faceRef.current
        if (current) void applyAlignPreview(current, nextAlign)
      }, 120)
    },
    [face, applyAlignPreview],
  )

  useEffect(
    () => () => {
      if (alignDebounceRef.current) clearTimeout(alignDebounceRef.current)
    },
    [],
  )

  const handleRedetect = useCallback(async () => {
    if (!face) return
    setAligning(true)
    setError(null)
    try {
      const img = await loadImage(face.originalUrl)
      const detected = await detectFaceAlign(img)
      if (!detected) {
        setError('No face detected — drag the image to fit the oval manually.')
        return
      }
      setAlign(detected.align)
      await applyAlignPreview(face, detected.align)
      setFace((prev) =>
        prev
          ? {
              ...prev,
              faceDetected: true,
              detectionConfidence: detected.confidence,
            }
          : prev,
      )
    } catch {
      setError('Detection failed — align manually into the oval.')
    } finally {
      setAligning(false)
    }
  }, [face, applyAlignPreview])

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return
      setError(null)
      setLoading(true)
      try {
        const processed = await processFaceFile(file)
        replaceFace(processed)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    },
    [replaceFace],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      void handleFile(e.dataTransfer.files[0])
    },
    [handleFile],
  )

  const onPickAnother = () => {
    replaceFace(null)
    setAlign(null)
    setError(null)
    fileInputRef.current?.click()
  }

  return (
    <div className="upload-screen">
      <nav className="upload-nav" aria-label="Site">
        <div className="upload-logo" aria-hidden>
          <span className="upload-logo-shape upload-logo-circle" />
          <span className="upload-logo-shape upload-logo-square" />
          <span className="upload-logo-shape upload-logo-triangle" />
        </div>
        <span className="upload-nav-title">Face Fighter</span>
      </nav>

      <header className="upload-header">
        <p className="upload-kicker">Face Fighter HD</p>
        <h1>Align your face</h1>
        <p className="upload-sub">
          Move, scale, and rotate the yellow frame to match your face. Adjust photo
          zoom if needed. Preview the in-game look on the right.
        </p>
      </header>

      <div className="upload-grid">
        <section className="panel panel-source">
          <h2>Face alignment</h2>

          {!face ? (
            <div
              className="drop-zone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
              }}
            >
              <span className="drop-icon" aria-hidden>+</span>
              <p className="drop-title">Drop or click to choose a photo</p>
              <p className="drop-hint">Pick a clear face photo, then fit it into the oval</p>
              {loading && <p className="drop-loading">Loading…</p>}
            </div>
          ) : (
            align && (
              <FaceAlignPanel
                originalUrl={face.originalUrl}
                align={align}
                faceDetected={face.faceDetected}
                onAlignChange={handleAlignChange}
                onRedetect={() => void handleRedetect()}
                busy={aligning}
              />
            )
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="sr-only"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />

          {error && <p className="upload-error">{error}</p>}

          <ul className="checklist">
            <li>Yellow frame covers forehead to chin?</li>
            <li>Both eyes inside the blue guides?</li>
            <li>Lips snug inside the red guide (not nose or chin)?</li>
          </ul>
        </section>

        <section className="panel panel-preview">
          <h2>In-game preview</h2>
          <div className="preview-stage">
            {face ? (
              <>
                <FaceFighterPreview imageUrl={face.previewUrl} />
                <p className="preview-meta">
                  {face.width}×{face.height}px
                  {face.faceDetected && face.detectionConfidence != null
                    ? ` · AI ${Math.round(face.detectionConfidence * 100)}%`
                    : ''}
                </p>
              </>
            ) : (
              <div className="preview-placeholder">
                <p>Upload a photo and align your face into the oval</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {face && (
        <section className="controls panel">
          <div className="control-actions control-actions-full">
            <button type="button" className="btn btn-secondary" onClick={onPickAnother}>
              Choose another photo
            </button>
            <button type="button" className="btn btn-primary" onClick={() => onEnterFight(face)}>
              {submitLabel}
            </button>
          </div>
        </section>
      )}

      {onBack && (
        <button type="button" className="btn btn-secondary upload-back" onClick={onBack}>
          {backLabel}
        </button>
      )}
    </div>
  )
}
