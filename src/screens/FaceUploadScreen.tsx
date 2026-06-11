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
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Không đọc được ảnh'))
    img.src = url
  })
}

export function FaceUploadScreen({ onEnterFight }: FaceUploadScreenProps) {
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

  // Revoke only on unmount — not when face updates (same originalUrl is reused).
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
        setError('Không thấy mặt — kéo ảnh cho vừa oval thủ công.')
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
      setError('Lỗi nhận diện — căn thủ công vào oval.')
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
        setError(e instanceof Error ? e.message : 'Lỗi không xác định')
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
      <header className="upload-header">
        <p className="upload-kicker">FACE FIGHTER HD</p>
        <h1>Đặt mặt vào oval</h1>
        <p className="upload-sub">
          Khung oval vàng cố định — kéo hoặc phóng to ảnh cho mặt vừa khung. Xong
          thì xem preview bên phải.
        </p>
      </header>

      <div className="upload-grid">
        <section className="panel panel-source">
          <h2>Căn mặt</h2>

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
              <span className="drop-icon" aria-hidden>
                📷
              </span>
              <p className="drop-title">Kéo thả hoặc bấm để chọn ảnh</p>
              <p className="drop-hint">Chọn ảnh có mặt rõ — sau đó đặt vào oval</p>
              {loading && <p className="drop-loading">Đang tải…</p>}
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
            <li>Hai mắt nằm gọn trong oval xanh?</li>
            <li>Miệng nằm gọn trong oval đỏ (khớp răng sứt khi đấm)?</li>
            <li>Trán và cằm chạm gần mép oval vàng?</li>
          </ul>
        </section>

        <section className="panel panel-preview">
          <h2>Preview in-game</h2>
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
                <p>Upload ảnh rồi đặt mặt vào oval</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {face && (
        <section className="controls panel">
          <div className="control-actions control-actions-full">
            <button type="button" className="btn btn-secondary" onClick={onPickAnother}>
              Chọn ảnh khác
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onEnterFight(face)}
            >
              Trông ổn — vào đấu
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
