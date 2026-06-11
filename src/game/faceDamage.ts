import { MOUNT_LANDMARKS, OVAL } from './faceAlign'

const MOUTH_SRC = '/mount.png'
const MOUTH_SRC_FALLBACK = '/mount.jpg'

type MouthOverlay = {
  canvas: HTMLCanvasElement
  box: { x: number; y: number; w: number; h: number }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Không đọc được ảnh'))
    img.src = url
  })
}

/** Bounding box of non-transparent pixels in a PNG overlay. */
function extractAlphaOverlay(img: HTMLImageElement): MouthOverlay {
  const w = img.naturalWidth
  const h = img.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas không khả dụng')
  ctx.drawImage(img, 0, 0)
  const id = ctx.getImageData(0, 0, w, h)
  const px = id.data

  let minX = w
  let minY = h
  let maxX = 0
  let maxY = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = px[(y * w + x) * 4 + 3] ?? 0
      if (a < 20) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (maxX <= minX || maxY <= minY) {
    throw new Error('Không tách được miệng từ mount.png')
  }
  return {
    canvas,
    box: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
  }
}

/**
 * mount.jpg may bake a checkerboard into the pixels. Flood-fill from the
 * borders over light low-saturation pixels to key it out.
 */
function keyOutCheckerboard(img: HTMLImageElement): MouthOverlay {
  const w = img.naturalWidth
  const h = img.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas không khả dụng')
  ctx.drawImage(img, 0, 0)
  const id = ctx.getImageData(0, 0, w, h)
  const px = id.data

  const isBackdrop = (p: number) => {
    const r = px[p] ?? 0
    const g = px[p + 1] ?? 0
    const b = px[p + 2] ?? 0
    const max = Math.max(r, g, b)
    return max - Math.min(r, g, b) < 30 && max > 150
  }

  const visited = new Uint8Array(w * h)
  const stack: number[] = []
  const seed = (i: number) => {
    if (!visited[i] && isBackdrop(i * 4)) {
      visited[i] = 1
      stack.push(i)
    }
  }
  for (let x = 0; x < w; x++) {
    seed(x)
    seed((h - 1) * w + x)
  }
  for (let y = 0; y < h; y++) {
    seed(y * w)
    seed(y * w + w - 1)
  }
  while (stack.length > 0) {
    const i = stack.pop()
    if (i === undefined) break
    const x = i % w
    if (x > 0) seed(i - 1)
    if (x < w - 1) seed(i + 1)
    if (i >= w) seed(i - w)
    if (i < w * (h - 1)) seed(i + w)
  }

  let minX = w
  let minY = h
  let maxX = 0
  let maxY = 0
  for (let i = 0; i < w * h; i++) {
    if (visited[i]) {
      px[i * 4 + 3] = 0
      continue
    }
    const x = i % w
    const y = (i / w) | 0
    const nearBg =
      (x > 0 && visited[i - 1]) ||
      (x < w - 1 && visited[i + 1]) ||
      (i >= w && visited[i - w]) ||
      (i < w * (h - 1) && visited[i + w])
    if (nearBg) px[i * 4 + 3] = ((px[i * 4 + 3] ?? 255) * 0.45) | 0
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  ctx.putImageData(id, 0, 0)

  if (maxX <= minX || maxY <= minY) {
    throw new Error('Không tách được miệng từ mount.jpg')
  }
  return {
    canvas,
    box: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
  }
}

let overlayPromise: Promise<MouthOverlay> | null = null

function getMouthOverlay(): Promise<MouthOverlay> {
  if (!overlayPromise) {
    overlayPromise = loadImage(MOUTH_SRC)
      .then(extractAlphaOverlay)
      .catch(() => loadImage(MOUTH_SRC_FALLBACK).then(keyOutCheckerboard))
  }
  return overlayPromise
}

/** Face texture with the broken mouth composited over the lips. */
export async function renderDamagedFace(
  previewUrl: string,
): Promise<HTMLCanvasElement> {
  const [overlay, faceImg] = await Promise.all([
    getMouthOverlay(),
    loadImage(previewUrl),
  ])
  const size = faceImg.naturalWidth
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas không khả dụng')
  ctx.drawImage(faceImg, 0, 0, size, size)

  const mouth = MOUNT_LANDMARKS.mouth

  ctx.save()
  ctx.beginPath()
  ctx.ellipse(
    size * OVAL.cx,
    size * OVAL.cy,
    size * OVAL.rx,
    size * OVAL.ry,
    0,
    0,
    Math.PI * 2,
  )
  ctx.clip()

  const destW = size * OVAL.rx * 2 * mouth.scaleX
  const destH = (destW * overlay.box.h) / overlay.box.w
  ctx.drawImage(
    overlay.canvas,
    overlay.box.x,
    overlay.box.y,
    overlay.box.w,
    overlay.box.h,
    size * mouth.cx - destW / 2,
    size * mouth.cy - destH / 2,
    destW,
    destH,
  )
  ctx.restore()
  return canvas
}
