import { randomBytes, randomInt } from 'node:crypto'
import { networkInterfaces } from 'node:os'
import type { WebSocket } from 'ws'
import { chooseAction } from '../../src/engine/ai'
import { MAX_PLAYERS, MIN_PLAYERS } from '../../src/engine/cards'
import { applyAction, createGame, everyoneDoneTrading, viewFor } from '../../src/engine/engine'
import type { Action, GameState } from '../../src/engine/types'
import type { ClientMessage, RoomInfo, ServerMessage } from '../../src/network/protocol'

interface Member {
  id: string
  token: string
  name: string
  isAI: boolean
  socket: WebSocket | null
  /** The browser tab that holds this seat. */
  tabId: string
}

interface Room {
  id: string
  hostId: string
  members: Member[]
  game: GameState | null
  aiTimer: ReturnType<typeof setTimeout> | null
  /** When the current market of an AI closes at the latest, for the turn it belongs to. */
  marketClose: { turn: number; at: number } | null
  lastActivity: number
}

export interface Connection {
  roomId: string | null
  memberId: string | null
}

export interface RoomOptions {
  /** Pause before an AI move, so people can follow what happens. */
  aiDelayMs: number
  /** The longest an AI keeps its market open while people are still trading. */
  aiMarketMs: number
  idleTimeoutMs: number
  maxRooms: number
}

const DEFAULTS: RoomOptions = { aiDelayMs: 900, aiMarketMs: 90_000, idleTimeoutMs: 2 * 60 * 60 * 1000, maxRooms: 200 }
const AI_NAMES = ['Zahra', 'Idris', 'Mirela', 'Tavin', 'Soraya', 'Kasim', 'Ines', 'Davud']
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

function send(socket: WebSocket | null, msg: ServerMessage): void {
  if (socket && socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg))
}

function lanHost(): string | null {
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) if (net.family === 'IPv4' && !net.internal) return net.address
  }
  return null
}

function cleanTabId(raw: unknown): string {
  return typeof raw === 'string' ? raw.slice(0, 40) : ''
}

function cleanName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, 20) : ''
  return name || 'Merchant'
}

export class RoomManager {
  private rooms = new Map<string, Room>()
  private options: RoomOptions
  private sweeper: ReturnType<typeof setInterval>

  constructor(options: Partial<RoomOptions> = {}) {
    this.options = { ...DEFAULTS, ...options }
    this.sweeper = setInterval(() => this.sweep(), 60_000)
    this.sweeper.unref()
  }

  close(): void {
    clearInterval(this.sweeper)
    for (const room of this.rooms.values()) if (room.aiTimer) clearTimeout(room.aiTimer)
    this.rooms.clear()
  }

  get roomCount(): number {
    return this.rooms.size
  }

  private sweep(): void {
    const now = Date.now()
    for (const room of this.rooms.values()) {
      const empty = room.members.every(m => !m.socket)
      if (empty && now - room.lastActivity > this.options.idleTimeoutMs) this.deleteRoom(room)
    }
  }

  private deleteRoom(room: Room): void {
    if (room.aiTimer) clearTimeout(room.aiTimer)
    this.rooms.delete(room.id)
  }

  private newRoomId(): string {
    for (;;) {
      let id = ''
      for (let i = 0; i < 5; i++) id += ROOM_ALPHABET[randomInt(ROOM_ALPHABET.length)]
      if (!this.rooms.has(id)) return id
    }
  }

  private roomInfo(room: Room): RoomInfo {
    return {
      id: room.id,
      hostId: room.hostId,
      started: !!room.game,
      seats: room.members.map(m => ({ id: m.id, name: m.name, isAI: m.isAI, connected: m.isAI || !!m.socket })),
    }
  }

  private broadcast(room: Room): void {
    const info = this.roomInfo(room)
    room.members.forEach((m, i) => {
      if (!m.socket) return
      send(m.socket, { type: 'room', room: info })
      send(m.socket, { type: 'game', view: room.game ? viewFor(room.game, i) : null })
    })
  }

  private uniqueName(room: Room, name: string): string {
    const taken = new Set(room.members.map(m => m.name))
    if (!taken.has(name)) return name
    for (let i = 2; ; i++) if (!taken.has(`${name} ${i}`)) return `${name} ${i}`
  }

  private addMember(room: Room, name: string, isAI: boolean, socket: WebSocket | null): Member {
    const member: Member = {
      id: randomBytes(6).toString('hex'),
      token: randomBytes(16).toString('hex'),
      name: this.uniqueName(room, name),
      isAI,
      socket,
      tabId: '',
    }
    room.members.push(member)
    return member
  }

  private attach(room: Room, member: Member, socket: WebSocket, conn: Connection, tabId: unknown): void {
    member.tabId = cleanTabId(tabId)
    if (member.socket && member.socket !== socket) {
      // The same seat opened elsewhere: the newer connection wins.
      send(member.socket, { type: 'left' })
      member.socket.close()
    }
    member.socket = socket
    conn.roomId = room.id
    conn.memberId = member.id
    send(socket, { type: 'joined', roomId: room.id, token: member.token, seatId: member.id, lanHost: lanHost() })
  }

  handle(socket: WebSocket, conn: Connection, msg: ClientMessage): void {
    const fail = (code: string) => send(socket, { type: 'error', code })
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return fail('MALFORMED_MESSAGE')

    if (msg.type === 'create' || msg.type === 'join' || msg.type === 'rejoin') {
      if (conn.roomId) this.detach(socket, conn, true)
    }

    switch (msg.type) {
      case 'create': {
        if (this.rooms.size >= this.options.maxRooms) return fail('SERVER_FULL')
        const room: Room = { id: this.newRoomId(), hostId: '', members: [], game: null, aiTimer: null, marketClose: null, lastActivity: Date.now() }
        this.rooms.set(room.id, room)
        const member = this.addMember(room, cleanName(msg.name), false, null)
        room.hostId = member.id
        this.attach(room, member, socket, conn, msg.tabId)
        this.broadcast(room)
        return
      }
      case 'join': {
        const room = this.rooms.get(String(msg.roomId ?? '').toUpperCase().trim())
        if (!room) return fail('NO_SUCH_ROOM')
        if (room.game) return fail('GAME_STARTED')
        if (room.members.length >= MAX_PLAYERS) return fail('ROOM_FULL')
        const member = this.addMember(room, cleanName(msg.name), false, null)
        this.attach(room, member, socket, conn, msg.tabId)
        room.lastActivity = Date.now()
        this.broadcast(room)
        return
      }
      case 'rejoin': {
        const room = this.rooms.get(String(msg.roomId ?? ''))
        if (!room) return fail('NO_SUCH_ROOM')
        const member = room.members.find(m => !m.isAI && m.token === msg.token)
        if (!member) return fail('BAD_TOKEN')
        // Another tab of the same browser knows the token too; it must not push the player out.
        if (member.socket && member.socket !== socket && member.tabId !== cleanTabId(msg.tabId)) return fail('SEAT_IN_USE')
        this.attach(room, member, socket, conn, msg.tabId)
        room.lastActivity = Date.now()
        this.broadcast(room)
        return
      }
    }

    const room = conn.roomId ? this.rooms.get(conn.roomId) : undefined
    const me = room?.members.find(m => m.id === conn.memberId)
    if (!room || !me || me.socket !== socket) return fail('NOT_IN_ROOM')
    room.lastActivity = Date.now()
    const isHost = room.hostId === me.id

    switch (msg.type) {
      case 'addAI': {
        if (!isHost) return fail('HOST_ONLY')
        if (room.game) return fail('GAME_STARTED')
        if (room.members.length >= MAX_PLAYERS) return fail('ROOM_FULL')
        const free = AI_NAMES.filter(n => !room.members.some(m => m.name === n))
        this.addMember(room, free[randomInt(free.length)], true, null)
        return this.broadcast(room)
      }
      case 'removeSeat': {
        if (!isHost) return fail('HOST_ONLY')
        if (room.game) return fail('GAME_STARTED')
        const target = room.members.find(m => m.id === msg.seatId)
        if (!target || target.id === me.id) return fail('NO_SUCH_SEAT')
        room.members = room.members.filter(m => m !== target)
        if (target.socket) send(target.socket, { type: 'left' })
        return this.broadcast(room)
      }
      case 'start':
      case 'restart': {
        if (!isHost) return fail('HOST_ONLY')
        if (msg.type === 'start' ? !!room.game : room.game?.phase !== 'ended') return fail('NOT_NOW')
        if (room.members.length < MIN_PLAYERS) return fail('NEED_MORE_PLAYERS')
        // Random seating; seat 0 starts.
        for (let i = room.members.length - 1; i > 0; i--) {
          const j = randomInt(i + 1)
          ;[room.members[i], room.members[j]] = [room.members[j], room.members[i]]
        }
        room.game = createGame(room.members.map(m => ({ name: m.name, isAI: m.isAI })), randomInt(2 ** 31))
        room.marketClose = null
        this.broadcast(room)
        return this.scheduleAI(room)
      }
      case 'replaceWithAI': {
        if (!isHost) return fail('HOST_ONLY')
        const index = room.members.findIndex(m => m.id === msg.seatId)
        const target = room.members[index]
        if (!room.game || !target || target.isAI || target.id === me.id) return fail('NO_SUCH_SEAT')
        if (target.socket) return fail('STILL_CONNECTED')
        target.isAI = true
        target.token = ''
        room.game.players[index].isAI = true
        this.broadcast(room)
        return this.scheduleAI(room)
      }
      case 'action': {
        if (!room.game) return fail('NOT_NOW')
        const result = applyAction(room.game, room.members.indexOf(me), msg.action)
        if (!result.ok) return fail(result.error)
        room.game = result.state
        this.broadcast(room)
        return this.scheduleAI(room)
      }
      case 'leave':
        return this.detach(socket, conn, true)
      default:
        return fail('MALFORMED_MESSAGE')
    }
  }

  /** A socket went away. `explicit`: the player chose to leave (rather than losing the connection). */
  detach(socket: WebSocket, conn: Connection, explicit = false): void {
    const room = conn.roomId ? this.rooms.get(conn.roomId) : undefined
    conn.roomId = null
    conn.memberId = null
    if (!room) return
    const member = room.members.find(m => m.socket === socket)
    if (!member) return
    member.socket = null
    if (explicit) send(socket, { type: 'left' })
    if (explicit && !room.game) {
      // Leaving the lobby frees the seat; the host role moves on.
      room.members = room.members.filter(m => m !== member)
      const nextHost = room.members.find(m => !m.isAI)
      if (!nextHost) return this.deleteRoom(room)
      if (room.hostId === member.id) room.hostId = nextHost.id
    } else if (room.hostId === member.id) {
      // Keep the table manageable while the host is away.
      const nextHost = room.members.find(m => !m.isAI && m.socket)
      if (nextHost) room.hostId = nextHost.id
    }
    this.broadcast(room)
  }

  // ------------------------------------------------------------- AI driver

  private nextAIMove(room: Room): { index: number; action: Action; delay: number } | null {
    const game = room.game
    if (!game || game.phase === 'ended') return null
    const n = game.players.length
    let closing: { index: number; action: Action } | null = null
    for (let k = 0; k < n; k++) {
      const index = (game.active + k) % n
      if (!game.players[index].isAI) continue
      const action = chooseAction(game, index)
      if (!action) continue
      if (action.type !== 'closeMarket') return { index, action, delay: this.options.aiDelayMs }
      closing = { index, action }
    }
    if (!closing) return null
    // The AI keeps its market open until every person at the table is done trading, or until time runs out.
    if (everyoneDoneTrading(game)) return { ...closing, delay: this.options.aiDelayMs }
    if (room.marketClose?.turn !== game.turn) room.marketClose = { turn: game.turn, at: Date.now() + this.options.aiMarketMs }
    return { ...closing, delay: Math.max(this.options.aiDelayMs, room.marketClose.at - Date.now()) }
  }

  private scheduleAI(room: Room): void {
    if (room.aiTimer) clearTimeout(room.aiTimer)
    room.aiTimer = null
    const move = this.nextAIMove(room)
    if (!move) return
    room.aiTimer = setTimeout(() => {
      room.aiTimer = null
      if (!room.game || !this.rooms.has(room.id)) return
      const result = applyAction(room.game, move.index, move.action)
      if (result.ok) {
        room.game = result.state
        this.broadcast(room)
        this.scheduleAI(room)
      } else {
        console.error(`AI move ${move.action.type} rejected: ${result.error}`)
      }
    }, move.delay)
  }
}
