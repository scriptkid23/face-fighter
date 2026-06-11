import * as THREE from 'three'
import { depthAt } from './faceDepth'

/** Displaced plane mesh with the user's face texture — same khuôn as the HTML prototype. */
export function buildFaceMesh(texture: THREE.Texture): THREE.Mesh {
  texture.minFilter = THREE.LinearFilter
  texture.colorSpace = THREE.SRGBColorSpace

  const geo = new THREE.PlaneGeometry(1.5, 1.9, 80, 80)
  const positions = geo.attributes.position
  for (let i = 0; i < positions.count; i++) {
    const u = positions.getX(i) / 0.75
    const v = -positions.getY(i) / 0.95
    const wrap = Math.pow(Math.min(1, Math.abs(u)), 3) * 0.34
    positions.setZ(i, (depthAt(u, v) - wrap) * 0.62)
  }
  geo.computeVertexNormals()

  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.75,
    transparent: true,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.z = 0.12
  return mesh
}

export function buildSkullMesh(): THREE.Mesh {
  const skull = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 32, 24),
    new THREE.MeshStandardMaterial({ color: 0x46362c, roughness: 0.9 }),
  )
  skull.scale.set(1, 1.26, 0.92)
  skull.position.set(0, 0.04, -0.18)
  return skull
}
