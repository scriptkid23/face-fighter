import { useEffect, useRef, useState } from 'react'
import { GameNetClient } from '../game/net/client'
import { GAME_WS_PORT } from '../game/net/protocol'
import './LobbyScreen.css'

export type LobbyResult =
  | { mode: 'solo' }
  | { mode: 'pvp'; net: GameNetClient; roomId: string; isHost: boolean }

type LobbyScreenProps = {
  onReady: (result: LobbyResult) => void
}

type LanTab = 'host' | 'join'

export function LobbyScreen({ onReady }: LobbyScreenProps) {
  const netRef = useRef<GameNetClient | null>(null)
  const [tab, setTab] = useState<LanTab>('host')
  const [roomCode, setRoomCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [hostIp, setHostIp] = useState(() => window.location.hostname)
  const [status, setStatus] = useState('Chọn chế độ chơi')
  const [waitingPeer, setWaitingPeer] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => () => netRef.current?.close(), [])

  function attachHandlers(net: GameNetClient, asHost: boolean) {
    net.setHandlers({
      onClose: () => {
        setWaitingPeer(false)
        setStatus('Mất kết nối server LAN')
        setBusy(false)
      },
      onError: (message) => {
        setError(message)
        setBusy(false)
      },
      onCreated: (roomId) => {
        setRoomCode(roomId)
        setWaitingPeer(true)
        setStatus(`Phòng ${roomId} — chờ đối thủ…`)
        setBusy(false)
      },
      onJoined: (roomId) => {
        setRoomCode(roomId)
        setStatus(`Đã vào phòng ${roomId}`)
        setBusy(false)
        onReady({ mode: 'pvp', net, roomId, isHost: false })
      },
      onPeerJoined: () => {
        if (!asHost) return
        setWaitingPeer(false)
        setStatus('Đối thủ đã vào — bấm tiếp tục')
      },
      onPeerLeft: () => {
        if (!asHost) return
        setWaitingPeer(true)
        setStatus('Đối thủ thoát — chờ người mới…')
      },
    })
  }

  async function startHost() {
    setError(null)
    setBusy(true)
    setStatus('Đang kết nối server…')
    try {
      netRef.current?.close()
      const net = new GameNetClient()
      netRef.current = net
      attachHandlers(net, true)
      await net.connect(hostIp.trim() || window.location.hostname)
      net.createRoom()
    } catch {
      setError('Không kết nối được server LAN — máy host đã chạy npm run dev?')
      setBusy(false)
    }
  }

  async function startJoin() {
    const code = joinCode.trim().toUpperCase()
    if (code.length < 4) {
      setError('Nhập mã phòng 4 ký tự')
      return
    }
    setError(null)
    setBusy(true)
    setStatus('Đang vào phòng…')
    try {
      netRef.current?.close()
      const net = new GameNetClient()
      netRef.current = net
      attachHandlers(net, false)
      await net.connect(hostIp.trim() || window.location.hostname)
      net.joinRoom(code)
    } catch {
      setError('Không kết nối được server LAN')
      setBusy(false)
    }
  }

  function continueHost() {
    const net = netRef.current
    if (!net || !roomCode) return
    onReady({ mode: 'pvp', net, roomId: roomCode, isHost: true })
  }

  return (
    <div className="lobby-screen">
      <header className="lobby-header">
        <p className="lobby-kicker">Face Fighter HD</p>
        <h1>Chọn chế độ</h1>
        <p className="lobby-sub">
          Solo đấu AI, hoặc LAN 2 người qua Wi‑Fi. Máy host chạy{' '}
          <code>npm run dev</code> (Vite + server LAN port {GAME_WS_PORT}).
        </p>
      </header>

      <div className="lobby-grid">
        <section className="panel lobby-panel">
          <button type="button" className="btn btn-primary lobby-solo" onClick={() => onReady({ mode: 'solo' })}>
            Solo vs AI
          </button>
        </section>

        <section className="panel lobby-panel lobby-panel--lan">
          <h2>Đấu LAN</h2>

          <div className="lobby-tabs">
            <button
              type="button"
              className={tab === 'host' ? 'lobby-tab lobby-tab--active' : 'lobby-tab'}
              onClick={() => setTab('host')}
            >
              Tạo phòng
            </button>
            <button
              type="button"
              className={tab === 'join' ? 'lobby-tab lobby-tab--active' : 'lobby-tab'}
              onClick={() => setTab('join')}
            >
              Vào phòng
            </button>
          </div>

          <label className="lobby-field">
            <span>IP máy host (WebSocket)</span>
            <input
              value={hostIp}
              onChange={(e) => setHostIp(e.target.value)}
              placeholder="192.168.1.10"
              spellCheck={false}
            />
          </label>

          {tab === 'host' ? (
            <>
              {!roomCode ? (
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void startHost()}>
                  {busy ? 'Đang tạo…' : 'Tạo phòng LAN'}
                </button>
              ) : (
                <div className="lobby-room">
                  <p className="lobby-room-label">Mã phòng</p>
                  <p className="lobby-room-code">{roomCode}</p>
                  <p className="lobby-room-hint">
                    Đối thủ mở <strong>http://{hostIp || 'IP-host'}:5173</strong> → Vào phòng → nhập mã
                  </p>
                  {!waitingPeer && (
                    <button type="button" className="btn btn-primary" onClick={continueHost}>
                      Tiếp tục — căn mặt
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <label className="lobby-field">
                <span>Mã phòng</span>
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={4}
                  placeholder="ABCD"
                  spellCheck={false}
                />
              </label>
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void startJoin()}>
                {busy ? 'Đang vào…' : 'Vào phòng'}
              </button>
            </>
          )}

          <p className="lobby-status">{status}</p>
          {error && <p className="lobby-error">{error}</p>}
        </section>
      </div>
    </div>
  )
}
