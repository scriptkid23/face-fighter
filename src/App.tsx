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
        onClose: () => setWaitHint('Mất kết nối LAN'),
        onError: (msg) => setWaitHint(msg),
        onPeerLeft: () => setWaitHint('Đối thủ thoát'),
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
      setWaitHint('Đang gửi mặt…')

      try {
        const dataUrl = await facePreviewToDataUrl(face.previewUrl)
        net.sendFace(dataUrl)
        net.sendReady()
        setWaitHint('Chờ đối thủ sẵn sàng…')
      } catch {
        setWaitHint('Không gửi được ảnh — thử lại')
        setPhase('upload')
      }
    },
    [mode],
  )

  useEffect(() => {
    if (phase === 'waiting' && myFaceRef.current && oppFaceRef.current) {
      setWaitHint('Đối thủ đã gửi mặt — chờ server bắt đầu…')
    }
  }, [phase, oppFace])

  return (
    <>
      {phase === 'lobby' && <LobbyScreen onReady={handleLobbyReady} />}

      <div hidden={phase !== 'upload'}>
        <FaceUploadScreen
          onEnterFight={(face) => void handleUploadReady(face)}
          backLabel={mode === 'pvp' ? '← Về lobby' : undefined}
          onBack={mode === 'pvp' ? resetSession : undefined}
          submitLabel={mode === 'pvp' ? 'Sẵn sàng — chờ đối thủ' : undefined}
        />
      </div>

      {phase === 'waiting' && (
        <div className="lobby-screen">
          <header className="lobby-header">
            <p className="lobby-kicker">Phòng {roomId}</p>
            <h1>Chờ đối thủ…</h1>
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
