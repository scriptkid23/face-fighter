/** Procedural face depth — used by the fight scene (plane mesh), not the upload preview. */
export function depthAt(u: number, v: number): number {
  const g = (x: number, y: number, cx: number, cy: number, sx: number, sy: number) =>
    Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2))

  let z = Math.sqrt(Math.max(0, 1 - (u / 1.05) ** 2 - (v / 1.12) ** 2)) * 0.85
  z += 0.34 * g(u, v, 0, 0.12, 0.16, 0.34)
  z += 0.16 * g(u, v, 0, 0.3, 0.2, 0.1)
  z += 0.1 * g(u, v, 0, -0.28, 0.55, 0.16)
  z -= 0.07 * (g(u, v, -0.32, -0.18, 0.16, 0.09) + g(u, v, 0.32, -0.18, 0.16, 0.09))
  z += 0.1 * (g(u, v, -0.42, 0.3, 0.22, 0.22) + g(u, v, 0.42, 0.3, 0.22, 0.22))
  z += 0.12 * g(u, v, 0, 0.8, 0.22, 0.18)
  z += 0.06 * g(u, v, 0, 0.55, 0.3, 0.12)
  return z
}

export const HEAD_RADIUS = 0.82
export const HEAD_SCALE_Y = 1.26
export const HEAD_SCALE_Z = 0.92

export function getHeadRadii() {
  return {
    rx: HEAD_RADIUS,
    ry: HEAD_RADIUS * HEAD_SCALE_Y,
    rz: HEAD_RADIUS * HEAD_SCALE_Z,
  }
}
