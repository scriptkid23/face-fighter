import { WebSocketServer } from 'ws'

const PORT = Number(process.env.GAME_WS_PORT || 8787)

/** @typedef {'p1' | 'p2'} Slot */

/** @typedef {{ ws: import('ws').WebSocket, slot: Slot, face?: string, ready: boolean }} Player */

/** @typedef {{ id: string, p1?: Player, p2?: Player }} Room */

/** @type {Map<string, Room>} */
const rooms = new Map()

/** @type {WeakMap<import('ws').WebSocket, { roomId: string, slot: Slot }>} */
const socketMeta = new WeakMap()

function randomRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let id = ''
  for (let i = 0; i < 4; i++) {
    id += chars[(Math.random() * chars.length) | 0]
  }
  return id
}

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg))
}

function peerOf(room, slot) {
  return slot === 'p1' ? room.p2 : room.p1
}

function broadcastPeer(room, fromSlot, msg) {
  const peer = peerOf(room, fromSlot)
  if (peer) send(peer.ws, msg)
}

function maybeStartFight(room) {
  if (!room.p1?.ready || !room.p2?.ready) return
  if (!room.p1.face || !room.p2.face) return
  // Re-send both faces first: a client that joined the room UI late may have
  // missed the live peer_face relay. Same-socket ordering guarantees these
  // arrive before fight_start.
  send(room.p1.ws, { type: 'peer_face', dataUrl: room.p2.face })
  send(room.p2.ws, { type: 'peer_face', dataUrl: room.p1.face })
  send(room.p1.ws, { type: 'fight_start' })
  send(room.p2.ws, { type: 'fight_start' })
}

function removePlayer(ws) {
  const meta = socketMeta.get(ws)
  if (!meta) return
  socketMeta.delete(ws)

  const room = rooms.get(meta.roomId)
  if (!room) return

  if (meta.slot === 'p1') room.p1 = undefined
  else room.p2 = undefined

  const other = peerOf(room, meta.slot)
  if (other) {
    send(other.ws, { type: 'peer_left' })
    other.ready = false
  }

  if (!room.p1 && !room.p2) rooms.delete(meta.roomId)
}

const wss = new WebSocketServer({ host: '0.0.0.0', port: PORT })

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg
    try {
      msg = JSON.parse(String(raw))
    } catch {
      send(ws, { type: 'error', message: 'Invalid message' })
      return
    }

    const meta = socketMeta.get(ws)

    if (msg.type === 'create') {
      if (meta) {
        send(ws, { type: 'error', message: 'Already in a room' })
        return
      }
      let roomId = randomRoomId()
      while (rooms.has(roomId)) roomId = randomRoomId()
      const room = { id: roomId }
      /** @type {Player} */
      const player = { ws, slot: 'p1', ready: false }
      room.p1 = player
      rooms.set(roomId, room)
      socketMeta.set(ws, { roomId, slot: 'p1' })
      send(ws, { type: 'created', roomId, slot: 'p1' })
      return
    }

    if (msg.type === 'join') {
      if (meta) {
        send(ws, { type: 'error', message: 'Already in a room' })
        return
      }
      const roomId = String(msg.roomId || '')
        .trim()
        .toUpperCase()
      const room = rooms.get(roomId)
      if (!room) {
        send(ws, { type: 'error', message: 'Room not found' })
        return
      }
      if (room.p2) {
        send(ws, { type: 'error', message: 'Room is full' })
        return
      }
      /** @type {Player} */
      const player = { ws, slot: 'p2', ready: false }
      room.p2 = player
      socketMeta.set(ws, { roomId, slot: 'p2' })
      send(ws, { type: 'joined', roomId, slot: 'p2' })
      if (room.p1) send(room.p1.ws, { type: 'peer_joined', slot: 'p2' })
      return
    }

    if (!meta) {
      send(ws, { type: 'error', message: 'Join a room first' })
      return
    }

    const room = rooms.get(meta.roomId)
    if (!room) {
      send(ws, { type: 'error', message: 'Room expired' })
      return
    }

    const self = meta.slot === 'p1' ? room.p1 : room.p2
    if (!self) return

    switch (msg.type) {
      case 'face': {
        if (typeof msg.dataUrl !== 'string' || !msg.dataUrl.startsWith('data:image/')) {
          send(ws, { type: 'error', message: 'Invalid face data' })
          return
        }
        self.face = msg.dataUrl
        broadcastPeer(room, meta.slot, { type: 'peer_face', dataUrl: msg.dataUrl })
        break
      }
      case 'ready': {
        self.ready = true
        maybeStartFight(room)
        break
      }
      case 'punch': {
        const side = msg.side === 1 ? 1 : -1
        broadcastPeer(room, meta.slot, { type: 'peer_punch', side })
        break
      }
      case 'block': {
        broadcastPeer(room, meta.slot, { type: 'peer_block', active: !!msg.active })
        break
      }
      case 'hit_result': {
        const side = msg.side === 1 ? 1 : -1
        const playerHp = Number(msg.playerHp)
        if (!Number.isFinite(playerHp)) break
        broadcastPeer(room, meta.slot, {
          type: 'peer_hit_result',
          blocked: !!msg.blocked,
          playerHp: Math.max(0, Math.min(100, playerHp)),
          side,
        })
        break
      }
      case 'rematch': {
        if (room.p1) room.p1.ready = true
        if (room.p2) room.p2.ready = true
        broadcastPeer(room, meta.slot, { type: 'peer_rematch' })
        break
      }
      default:
        send(ws, { type: 'error', message: 'Unknown message' })
    }
  })

  ws.on('close', () => removePlayer(ws))
})

console.log(`Face Fighter LAN server ws://0.0.0.0:${PORT}`)
