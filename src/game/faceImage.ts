import {
  clampOvalAlign,
  DEFAULT_OVAL_ALIGN,
  renderOvalPortrait,
  type OvalAlignParams,
} from './faceAlign'
import { detectFaceAlign } from './faceDetect'

const MAX_EDGE = 1024

export type ProcessedFaceImage = {
  previewUrl: string
  originalUrl: string
  originalWidth: number
  originalHeight: number
  align: OvalAlignParams
  width: number
  height: number
  faceDetected: boolean
  detectionConfidence: number | null
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read image'))
    img.src = url
  })
}

async function canvasToPreviewUrl(canvas: HTMLCanvasElement): Promise<string> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not process image'))),
      'image/png',
    )
  })
  return URL.createObjectURL(blob)
}

export async function buildProcessedFace(
  img: HTMLImageElement,
  originalUrl: string,
  align: OvalAlignParams,
  faceDetected: boolean,
  detectionConfidence: number | null,
): Promise<ProcessedFaceImage> {
  const clamped = clampOvalAlign(align)
  const out = Math.min(MAX_EDGE, Math.max(img.width, img.height))
  const canvas = renderOvalPortrait(img, clamped, out)
  const previewUrl = await canvasToPreviewUrl(canvas)
  return {
    previewUrl,
    originalUrl,
    originalWidth: img.width,
    originalHeight: img.height,
    align: clamped,
    width: canvas.width,
    height: canvas.height,
    faceDetected,
    detectionConfidence,
  }
}

export async function processFaceFile(file: File): Promise<ProcessedFaceImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file (JPG, PNG, WebP…)')
  }

  const originalUrl = URL.createObjectURL(file)
  try {
    const img = await loadImage(originalUrl)

    let align = DEFAULT_OVAL_ALIGN
    let faceDetected = false
    let detectionConfidence: number | null = null

    try {
      const detected = await detectFaceAlign(img)
      if (detected) {
        align = detected.align
        faceDetected = true
        detectionConfidence = detected.confidence
      }
    } catch {
      // Offline — user aligns manually into the oval.
    }

    return await buildProcessedFace(
      img,
      originalUrl,
      align,
      faceDetected,
      detectionConfidence,
    )
  } catch (e) {
    URL.revokeObjectURL(originalUrl)
    throw e
  }
}

export async function reprocessFaceAlign(
  face: ProcessedFaceImage,
  align: OvalAlignParams,
): Promise<ProcessedFaceImage> {
  const img = await loadImage(face.originalUrl)
  return buildProcessedFace(
    img,
    face.originalUrl,
    align,
    face.faceDetected,
    face.detectionConfidence,
  )
}

export function revokeFaceImage(image: ProcessedFaceImage | null) {
  if (!image) return
  if (image.previewUrl) URL.revokeObjectURL(image.previewUrl)
  if (image.originalUrl) URL.revokeObjectURL(image.originalUrl)
}
