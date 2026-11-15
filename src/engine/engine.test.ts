import { describe, expect, it } from 'vitest'
import { buildDeck, DECK_COUNT, saleGold, SPICES, SPICE_INFO, type Spice } from './cards'
import { chooseAction } from './ai'
import { applyAction, canSell, createGame, everyoneDoneTrading, viewFor } from './engine'
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
  return s.deck.length + s.discard.length + s.market.length + Object.values(s.goldCards).reduce((n, g) => n + g, 0) + s.players.reduce(
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
  it('has 104 cards and ascending sale tables', () => {
    expect(buildDeck()).toHaveLength(104)
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
    expect(saleGold('saffron', 3)).toBe(3)
    expect(saleGold('saffron', 6)).toBe(3)
  })
})

describe('turn flow', () => {
  it('deals five cards each and hides other caravans', () => {
    const s = createGame(seats(4), 7)
    expect(s.players.every(p => p.caravan.length === 5)).toBe(true)
    expect(totalCards(s)).toBe(104)
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
    expect(totalCards(s)).toBe(104)
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

  it('pays the sale table on a sale and discards the cards', () => {
    let s = createGame(seats(3), 3)
    s.players[1].stalls = [{ spice: 'cumin', count: 3 }, { spice: 'cumin', count: 2 }]
    s = act(s, 1, { type: 'sell', stall: 0 })
    expect(s.players[1].gold).toBe(1)
    s = act(s, 1, { type: 'sell', stall: 1 })
    expect(s.players[1].gold).toBe(1)
    // The one card paid out as gold leaves the game; the other four are discarded.
    expect(s.goldCards.cumin).toBe(1)
    expect(s.discard.filter(c => c === 'cumin')).toHaveLength(4)
  })

  it('tracks who is done trading during the market', () => {
    let s = createGame(seats(3), 3)
    s.players[1].isAI = false
    s.players[2].isAI = false
    expect(fail(s, 1, { type: 'doneTrading', done: true })).toBe('NOT_NOW')
    s = act(s, 0, { type: 'stock', stall: 0 })
    s = act(s, 0, { type: 'endStock' })
    expect(fail(s, 0, { type: 'doneTrading', done: true })).toBe('NOT_NOW')
    s = act(s, 1, { type: 'doneTrading', done: true })
    expect(everyoneDoneTrading(s)).toBe(false)
    s = act(s, 2, { type: 'doneTrading', done: true })
    expect(everyoneDoneTrading(s)).toBe(true)
    expect(viewFor(s, 0).players[1].doneTrading).toBe(true)
    // A new offer from the active player to everyone reopens trading for all.
    s = act(s, 0, { type: 'propose', to: null, give: [], giveFromMarket: [s.market[0]], want: [], wantFromMarket: [] })
    expect(s.players[1].doneTrading).toBe(false)
    expect(everyoneDoneTrading(s)).toBe(false)
    // Making an offer yourself also means you are still trading.
    s = act(s, 2, { type: 'doneTrading', done: true })
    s = act(s, 2, { type: 'propose', to: 0, give: [], giveFromMarket: [], want: [], wantFromMarket: [s.market[1]] })
    expect(s.players[2].doneTrading).toBe(false)
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
    let s = rigged([['pepper', 'cumin', 'clove'], ['ginger', 'nutmeg'], ['cardamom', 'ginger']])
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
    expect(totalCards(s)).toBe(104)
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
    s = act(s, 2, { type: 'propose', ...none, to: 0, give: ['cardamom'], wantFromMarket: ['saffron'] })
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
  /** A game on its last deck with only `left` cards in it. */
  function lastDeck(left: number): GameState {
    const s = createGame(seats(3), 5)
    s.discard.push(...s.deck.splice(0, s.deck.length - left))
    s.runOuts = DECK_COUNT - 1
    return s
  }

  it('shuffles the discard pile into a new deck twice, then never again', () => {
    let s = createGame(seats(3), 5)
    s.discard.push(...s.deck.splice(0, s.deck.length - 1))
    s = act(s, 0, { type: 'stock', stall: 0 })
    s = act(s, 0, { type: 'endStock' })
    expect(s.runOuts).toBe(1)
    expect(s.market).toHaveLength(2)
    expect(s.discard).toHaveLength(0)
    expect(totalCards(s)).toBe(104)
  })

  it('ends at once when the last deck cannot fill the market, and names the winner', () => {
    let s = lastDeck(1)
    s.players[2].gold = 50
    s.players[1].stalls[0] = { spice: 'pepper', count: 4 }
    s = act(s, 0, { type: 'stock', stall: 0 })
    s = act(s, 0, { type: 'endStock' })
    expect(s.phase).toBe('ended')
    expect(s.market).toHaveLength(0)
    expect(s.deck).toHaveLength(1)
    expect(s.players[1].gold).toBe(1)
    expect(s.winners).toEqual([2])
    expect(s.players.every(p => p.stalls.every(st => st.count === 0))).toBe(true)
    expect(viewFor(s, 0).players[1].caravan).toBeDefined()
  })

  it('ends at once when the last deck cannot resupply the active player', () => {
    let s = lastDeck(4)
    s = act(s, 0, { type: 'stock', stall: 0 })
    s = act(s, 0, { type: 'endStock' })
    const caravan = s.players[0].caravan.length
    let guard = 0
    while (s.phase !== 'ended') {
      expect(guard++).toBeLessThan(50)
      expect(s.active).toBe(0)
      const a = chooseAction(s, 0)!
      s = act(s, 0, a.type === 'propose' ? { type: 'closeMarket' } : a)
    }
    expect(s.players[0].caravan).toHaveLength(caravan)
    expect(s.deck).toHaveLength(2)
  })
})
