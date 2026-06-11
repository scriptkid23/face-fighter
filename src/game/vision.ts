import { FilesetResolver } from '@mediapipe/tasks-vision'

const WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'

let filesetPromise: ReturnType<typeof FilesetResolver.forVisionTasks> | null =
  null

/** Shared MediaPipe WASM fileset — one download for detector + segmenter. */
export function getVisionFileset() {
  if (!filesetPromise) {
    filesetPromise = FilesetResolver.forVisionTasks(WASM_BASE)
  }
  return filesetPromise
}
