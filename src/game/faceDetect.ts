import { FaceDetector, type Detection } from '@mediapipe/tasks-vision'
import { alignFromFaceBox, type OvalAlignParams } from './faceAlign'
import { getVisionFileset } from './vision'

const FACE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'

let detectorPromise: Promise<FaceDetector> | null = null

async function getFaceDetector(): Promise<FaceDetector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const vision = await getVisionFileset()
      return FaceDetector.createFromModelPath(vision, FACE_MODEL)
    })()
  }
  return detectorPromise
}

export type FaceDetectionResult = {
  align: OvalAlignParams
  confidence: number
}

function pickLargestFace(detections: Detection[]): Detection | null {
  if (detections.length === 0) return null
  return detections.reduce((best, d) => {
    const box = d.boundingBox
    if (!box) return best
    const area = box.width * box.height
    const bestBox = best.boundingBox
    const bestArea = bestBox ? bestBox.width * bestBox.height : 0
    return area > bestArea ? d : best
  })
}

export async function detectFaceAlign(
  image: HTMLImageElement,
): Promise<FaceDetectionResult | null> {
  const detector = await getFaceDetector()
  const result = detector.detect(image)
  const face = pickLargestFace(result.detections)
  const box = face?.boundingBox
  if (!box) return null

  return {
    align: alignFromFaceBox(image.width, image.height, box),
    confidence: face.categories[0]?.score ?? 0,
  }
}
