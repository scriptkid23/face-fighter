import { useState } from 'react'
import { FightScreen } from './screens/FightScreen'
import { FaceUploadScreen } from './screens/FaceUploadScreen'
import type { ProcessedFaceImage } from './game/faceImage'

export default function App() {
  const [phase, setPhase] = useState<'upload' | 'fight'>('upload')
  const [fightFace, setFightFace] = useState<ProcessedFaceImage | null>(null)

  return (
    <>
      <div hidden={phase !== 'upload'}>
        <FaceUploadScreen
          onEnterFight={(face) => {
            setFightFace(face)
            setPhase('fight')
          }}
        />
      </div>
      {phase === 'fight' && fightFace && (
        <FightScreen face={fightFace} onBack={() => setPhase('upload')} />
      )}
    </>
  )
}
