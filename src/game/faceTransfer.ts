import { DEFAULT_OVAL_ALIGN } from './faceAlign'
import type { ProcessedFaceImage } from './faceImage'

export async function facePreviewToDataUrl(previewUrl: string): Promise<string> {
  const res = await fetch(previewUrl)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not encode face'))
    reader.readAsDataURL(blob)
  })
}

export function faceFromDataUrl(dataUrl: string): ProcessedFaceImage {
  return {
    previewUrl: dataUrl,
    originalUrl: dataUrl,
    originalWidth: 1024,
    originalHeight: 1024,
    align: DEFAULT_OVAL_ALIGN,
    width: 1024,
    height: 1024,
    faceDetected: true,
    detectionConfidence: null,
  }
}
