export type Slot = 'p1' | 'p2'

export type ClientMessage =
  | { type: 'create' }
  | { type: 'join'; roomId: string }
  | { type: 'face'; dataUrl: string }
  | { type: 'ready' }
  | { type: 'punch'; side: -1 | 1 }
  | { type: 'block'; active: boolean }
  | { type: 'rematch' }

export type ServerMessage =
  | { type: 'created'; roomId: string; slot: Slot }
  | { type: 'joined'; roomId: string; slot: Slot }
  | { type: 'error'; message: string }
  | { type: 'peer_joined'; slot: Slot }
  | { type: 'peer_left' }
  | { type: 'peer_face'; dataUrl: string }
  | { type: 'fight_start' }
  | { type: 'peer_punch'; side: -1 | 1 }
  | { type: 'peer_block'; active: boolean }
  | { type: 'peer_rematch' }

export const GAME_WS_PORT = 8787

export function gameWsUrl(host = window.location.hostname) {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${host}:${GAME_WS_PORT}`
}
