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
  // Once the client is handed to App via onReady, this screen no longer owns
  // it — unmounting must NOT close the socket the match runs on.
  const handedOffRef = useRef(false)
  const [tab, setTab] = useState<LanTab>('host')
  const [roomCode, setRoomCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [hostIp, setHostIp] = useState(() => window.location.hostname)
  const [status, setStatus] = useState('Choose a game mode')
  const [waitingPeer, setWaitingPeer] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(
    () => () => {
      if (!handedOffRef.current) netRef.current?.close()
    },
    [],
  )

  function attachHandlers(net: GameNetClient, asHost: boolean) {
    net.setHandlers({
      onClose: () => {
        setWaitingPeer(false)
        setStatus('LAN server disconnected')
        setBusy(false)
      },
      onError: (message) => {
        setError(message)
        setBusy(false)
      },
      onCreated: (roomId) => {
        setRoomCode(roomId)
        setWaitingPeer(true)
        setStatus(`Room ${roomId} — waiting for opponent…`)
        setBusy(false)
      },
      onJoined: (roomId) => {
        setRoomCode(roomId)
        setStatus(`Joined room ${roomId}`)
        setBusy(false)
        handedOffRef.current = true
        onReady({ mode: 'pvp', net, roomId, isHost: false })
      },
      onPeerJoined: () => {
        if (!asHost) return
        setWaitingPeer(false)
        setStatus('Opponent joined — continue when ready')
      },
      onPeerLeft: () => {
        if (!asHost) return
        setWaitingPeer(true)
        setStatus('Opponent left — waiting for someone new…')
      },
    })
  }

  async function startHost() {
    setError(null)
    setBusy(true)
    setStatus('Connecting to server…')
    try {
      netRef.current?.close()
      const net = new GameNetClient()
      netRef.current = net
      attachHandlers(net, true)
      await net.connect(hostIp.trim() || window.location.hostname)
      net.createRoom()
    } catch {
      setError('Could not connect to LAN server — is the host running npm run dev?')
      setBusy(false)
    }
  }

  async function startJoin() {
    const code = joinCode.trim().toUpperCase()
    if (code.length < 4) {
      setError('Enter a 4-character room code')
      return
    }
    setError(null)
    setBusy(true)
    setStatus('Joining room…')
    try {
      netRef.current?.close()
      const net = new GameNetClient()
      netRef.current = net
      attachHandlers(net, false)
      await net.connect(hostIp.trim() || window.location.hostname)
      net.joinRoom(code)
    } catch {
      setError('Could not connect to LAN server')
      setBusy(false)
    }
  }

  function continueHost() {
    const net = netRef.current
    if (!net || !roomCode) return
    handedOffRef.current = true
    onReady({ mode: 'pvp', net, roomId: roomCode, isHost: true })
  }

  return (
    <div className="lobby-screen">
      <header className="lobby-header">
        <p className="lobby-kicker">Face Fighter HD</p>
        <h1>Choose mode</h1>
        <p className="lobby-sub">
          Solo vs AI, or 2-player LAN over Wi‑Fi. The host runs{' '}
          <code>npm run dev</code> (Vite + LAN server on port {GAME_WS_PORT}).
        </p>
      </header>

      <div className="lobby-grid">
        <section className="panel lobby-panel">
          <button type="button" className="btn btn-primary lobby-solo" onClick={() => onReady({ mode: 'solo' })}>
            Solo vs AI
          </button>
        </section>

        <section className="panel lobby-panel lobby-panel--lan">
          <h2>LAN match</h2>

          <div className="lobby-tabs">
            <button
              type="button"
              className={tab === 'host' ? 'lobby-tab lobby-tab--active' : 'lobby-tab'}
              onClick={() => setTab('host')}
            >
              Host room
            </button>
            <button
              type="button"
              className={tab === 'join' ? 'lobby-tab lobby-tab--active' : 'lobby-tab'}
              onClick={() => setTab('join')}
            >
              Join room
            </button>
          </div>

          <label className="lobby-field">
            <span>Host IP (WebSocket)</span>
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
                  {busy ? 'Creating…' : 'Create LAN room'}
                </button>
              ) : (
                <div className="lobby-room">
                  <p className="lobby-room-label">Room code</p>
                  <p className="lobby-room-code">{roomCode}</p>
                  <p className="lobby-room-hint">
                    Opponent opens <strong>http://{hostIp || 'host-ip'}:5173</strong> → Join room → enter code
                  </p>
                  {!waitingPeer && (
                    <button type="button" className="btn btn-primary" onClick={continueHost}>
                      Continue — align face
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <label className="lobby-field">
                <span>Room code</span>
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={4}
                  placeholder="ABCD"
                  spellCheck={false}
                />
              </label>
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void startJoin()}>
                {busy ? 'Joining…' : 'Join room'}
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
