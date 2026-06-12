import { useCallback, useEffect, useRef, useState } from 'react'
import { FightScreen } from './screens/FightScreen'
import { FaceUploadScreen } from './screens/FaceUploadScreen'
import { LobbyScreen, type LobbyResult } from './screens/LobbyScreen'
import { faceFromDataUrl, facePreviewToDataUrl } from './game/faceTransfer'
import { GameNetClient } from './game/net/client'
import { revokeFaceImage, type ProcessedFaceImage } from './game/faceImage'
import './screens/LobbyScreen.css'

type Phase = 'lobby' | 'upload' | 'waiting' | 'fight'
type GameMode = 'solo' | 'pvp'

export default function App() {
  const [phase, setPhase] = useState<Phase>('lobby')
  const [mode, setMode] = useState<GameMode>('solo')
  const netRef = useRef<GameNetClient | null>(null)
  const myFaceRef = useRef<ProcessedFaceImage | null>(null)
  const oppFaceRef = useRef<ProcessedFaceImage | null>(null)
  const [roomId, setRoomId] = useState('')
  const [myFace, setMyFace] = useState<ProcessedFaceImage | null>(null)
  const [oppFace, setOppFace] = useState<ProcessedFaceImage | null>(null)
  const [waitHint, setWaitHint] = useState('')

  const resetSession = useCallback(() => {
    netRef.current?.close()
    netRef.current = null
    revokeFaceImage(myFaceRef.current)
    revokeFaceImage(oppFaceRef.current)
    myFaceRef.current = null
    oppFaceRef.current = null
    setMyFace(null)
    setOppFace(null)
    setRoomId('')
    setWaitHint('')
    setMode('solo')
    setPhase('lobby')
  }, [])

  const tryStartPvpFight = useCallback(() => {
    const mine = myFaceRef.current
    const opp = oppFaceRef.current
    if (!mine || !opp) return
    setMyFace(mine)
    setOppFace(opp)
    setPhase('fight')
  }, [])

  const bindNetHandlers = useCallback(
    (net: GameNetClient) => {
      net.setHandlers({
        onClose: () => setWaitHint('LAN connection lost'),
        onError: (msg) => setWaitHint(msg),
        onPeerLeft: () => setWaitHint('Opponent left'),
        onPeerFace: (dataUrl) => {
          const opp = faceFromDataUrl(dataUrl)
          oppFaceRef.current = opp
          setOppFace(opp)
        },
        onFightStart: () => tryStartPvpFight(),
      })
    },
    [tryStartPvpFight],
  )

  const handleLobbyReady = useCallback(
    (result: LobbyResult) => {
      if (result.mode === 'solo') {
        setMode('solo')
        setPhase('upload')
        return
      }
      setMode('pvp')
      netRef.current = result.net
      setRoomId(result.roomId)
      bindNetHandlers(result.net)
      setPhase('upload')
    },
    [bindNetHandlers],
  )

  const handleUploadReady = useCallback(
    async (face: ProcessedFaceImage) => {
      if (mode === 'solo') {
        myFaceRef.current = face
        oppFaceRef.current = face
        setMyFace(face)
        setOppFace(face)
        setPhase('fight')
        return
      }

      const net = netRef.current
      if (!net) return

      myFaceRef.current = face
      setMyFace(face)
      setPhase('waiting')
      setWaitHint('Sending face…')

      try {
        const dataUrl = await facePreviewToDataUrl(face.previewUrl)
        net.sendFace(dataUrl)
        net.sendReady()
        setWaitHint('Waiting for opponent…')
      } catch {
        setWaitHint('Could not send face — try again')
        setPhase('upload')
      }
    },
    [mode],
  )

  useEffect(() => {
    if (phase === 'waiting' && myFaceRef.current && oppFaceRef.current) {
      setWaitHint('Opponent sent their face — waiting for start…')
    }
  }, [phase, oppFace])

  return (
    <>
      {phase === 'lobby' && <LobbyScreen onReady={handleLobbyReady} />}

      <div hidden={phase !== 'upload'}>
        <FaceUploadScreen
          onEnterFight={(face) => void handleUploadReady(face)}
          backLabel={mode === 'pvp' ? '← Back to lobby' : undefined}
          onBack={mode === 'pvp' ? resetSession : undefined}
          submitLabel={mode === 'pvp' ? 'Ready — wait for opponent' : undefined}
        />
      </div>

      {phase === 'waiting' && (
        <div className="lobby-screen">
          <header className="lobby-header">
            <p className="lobby-kicker">Room {roomId}</p>
            <h1>Waiting for opponent…</h1>
            <p className="lobby-sub">{waitHint}</p>
          </header>
        </div>
      )}

      {phase === 'fight' && myFace && oppFace && (
        <FightScreen
          face={oppFace}
          playerFace={mode === 'pvp' ? myFace : undefined}
          mode={mode === 'pvp' ? 'pvp' : 'ai'}
          net={mode === 'pvp' ? netRef.current : null}
          onBack={resetSession}
        />
      )}
    </>
  )
}
