/** Fixed oval guide — normalized to a square viewport (0–1). */
export const OVAL = {
  cx: 0.5,
  cy: 0.46,
  rx: 0.36,
  ry: 0.44,
} as const

/** Eye / mouth anchors — same coords as faceDepth + mount.png damage overlay. */
export const MOUNT_LANDMARKS = {
  leftEye: {
    cx: OVAL.cx - 0.42 * OVAL.rx,
    cy: OVAL.cy - 0.3 * OVAL.ry,
    rx: 0.11,
    ry: 0.075,
  },
  rightEye: {
    cx: OVAL.cx + 0.42 * OVAL.rx,
    cy: OVAL.cy - 0.3 * OVAL.ry,
    rx: 0.11,
    ry: 0.075,
  },
  mouth: {
    cx: OVAL.cx,
    cy: OVAL.cy + 0.3 * OVAL.ry,
    /** Overlay width as a fraction of the oval width (matches mount.png draw). */
    scaleX: 0.66,
    rx: OVAL.rx * 0.66,
    ry: 0.09,
  },
} as const

export type OvalAlignParams = {
  /** Horizontal pan, −1 … 1 */
  panX: number
  /** Vertical pan, −1 … 1 */
  panY: number
  /** Zoom on top of fit-to-frame, 0.55 … 2.8 */
  zoom: number
}

export const DEFAULT_OVAL_ALIGN: OvalAlignParams = {
  panX: 0,
  panY: 0,
  zoom: 1,
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

/** Image draw rect in viewport pixels (square side = viewportSize). */
export function imageDrawRect(
  imgWidth: number,
  imgHeight: number,
  viewportSize: number,
  align: OvalAlignParams,
) {
  const zoom = clamp(align.zoom, 0.55, 2.8)
  const fit = Math.min(viewportSize / imgWidth, viewportSize / imgHeight) * zoom
  const drawW = imgWidth * fit
  const drawH = imgHeight * fit
  const left = viewportSize / 2 - drawW / 2 + align.panX * viewportSize * 0.42
  const top = viewportSize / 2 - drawH / 2 + align.panY * viewportSize * 0.42
  return { left, top, drawW, drawH, fit }
}

/** Draw the aligned photo — same math as the on-screen alignment viewport. */
export function drawAlignedImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  viewportSize: number,
  align: OvalAlignParams,
) {
  const { left, top, drawW, drawH } = imageDrawRect(
    img.width,
    img.height,
    viewportSize,
    align,
  )
  ctx.drawImage(img, left, top, drawW, drawH)
}

/**
 * Render square portrait: crop exactly what sits inside the yellow oval guide.
 * Uses the same placement math as the alignment viewport (WYSIWYG).
 */
export function renderOvalPortrait(
  img: HTMLImageElement,
  align: OvalAlignParams,
  outSize = 512,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = outSize
  canvas.height = outSize
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')

  const cx = outSize * OVAL.cx
  const cy = outSize * OVAL.cy
  const rx = outSize * OVAL.rx
  const ry = outSize * OVAL.ry

  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.clip()
  drawAlignedImage(ctx, img, outSize, align)
  ctx.restore()

  return canvas
}

/** Fit detected face bbox into the fixed oval. */
export function alignFromFaceBox(
  imgWidth: number,
  imgHeight: number,
  box: { originX: number; originY: number; width: number; height: number },
): OvalAlignParams {
  const viewport = 512
  const faceCx = box.originX + box.width / 2
  const faceCy = box.originY + box.height / 2 - box.height * 0.06

  const ovalH = viewport * OVAL.ry * 2
  const targetFaceH = box.height * 1.15
  let zoom = (ovalH / targetFaceH) * 0.95
  zoom = clamp(zoom, 0.65, 2.4)

  const { left, top, drawW, drawH } = imageDrawRect(imgWidth, imgHeight, viewport, {
    panX: 0,
    panY: 0,
    zoom,
  })

  const ovalCx = viewport * OVAL.cx
  const ovalCy = viewport * OVAL.cy
  const faceScreenX = left + (faceCx / imgWidth) * drawW
  const faceScreenY = top + (faceCy / imgHeight) * drawH

  const panX = clamp((ovalCx - faceScreenX) / (viewport * 0.42), -1, 1)
  const panY = clamp((ovalCy - faceScreenY) / (viewport * 0.42), -1, 1)

  return { panX, panY, zoom }
}

export function clampOvalAlign(align: OvalAlignParams): OvalAlignParams {
  return {
    panX: clamp(align.panX, -1, 1),
    panY: clamp(align.panY, -1, 1),
    zoom: clamp(align.zoom, 0.55, 2.8),
  }
}
