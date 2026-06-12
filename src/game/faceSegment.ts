import { ImageSegmenter } from '@mediapipe/tasks-vision'
import { getVisionFileset } from './vision'

const SELFIE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite'

let segmenterPromise: Promise<ImageSegmenter> | null = null

async function getSegmenter(): Promise<ImageSegmenter> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const vision = await getVisionFileset()
      return ImageSegmenter.createFromOptions(vision, {
        baseOptions: { modelAssetPath: SELFIE_MODEL },
        runningMode: 'IMAGE',
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      })
    })()
  }
  return segmenterPromise
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

function sampleBilinear(
  data: Float32Array,
  mw: number,
  mh: number,
  u: number,
  v: number,
): number {
  const x = u * (mw - 1)
  const y = v * (mh - 1)
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(x0 + 1, mw - 1)
  const y1 = Math.min(y0 + 1, mh - 1)
  const fx = x - x0
  const fy = y - y0
  const top = data[y0 * mw + x0] * (1 - fx) + data[y0 * mw + x1] * fx
  const bottom = data[y1 * mw + x0] * (1 - fx) + data[y1 * mw + x1] * fx
  return top * (1 - fy) + bottom * fy
}

/**
 * Average mask value around the crop center. The crop is centered on the
 * detected face, so this region is guaranteed "person" — it tells us which
 * polarity of the confidence mask means person vs background.
 */
function centerAverage(data: Float32Array, mw: number, mh: number): number {
  const x0 = Math.floor(mw * 0.4)
  const x1 = Math.ceil(mw * 0.6)
  const y0 = Math.floor(mh * 0.4)
  const y1 = Math.ceil(mh * 0.6)
  let sum = 0
  let n = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      sum += data[y * mw + x]
      n++
    }
  }
  return n > 0 ? sum / n : 0.5
}

/**
 * Segment the person in the cropped face canvas and make the background
 * transparent (feathered edge). Throws if the model is unavailable.
 */
export async function removePersonBackground(
  canvas: HTMLCanvasElement,
): Promise<void> {
  const segmenter = await getSegmenter()
  const result = segmenter.segment(canvas)
  try {
    const mask = result.confidenceMasks?.[0]
    if (!mask) throw new Error('No segmentation mask')
    const data = mask.getAsFloat32Array()
    const mw = mask.width
    const mh = mask.height
    const inverted = centerAverage(data, mw, mh) < 0.5

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')
    const w = canvas.width
    const h = canvas.height
    const img = ctx.getImageData(0, 0, w, h)
    const px = img.data

    for (let y = 0; y < h; y++) {
      const v = h > 1 ? y / (h - 1) : 0
      for (let x = 0; x < w; x++) {
        const u = w > 1 ? x / (w - 1) : 0
        let p = sampleBilinear(data, mw, mh, u, v)
        if (inverted) p = 1 - p
        const a = smoothstep(0.22, 0.72, p)
        if (a < 1) {
          const i = (y * w + x) * 4 + 3
          px[i] = (px[i] * a) | 0
        }
      }
    }
    ctx.putImageData(img, 0, 0)
  } finally {
    result.close()
  }
}

/**
 * Offline fallback when the segmentation model can't load: feathered
 * elliptical vignette so the square corners never show raw background.
 */
export function maskEllipseFallback(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  ctx.save()
  ctx.globalCompositeOperation = 'destination-in'
  ctx.translate(w / 2, h * 0.48)
  ctx.scale(w * 0.52, h * 0.58)
  const grad = ctx.createRadialGradient(0, 0, 0.8, 0, 0, 1)
  grad.addColorStop(0, 'rgba(0, 0, 0, 1)')
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = grad
  ctx.fillRect(-1.1, -1.1, 2.2, 2.2)
  ctx.restore()
}
