import { describe, expect, it } from 'vitest'
import { buildDeck, saleGold, SPICES, SPICE_INFO, type Spice } from './cards'
import { chooseAction } from './ai'
import { applyAction, canSell, createGame, viewFor } from './engine'
import type { Action, GameState } from './types'

const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isAI: true }))

function act(state: GameState, pi: number, action: Action): GameState {
  const r = applyAction(state, pi, action)
  if (!r.ok) throw new Error(`${action.type} by ${pi} failed: ${r.error}`)
  return r.state
}

function fail(state: GameState, pi: number, action: Action): string {
  const r = applyAction(state, pi, action)
  if (r.ok) throw new Error(`${action.type} unexpectedly succeeded`)
  return r.error
}

function totalCards(s: GameState): number {
  return s.deck.length + s.discard.length + s.market.length + s.players.reduce(
    (n, p) => n + p.caravan.length + p.pending.length + p.stalls.reduce((m, st) => m + st.count, 0), 0)
}

/** A game with hand-picked caravans, for deterministic rule tests. */
function rigged(caravans: Spice[][]): GameState {
  const s = createGame(seats(caravans.length), 1)
  s.players.forEach((p, i) => {
    s.deck.push(...p.caravan)
    p.caravan = []
    for (const c of caravans[i]) {
      s.deck.splice(s.deck.indexOf(c), 1)
      p.caravan.push(c)
    }
  })
  return s
}

describe('cards', () => {
  it('has 110 cards and ascending sale tables', () => {
    expect(buildDeck()).toHaveLength(110)
    for (const s of SPICES) {
      const sales = SPICE_INFO[s].sales
      for (let i = 1; i < sales.length; i++) {
        expect(sales[i][0]).toBeGreaterThan(sales[i - 1][0])
        expect(sales[i][1]).toBeGreaterThan(sales[i - 1][1])
      }
      expect(sales[sales.length - 1][0]).toBeLessThanOrEqual(SPICE_INFO[s].count)
    }
  })
  it('pays by the table', () => {
    expect(saleGold('pepper', 3)).toBe(0)
    expect(saleGold('pepper', 7)).toBe(2)
    expect(saleGold('saffron', 2)).toBe(2)
    expect(saleGold('saffron', 4)).toBe(4)
  })
})

describe('turn flow', () => {
  it('deals five cards each and hides other caravans', () => {
    const s = createGame(seats(4), 7)
    expect(s.players.every(p => p.caravan.length === 5)).toBe(true)
    expect(totalCards(s)).toBe(110)
    const v = viewFor(s, 1)
    expect(v.players[1].caravan).toEqual(s.players[1].caravan)
    expect(v.players[0].caravan).toBeUndefined()
    expect(v.players[0].caravanCount).toBe(5)
    expect(JSON.stringify(v)).not.toContain('"deck"')
  })

  it('forces the front card to be stocked, allows a second, not a third', () => {
    let s = rigged([['pepper', 'pepper', 'cumin', 'clove', 'clove'], ['ginger'], ['ginger']])
    expect(fail(s, 0, { type: 'endStock' })).toBe('MUST_STOCK_FIRST')
    expect(fail(s, 1, { type: 'stock', stall: 0 })).toBe('NOT_NOW')
    s = act(s, 0, { type: 'stock', stall: 0 })
    s = act(s, 0, { type: 'stock', stall: 0 })
    expect(s.players[0].stalls[0]).toEqual({ spice: 'pepper', count: 2 })
    expect(fail(s, 0, { type: 'stock', stall: 1 })).toBe('ALREADY_STOCKED_TWO')
    s = act(s, 0, { type: 'endStock' })
    expect(s.phase).toBe('market')
    expect(s.market).toHaveLength(2)
  })

  it('refuses a card on a stall of another spice', () => {
    let s = rigged([['pepper', 'cumin', 'clove'], ['ginger'], ['ginger']])
    s = act(s, 0, { type: 'stock', stall: 0 })
    expect(fail(s, 0, { type: 'stock', stall: 0 })).toBe('STALL_OCCUPIED')
  })

  it('hands unsold market cards to the active player, then resupplies and passes the turn', () => {
    let s = rigged([['pepper', 'cumin'], ['ginger'], ['ginger']])
    s = act(s, 0, { type: 'stock', stall: 0 })
    s = act(s, 0, { type: 'endStock' })
    const market = s.market.slice()
    s = act(s, 0, { type: 'closeMarket' })
    expect(s.phase).toBe('deliver')
    expect(s.players[0].pending).toEqual(market)
    // Sell whatever is in the way, then stock both.
    while (s.phase === 'deliver') s = act(s, 0, chooseAction(s, 0)!)
    expect(s.active).toBe(1)
    expect(s.phase).toBe('stock')
    expect(s.players[0].caravan).toHaveLength(1 + 3)
    expect(totalCards(s)).toBe(110)
  })
})

describe('selling', () => {
  it('protects a single-card stall while another stall holds more', () => {
    const s = createGame(seats(3), 3)
    const p = s.players[0]
    p.stalls = [{ spice: 'pepper', count: 1 }, { spice: 'cumin', count: 3 }]
    expect(canSell(p, 0)).toBe(false)
    expect(canSell(p, 1)).toBe(true)
    p.stalls[1].count = 1
    expect(canSell(p, 0)).toBe(true)
  })

  it('pays the Royal Order bonus only on a paying sale', () => {
    let s = createGame(seats(3), 3)
    s.royalOrder = 'cumin'
    s.players[1].stalls = [{ spice: 'cumin', count: 3 }, { spice: 'cumin', count: 2 }]
    s = act(s, 1, { type: 'sell', stall: 0 })
    expect(s.players[1].gold).toBe(2)
    s = act(s, 1, { type: 'sell', stall: 1 })
    expect(s.players[1].gold).toBe(2)
    expect(s.discard.filter(c => c === 'cumin')).toHaveLength(5)
  })

  it('sells a third stall for 3 gold on your own turn only', () => {
    let s = createGame(seats(3), 3)
    s.players[0].gold = 3
    s.players[1].gold = 5
    expect(fail(s, 1, { type: 'buyStall' })).toBe('NOT_NOW')
    s = act(s, 0, { type: 'buyStall' })
    expect(s.players[0].gold).toBe(0)
    expect(s.players[0].stalls).toHaveLength(3)
  })
})

describe('trading', () => {
  function atMarket(): GameState {
    let s = rigged([['pepper', 'cumin', 'clove'], ['ginger', 'nutmeg'], ['vanilla', 'ginger']])
    s = act(s, 0, { type: 'stock', stall: 0 })
    s = act(s, 0, { type: 'endStock' })
    s.deck.push(...s.market)
    s.market = ['saffron', 'cinnamon']
    for (const c of s.market) s.deck.splice(s.deck.indexOf(c), 1)
    return s
  }
  const none = { give: [], giveFromMarket: [], want: [], wantFromMarket: [] }

  it('moves cards to both sides\' pending piles, never into a caravan', () => {
    let s = atMarket()
    s = act(s, 0, { type: 'propose', ...none, to: 1, giveFromMarket: ['saffron'], give: ['cumin'], want: ['ginger'] })
    s = act(s, 1, { type: 'accept', offerId: s.offers[0].id })
    expect(s.players[1].pending.sort()).toEqual(['cumin', 'saffron'])
    expect(s.players[0].pending).toEqual(['ginger'])
    expect(s.players[0].caravan).toEqual(['clove'])
    expect(s.players[1].caravan).toEqual(['nutmeg'])
    expect(s.market).toEqual(['cinnamon'])
    expect(totalCards(s)).toBe(110)
  })

  it('only allows trades that involve the active player', () => {
    const s = atMarket()
    expect(fail(s, 1, { type: 'propose', ...none, to: 2, give: ['ginger'] })).toBe('ACTIVE_PLAYER_ONLY')
    expect(fail(s, 1, { type: 'propose', ...none, to: 0, giveFromMarket: ['saffron'] })).toBe('BAD_OFFER')
    expect(fail(s, 1, { type: 'propose', ...none, to: 0, give: ['saffron'] })).toBe('CARDS_MISSING')
  })

  it('lets anyone take an open offer once, and drops offers that lost their cards', () => {
    let s = atMarket()
    s = act(s, 0, { type: 'propose', ...none, to: null, giveFromMarket: ['saffron'] })
    s = act(s, 2, { type: 'propose', ...none, to: 0, give: ['vanilla'], wantFromMarket: ['saffron'] })
    const open = s.offers[0].id
    s = act(s, 1, { type: 'accept', offerId: open })
    expect(s.offers).toHaveLength(0)
    expect(fail(s, 2, { type: 'accept', offerId: open })).toBe('NO_SUCH_OFFER')
  })

  it('blocks the end of the turn until every traded card is stocked', () => {
    let s = atMarket()
    s = act(s, 0, { type: 'propose', ...none, to: 1, giveFromMarket: ['saffron', 'cinnamon'] })
    s = act(s, 1, { type: 'accept', offerId: s.offers[0].id })
    s = act(s, 0, { type: 'closeMarket' })
    expect(s.phase).toBe('deliver')
    expect(s.active).toBe(0)
    s = act(s, 1, { type: 'stockPending', spice: 'saffron', stall: 0 })
    s = act(s, 1, { type: 'stockPending', spice: 'cinnamon', stall: 1 })
    expect(s.active).toBe(1)
  })

  it('lets the addressee reject and the proposer withdraw', () => {
    let s = atMarket()
    s = act(s, 1, { type: 'propose', ...none, to: 0, give: ['nutmeg'], wantFromMarket: ['saffron'] })
    expect(fail(s, 2, { type: 'reject', offerId: s.offers[0].id })).toBe('NOT_FOR_YOU')
    s = act(s, 0, { type: 'reject', offerId: s.offers[0].id })
    s = act(s, 1, { type: 'propose', ...none, to: 0, give: ['nutmeg'] })
    s = act(s, 1, { type: 'withdraw', offerId: s.offers[0].id })
    expect(s.offers).toHaveLength(0)
  })
})

describe('game end', () => {
  it('finishes the round after the last run-out, sells everything and names the winner', () => {
    let s = createGame(seats(3), 5)
    s.discard.push(...s.deck.splice(0, s.deck.length - 4))
    s.runOuts = s.runOutLimit - 1
    s.players[2].gold = 50
    let guard = 0
    while (s.phase !== 'ended') {
      expect(guard++).toBeLessThan(2000)
      const pi = [s.active, 0, 1, 2].find(i => {
        const a = chooseAction(s, i)
        return a && (a.type !== 'closeMarket' || i === s.active)
      })!
      s = act(s, pi, chooseAction(s, pi)!)
      if (s.finalRound && s.phase !== 'ended') expect(s.turn).toBeLessThanOrEqual(3)
    }
    expect(s.winners).toEqual([2])
    expect(s.players.every(p => p.stalls.every(st => st.count === 0))).toBe(true)
    expect(viewFor(s, 0).players[1].caravan).toBeDefined()
  })
})
