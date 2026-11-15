import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import type { GameView } from '../../src/engine/types'
import type { ClientMessage, RoomInfo, ServerMessage } from '../../src/network/protocol'
import { createGameServer, type GameServer } from '../src/server'

class Client {
  socket: WebSocket
  room: RoomInfo | null = null
  view: GameView | null = null
  token = ''
  seatId = ''
  errors: string[] = []
  left = false
  private waiters: (() => void)[] = []

  constructor(url: string) {
    this.socket = new WebSocket(url)
    this.socket.on('message', raw => {
      const msg = JSON.parse(raw.toString()) as ServerMessage
      if (msg.type === 'joined') {
        this.token = msg.token
        this.seatId = msg.seatId
      } else if (msg.type === 'room') this.room = msg.room
      else if (msg.type === 'game') this.view = msg.view
      else if (msg.type === 'error') this.errors.push(msg.code)
      else if (msg.type === 'left') this.left = true
      this.waiters.splice(0).forEach(w => w())
    })
  }

  open(): Promise<void> {
    return new Promise(resolve => this.socket.once('open', () => resolve()))
  }

  send(msg: ClientMessage): void {
    this.socket.send(JSON.stringify(msg))
  }

  async until(cond: () => boolean, what = 'condition'): Promise<void> {
    const deadline = Date.now() + 5000
    while (!cond()) {
      if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`)
      await new Promise<void>(resolve => {
        const t = setTimeout(resolve, 100)
        this.waiters.push(() => {
          clearTimeout(t)
          resolve()
        })
      })
    }
  }
}

describe('game server', () => {
  let server: GameServer
  let url: string
  const clients: Client[] = []

  async function connect(): Promise<Client> {
    const c = new Client(url)
    clients.push(c)
    await c.open()
    return c
  }

  beforeEach(async () => {
    server = createGameServer({ aiDelayMs: 1, aiMarketMs: 1 }, '/nonexistent')
    await new Promise<void>(resolve => server.http.listen(0, resolve))
    url = `ws://localhost:${(server.http.address() as AddressInfo).port}/ws`
  })

  afterEach(async () => {
    clients.splice(0).forEach(c => c.socket.terminate())
    await server.close()
  })

  it('runs a lobby: create, join, AI seats, host-only controls', async () => {
    const host = await connect()
    host.send({ type: 'create', name: '  Ada  ' })
    await host.until(() => !!host.room, 'room')
    expect(host.room!.seats.map(s => s.name)).toEqual(['Ada'])

    const guest = await connect()
    guest.send({ type: 'join', roomId: host.room!.id.toLowerCase(), name: 'Ada' })
    await guest.until(() => guest.room?.seats.length === 2, 'guest joined')
    expect(guest.room!.seats[1].name).toBe('Ada 2')

    guest.send({ type: 'addAI' })
    await guest.until(() => guest.errors.includes('HOST_ONLY'), 'host-only error')
    host.send({ type: 'start' })
    await host.until(() => host.errors.includes('NEED_MORE_PLAYERS'), 'too few players')

    host.send({ type: 'addAI' })
    await host.until(() => host.room?.seats.length === 3, 'AI seat')
    expect(host.room!.seats[2]).toMatchObject({ isAI: true, connected: true })

    const stranger = await connect()
    stranger.send({ type: 'join', roomId: 'ZZZZZ', name: 'x' })
    await stranger.until(() => stranger.errors.includes('NO_SUCH_ROOM'), 'unknown room')
  })

  it('plays a human against AIs, hides hidden information and survives a reconnect', async () => {
    const host = await connect()
    host.send({ type: 'create', name: 'Ada' })
    await host.until(() => !!host.room, 'room')
    host.send({ type: 'addAI' })
    host.send({ type: 'addAI' })
    await host.until(() => host.room?.seats.length === 3, 'seats')
    host.send({ type: 'start' })
    await host.until(() => !!host.view, 'game view')

    const me = host.view!.you
    expect(host.room!.seats[me].id).toBe(host.seatId)
    expect(host.view!.players[me].caravan).toHaveLength(5)
    expect(host.view!.players.filter(p => p.caravan).length).toBe(1)

    // The AIs play on their own until it is the human's move.
    await host.until(() => host.view!.active === me && host.view!.phase === 'stock', 'my turn')
    host.send({ type: 'action', action: { type: 'endStock' } })
    await host.until(() => host.errors.includes('MUST_STOCK_FIRST'), 'rule error')

    // Drop the connection and come back with the token.
    const roomId = host.room!.id
    host.socket.terminate()
    const back = await connect()
    back.send({ type: 'rejoin', roomId, token: host.token, tabId: 'tab-1' })
    await back.until(() => !!back.view, 'view after rejoin')
    expect(back.view!.you).toBe(me)
    expect(back.view!.players[me].caravan).toHaveLength(5)

    // A second tab of the same browser knows the token, but must not take a seat that is in use.
    const otherTab = await connect()
    otherTab.send({ type: 'rejoin', roomId, token: host.token, tabId: 'tab-2' })
    await otherTab.until(() => otherTab.errors.includes('SEAT_IN_USE'), 'seat in use')
    expect(back.left).toBe(false)

    const thief = await connect()
    thief.send({ type: 'rejoin', roomId, token: 'nope' })
    await thief.until(() => thief.errors.includes('BAD_TOKEN'), 'bad token')
    thief.send({ type: 'join', roomId, name: 'late' })
    await thief.until(() => thief.errors.includes('GAME_STARTED'), 'late join refused')
  })

  it('closes an AI market once every person is done trading, without waiting for the time limit', async () => {
    await server.close()
    server = createGameServer({ aiDelayMs: 1, aiMarketMs: 60_000 }, '/nonexistent')
    await new Promise<void>(resolve => server.http.listen(0, resolve))
    url = `ws://localhost:${(server.http.address() as AddressInfo).port}/ws`

    const host = await connect()
    host.send({ type: 'create', name: 'Ada' })
    await host.until(() => !!host.room, 'room')
    host.send({ type: 'addAI' })
    host.send({ type: 'addAI' })
    await host.until(() => host.room?.seats.length === 3, 'seats')
    host.send({ type: 'start' })
    await host.until(() => !!host.view, 'game')

    // Play my own seat until an AI has its market open.
    const { chooseAction } = await import('../../src/engine/ai')
    const aiMarket = () => host.view!.phase === 'market' && host.view!.active !== host.view!.you
    const deadline = Date.now() + 10_000
    let seen: GameView | null = null
    while (!aiMarket()) {
      if (Date.now() > deadline) throw new Error('no AI market opened')
      const v = host.view!
      if (v !== seen) {
        seen = v
        const state = { ...v, players: v.players.map(p => ({ ...p, caravan: p.caravan ?? [] })), deck: [], discard: [], posted: [], nextOfferId: 0, logSeq: 0, rng: 0 }
        let action = chooseAction(state as never, v.you)
        if (action?.type === 'propose') action = v.active === v.you ? { type: 'closeMarket' } : null
        if (action) host.send({ type: 'action', action })
      }
      await new Promise(r => setTimeout(r, 2))
    }

    // The market stays open while I am still trading...
    const turn = host.view!.turn
    await new Promise(r => setTimeout(r, 300))
    expect(host.view!.turn === turn && host.view!.phase === 'market').toBe(true)
    // ...and closes right after I say I am done, long before the 60 s limit.
    host.send({ type: 'action', action: { type: 'doneTrading', done: true } })
    await host.until(() => host.view!.turn !== turn || host.view!.phase !== 'market', 'market closed')
  })

  it('lets the host hand a dropped seat to an AI, and the game then runs to its end', async () => {
    const host = await connect()
    host.send({ type: 'create', name: 'Ada' })
    await host.until(() => !!host.room, 'room')
    const guest = await connect()
    guest.send({ type: 'join', roomId: host.room!.id, name: 'Bo' })
    await guest.until(() => !!guest.room, 'guest in room')
    host.send({ type: 'addAI' })
    await host.until(() => host.room?.seats.length === 3, 'seats')
    host.send({ type: 'start' })
    await host.until(() => !!host.view, 'game')

    host.send({ type: 'replaceWithAI', seatId: guest.seatId })
    await host.until(() => host.errors.includes('STILL_CONNECTED'), 'still connected')
    guest.socket.terminate()
    await host.until(() => host.room!.seats.find(s => s.id === guest.seatId)!.connected === false, 'guest gone')
    host.send({ type: 'replaceWithAI', seatId: guest.seatId })
    await host.until(() => host.room!.seats.find(s => s.id === guest.seatId)!.isAI, 'guest replaced')

    // Play the host's own seat with the same logic as the AI, straight through to the end.
    const { chooseAction } = await import('../../src/engine/ai')
    const deadline = Date.now() + 20_000
    let seen: GameView | null = null
    while (host.view!.phase !== 'ended') {
      if (Date.now() > deadline) throw new Error('game did not finish')
      const v = host.view!
      if (v !== seen) {
        seen = v
        // The view lacks other caravans; the AI only reads its own seat's hidden cards.
        const state = { ...v, players: v.players.map(p => ({ ...p, caravan: p.caravan ?? [] })), deck: [], discard: [], posted: [], nextOfferId: 0, logSeq: 0, rng: 0 }
        let action = chooseAction(state as never, v.you)
        // No memory of earlier offers here, so skip proposing altogether.
        if (action?.type === 'propose') action = v.active === v.you ? { type: 'closeMarket' } : null
        if (action) host.send({ type: 'action', action })
      }
      await new Promise(r => setTimeout(r, 2))
    }
    expect(host.view!.winners!.length).toBeGreaterThan(0)
    expect(host.view!.players.every(p => p.caravan)).toBe(true)

    host.send({ type: 'restart' })
    await host.until(() => host.view?.phase === 'stock' && host.view.turn === 1, 'new game')
  }, 30_000)
})
