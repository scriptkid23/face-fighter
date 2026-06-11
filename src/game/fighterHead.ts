import * as THREE from 'three'
import { OVAL } from './faceAlign'
import { depthAt } from './faceDepth'

// Skull ellipsoid front silhouette (see buildSkullMesh): r = 0.8, scale (1, 1.26).
const SKULL_W = 1.6
const SKULL_H = 2.016
const SKULL_CY = 0.04

// The texture is a square with the face clipped to OVAL — size the plane so
// that oval (not the square) covers the skull's whole front, slightly over so
// no brown rim peeks around the face.
const PLANE_W = (SKULL_W * 1.05) / (OVAL.rx * 2)
const PLANE_H = (SKULL_H * 1.03) / (OVAL.ry * 2)
// Drop the plane so the oval's center (texture y = OVAL.cy) sits on the skull center.
const PLANE_Y = SKULL_CY - (0.5 - OVAL.cy) * PLANE_H
// depthAt() relief was tuned for a 1.5-wide face — scale to the oval's world width.
const RELIEF = 0.62 * ((PLANE_W * OVAL.rx * 2) / 1.5)

/** Displaced plane mesh with the user's face texture stretched over the skull front. */
export function buildFaceMesh(texture: THREE.Texture): THREE.Mesh {
  texture.minFilter = THREE.LinearFilter
  texture.colorSpace = THREE.SRGBColorSpace

  const geo = new THREE.PlaneGeometry(PLANE_W, PLANE_H, 80, 80)
  const positions = geo.attributes.position
  for (let i = 0; i < positions.count; i++) {
    // Normalize against the texture oval so the relief (nose, lips, brow)
    // lands on the visible face, not the transparent square corners.
    const u = positions.getX(i) / (PLANE_W * OVAL.rx)
    const v = (0.5 - OVAL.cy - positions.getY(i) / PLANE_H) / OVAL.ry
    const wrap = Math.pow(Math.min(1, Math.abs(u)), 3) * 0.34
    positions.setZ(i, (depthAt(u, v) - wrap) * RELIEF)
  }
  geo.computeVertexNormals()

  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.75,
    transparent: true,
    alphaTest: 0.02,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(0, PLANE_Y, 0.12)
  return mesh
}

export function buildSkullMesh(): THREE.Mesh {
  const skull = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 32, 24),
    new THREE.MeshStandardMaterial({ color: 0x46362c, roughness: 0.9 }),
  )
  skull.scale.set(1, 1.26, 0.92)
  skull.position.set(0, SKULL_CY, -0.18)
  return skull
}
