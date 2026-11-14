import type { Action, GameView } from '../engine/types'

export interface SeatInfo {
  id: string
  name: string
  isAI: boolean
  connected: boolean
}

export interface RoomInfo {
  id: string
  hostId: string
  started: boolean
  /** In game order once the game has started. */
  seats: SeatInfo[]
}

export type ClientMessage =
  // tabId identifies one browser tab, so a second tab of the same browser cannot take over a live seat.
  | { type: 'create'; name: string; tabId?: string }
  | { type: 'join'; roomId: string; name: string; tabId?: string }
  | { type: 'rejoin'; roomId: string; token: string; tabId?: string }
  | { type: 'addAI' }
  | { type: 'removeSeat'; seatId: string }
  | { type: 'start' }
  | { type: 'restart' }
  | { type: 'replaceWithAI'; seatId: string }
  | { type: 'action'; action: Action }
  | { type: 'leave' }

export type ServerMessage =
  /** lanHost: an address of the server on the local network, for invite links made on the server's own machine. */
  | { type: 'joined'; roomId: string; token: string; seatId: string; lanHost: string | null }
  | { type: 'room'; room: RoomInfo }
  | { type: 'game'; view: GameView | null }
  | { type: 'left' }
  | { type: 'error'; code: string }
