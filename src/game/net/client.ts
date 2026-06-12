import { gameWsUrl, type ClientMessage, type ServerMessage, type Slot } from './protocol'

export type GameNetHandlers = {
  onOpen?: () => void
  onClose?: () => void
  onError?: (message: string) => void
  onCreated?: (roomId: string, slot: Slot) => void
  onJoined?: (roomId: string, slot: Slot) => void
  onPeerJoined?: (slot: Slot) => void
  onPeerLeft?: () => void
  onPeerFace?: (dataUrl: string) => void
  onFightStart?: () => void
  onPeerPunch?: (side: -1 | 1) => void
  onPeerBlock?: (active: boolean) => void
  onPeerHitResult?: (payload: {
    blocked: boolean
    playerHp: number
    side: -1 | 1
  }) => void
  onPeerRematch?: () => void
}

export class GameNetClient {
  private ws: WebSocket | null = null
  private handlers: GameNetHandlers = {}

  connect(host?: string): Promise<void> {
    this.close()
    const url = gameWsUrl(host)
    const ws = new WebSocket(url)
    this.ws = ws

    return new Promise((resolve, reject) => {
      ws.onopen = () => {
        this.handlers.onOpen?.()
        resolve()
      }
      ws.onerror = () => {
        this.handlers.onError?.('WebSocket connection failed')
        reject(new Error('WebSocket connection failed'))
      }
      ws.onclose = () => {
        this.ws = null
        this.handlers.onClose?.()
      }
      ws.onmessage = (ev) => {
        let msg: ServerMessage
        try {
          msg = JSON.parse(String(ev.data)) as ServerMessage
        } catch {
          this.handlers.onError?.('Invalid server message')
          return
        }
        this.dispatch(msg)
      }
    })
  }

  setHandlers(handlers: GameNetHandlers) {
    this.handlers = handlers
  }

  private dispatch(msg: ServerMessage) {
    switch (msg.type) {
      case 'created':
        this.handlers.onCreated?.(msg.roomId, msg.slot)
        break
      case 'joined':
        this.handlers.onJoined?.(msg.roomId, msg.slot)
        break
      case 'error':
        this.handlers.onError?.(msg.message)
        break
      case 'peer_joined':
        this.handlers.onPeerJoined?.(msg.slot)
        break
      case 'peer_left':
        this.handlers.onPeerLeft?.()
        break
      case 'peer_face':
        this.handlers.onPeerFace?.(msg.dataUrl)
        break
      case 'fight_start':
        this.handlers.onFightStart?.()
        break
      case 'peer_punch':
        this.handlers.onPeerPunch?.(msg.side)
        break
      case 'peer_block':
        this.handlers.onPeerBlock?.(msg.active)
        break
      case 'peer_hit_result':
        this.handlers.onPeerHitResult?.({
          blocked: msg.blocked,
          playerHp: msg.playerHp,
          side: msg.side,
        })
        break
      case 'peer_rematch':
        this.handlers.onPeerRematch?.()
        break
    }
  }

  private send(msg: ClientMessage) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(JSON.stringify(msg))
  }

  createRoom() {
    this.send({ type: 'create' })
  }

  joinRoom(roomId: string) {
    this.send({ type: 'join', roomId: roomId.trim().toUpperCase() })
  }

  sendFace(dataUrl: string) {
    this.send({ type: 'face', dataUrl })
  }

  sendReady() {
    this.send({ type: 'ready' })
  }

  sendPunch(side: -1 | 1) {
    this.send({ type: 'punch', side })
  }

  sendBlock(active: boolean) {
    this.send({ type: 'block', active })
  }

  sendHitResult(payload: {
    blocked: boolean
    playerHp: number
    side: -1 | 1
  }) {
    this.send({ type: 'hit_result', ...payload })
  }

  sendRematch() {
    this.send({ type: 'rematch' })
  }

  close() {
    if (this.ws) {
      this.ws.onclose = null
      this.ws.close()
      this.ws = null
    }
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN
  }
}
