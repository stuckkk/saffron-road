import {
  buildDeck, DRAW_COUNT, HAND_SIZE, isSpice, MARKET_SIZE, MAX_PLAYERS, MAX_STALLS, MIN_PLAYERS,
  runOutLimit, saleGold, SPICES, STALL_COST, START_STALLS, type Spice,
} from './cards'
import type {
  Action, ActionResult, GameState, GameView, LogEntry, Offer, OfferContent, PlayerState,
} from './types'

const LOG_LIMIT = 60
const MAX_OFFER_CARDS = 6
const MAX_OPEN_OFFERS_PER_PLAYER = 6

// ---------------------------------------------------------------- random

/** mulberry32 step: returns [next state, float in [0,1)]. */
function nextRandom(state: GameState): number {
  state.rng = (state.rng + 0x6d2b79f5) | 0
  let t = state.rng
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function shuffle<T>(state: GameState, items: T[]): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(state) * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ---------------------------------------------------------------- setup

export function createGame(seats: { name: string; isAI: boolean }[], seed: number): GameState {
  if (seats.length < MIN_PLAYERS || seats.length > MAX_PLAYERS) {
    throw new Error(`Saffron Road needs ${MIN_PLAYERS}-${MAX_PLAYERS} players`)
  }
  const state: GameState = {
    players: seats.map(s => ({
      name: s.name,
      isAI: s.isAI,
      caravan: [],
      stalls: Array.from({ length: START_STALLS }, () => ({ spice: null, count: 0 })),
      gold: 0,
      pending: [],
    })),
    deck: [],
    discard: [],
    market: [],
    phase: 'stock',
    active: 0,
    stocked: 0,
    turn: 1,
    royalOrder: 'pepper',
    runOuts: 0,
    runOutLimit: runOutLimit(seats.length),
    finalRound: false,
    offers: [],
    nextOfferId: 1,
    posted: [],
    log: [],
    logSeq: 0,
    rng: seed | 0,
    winners: null,
  }
  state.deck = shuffle(state, buildDeck())
  state.royalOrder = SPICES[Math.floor(nextRandom(state) * SPICES.length)]
  for (let i = 0; i < HAND_SIZE; i++) {
    for (const p of state.players) p.caravan.push(state.deck.pop()!)
  }
  log(state, { key: 'start', spice: state.royalOrder })
  return state
}

// ---------------------------------------------------------------- helpers

function log(state: GameState, entry: Omit<LogEntry, 'seq'>): void {
  state.log.push({ seq: ++state.logSeq, ...entry })
  if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT)
}

function reshuffle(state: GameState): void {
  if (state.discard.length === 0) return
  state.deck = shuffle(state, state.discard)
  state.discard = []
  const others = SPICES.filter(s => s !== state.royalOrder)
  state.royalOrder = others[Math.floor(nextRandom(state) * others.length)]
  log(state, { key: 'reshuffle', spice: state.royalOrder })
}

function noteRunOut(state: GameState): void {
  state.runOuts++
  if (state.runOuts >= state.runOutLimit && !state.finalRound) {
    state.finalRound = true
    log(state, { key: 'finalRound' })
  }
}

function drawCard(state: GameState): Spice | null {
  if (state.deck.length === 0) {
    reshuffle(state)
    if (state.deck.length === 0) {
      // Nothing left anywhere: count it, so a game can never go on forever.
      noteRunOut(state)
      return null
    }
  }
  const card = state.deck.pop()!
  if (state.deck.length === 0) {
    noteRunOut(state)
    reshuffle(state)
  }
  return card
}

export function canPlace(player: Pick<PlayerState, 'stalls'>, spice: Spice, stall: number): boolean {
  const st = player.stalls[stall]
  return !!st && (st.count === 0 || st.spice === spice)
}

/** A stall with a single card may only be sold when no other stall of that player holds more. */
export function canSell(player: Pick<PlayerState, 'stalls'>, stall: number): boolean {
  const st = player.stalls[stall]
  if (!st || st.count === 0) return false
  return st.count >= 2 || player.stalls.every(s => s.count <= 1)
}

/** Gold a stall would pay right now, Royal Order bonus included. */
export function stallSaleValue(spice: Spice | null, count: number, royalOrder: Spice): number {
  if (!spice || count === 0) return 0
  const gold = saleGold(spice, count)
  return gold > 0 && spice === royalOrder ? gold + 1 : gold
}

function sellStall(state: GameState, pi: number, si: number): void {
  const player = state.players[pi]
  const st = player.stalls[si]
  if (!st.spice || st.count === 0) return
  const gold = stallSaleValue(st.spice, st.count, state.royalOrder)
  player.gold += gold
  for (let i = 0; i < st.count; i++) state.discard.push(st.spice)
  log(state, { key: 'sell', player: pi, spice: st.spice, n: st.count, gold })
  st.spice = null
  st.count = 0
}

function place(state: GameState, pi: number, spice: Spice, si: number): void {
  const st = state.players[pi].stalls[si]
  st.spice = spice
  st.count++
}

function countOf(cards: Spice[]): Map<Spice, number> {
  const m = new Map<Spice, number>()
  for (const c of cards) m.set(c, (m.get(c) ?? 0) + 1)
  return m
}

/** Does `pool` contain every card of `cards` (as a multiset)? */
export function contains(pool: Spice[], cards: Spice[]): boolean {
  const have = countOf(pool)
  for (const [s, n] of countOf(cards)) if ((have.get(s) ?? 0) < n) return false
  return true
}

function removeCards(pool: Spice[], cards: Spice[]): void {
  for (const c of cards) pool.splice(pool.indexOf(c), 1)
}

export function offerSignature(from: number, o: OfferContent): string {
  const part = (a: Spice[]) => a.slice().sort().join(',')
  return [from, o.to ?? '*', part(o.give), part(o.giveFromMarket), part(o.want), part(o.wantFromMarket)].join('|')
}

/** Who would hand over the market cards and who gets what, for an offer accepted by `acceptor`. */
function offerFeasible(state: GameState, offer: Offer, acceptor: number | null): boolean {
  if (!contains(state.players[offer.from].caravan, offer.give)) return false
  if (!contains(state.market, [...offer.giveFromMarket, ...offer.wantFromMarket])) return false
  if (acceptor !== null && !contains(state.players[acceptor].caravan, offer.want)) return false
  return true
}

export function canAccept(state: GameState, offer: Offer, pi: number): boolean {
  if (state.phase !== 'market' || pi === offer.from) return false
  if (offer.to === null ? pi === state.active : pi !== offer.to) return false
  return offerFeasible(state, offer, pi)
}

function finishGame(state: GameState): void {
  state.players.forEach((p, pi) => p.stalls.forEach((_, si) => sellStall(state, pi, si)))
  const best = Math.max(...state.players.map(p => p.gold))
  let winners = state.players.map((_, i) => i).filter(i => state.players[i].gold === best)
  if (winners.length > 1) {
    const most = Math.max(...winners.map(i => state.players[i].caravan.length))
    winners = winners.filter(i => state.players[i].caravan.length === most)
  }
  state.winners = winners
  state.phase = 'ended'
  state.offers = []
  state.market = []
  log(state, { key: 'end' })
}

function endTurn(state: GameState): void {
  const player = state.players[state.active]
  let drawn = 0
  for (let i = 0; i < DRAW_COUNT; i++) {
    const card = drawCard(state)
    if (card) {
      player.caravan.push(card)
      drawn++
    }
  }
  log(state, { key: 'resupply', player: state.active, n: drawn })
  state.offers = []
  state.posted = []
  if (state.finalRound && state.active === state.players.length - 1) {
    finishGame(state)
    return
  }
  state.active = (state.active + 1) % state.players.length
  state.turn++
  state.phase = 'stock'
  state.stocked = 0
}

function maybeEndTurn(state: GameState): void {
  if (state.phase === 'deliver' && state.players.every(p => p.pending.length === 0)) endTurn(state)
}

function validCards(x: unknown): x is Spice[] {
  return Array.isArray(x) && x.length <= MAX_OFFER_CARDS && x.every(isSpice)
}

// ---------------------------------------------------------------- actions

export function applyAction(prev: GameState, pi: number, action: Action): ActionResult {
  const state = structuredClone(prev)
  const error = perform(state, pi, action)
  return error ? { ok: false, error } : { ok: true, state }
}

/** Mutates `state`; returns an error code, or null on success. */
function perform(state: GameState, pi: number, action: Action): string | null {
  const player = state.players[pi]
  if (!player) return 'NO_SUCH_PLAYER'
  if (state.phase === 'ended') return 'GAME_OVER'
  const isActive = pi === state.active

  switch (action.type) {
    case 'stock': {
      if (!isActive || state.phase !== 'stock') return 'NOT_NOW'
      if (state.stocked >= 2) return 'ALREADY_STOCKED_TWO'
      const card = player.caravan[0]
      if (!card) return 'CARAVAN_EMPTY'
      if (!canPlace(player, card, action.stall)) return 'STALL_OCCUPIED'
      player.caravan.shift()
      place(state, pi, card, action.stall)
      state.stocked++
      log(state, { key: 'stock', player: pi, spice: card })
      return null
    }
    case 'endStock': {
      if (!isActive || state.phase !== 'stock') return 'NOT_NOW'
      if (state.stocked === 0 && player.caravan.length > 0) return 'MUST_STOCK_FIRST'
      for (let i = 0; i < MARKET_SIZE; i++) {
        const card = drawCard(state)
        if (card) state.market.push(card)
      }
      state.phase = 'market'
      log(state, { key: 'market', player: pi })
      return null
    }
    case 'stockPending': {
      if (state.phase !== 'market' && state.phase !== 'deliver') return 'NOT_NOW'
      const idx = player.pending.indexOf(action.spice)
      if (idx < 0) return 'NO_SUCH_CARD'
      if (!canPlace(player, action.spice, action.stall)) return 'STALL_OCCUPIED'
      player.pending.splice(idx, 1)
      place(state, pi, action.spice, action.stall)
      log(state, { key: 'stock', player: pi, spice: action.spice })
      maybeEndTurn(state)
      return null
    }
    case 'sell': {
      if (!canSell(player, action.stall)) return 'CANNOT_SELL'
      sellStall(state, pi, action.stall)
      return null
    }
    case 'buyStall': {
      if (!isActive) return 'NOT_NOW'
      if (player.stalls.length >= MAX_STALLS) return 'MAX_STALLS'
      if (player.gold < STALL_COST) return 'NOT_ENOUGH_GOLD'
      player.gold -= STALL_COST
      player.stalls.push({ spice: null, count: 0 })
      log(state, { key: 'buyStall', player: pi })
      return null
    }
    case 'propose': {
      if (state.phase !== 'market') return 'NOT_NOW'
      if (![action.give, action.giveFromMarket, action.want, action.wantFromMarket].every(validCards)) {
        return 'BAD_OFFER'
      }
      const to = action.to
      if (isActive) {
        if (to !== null && (!Number.isInteger(to) || to === pi || !state.players[to])) return 'BAD_OFFER'
        if (action.wantFromMarket.length) return 'BAD_OFFER'
      } else {
        if (to !== state.active) return 'ACTIVE_PLAYER_ONLY'
        if (action.giveFromMarket.length) return 'BAD_OFFER'
      }
      const total = action.give.length + action.giveFromMarket.length + action.want.length + action.wantFromMarket.length
      if (total === 0) return 'BAD_OFFER'
      if (state.offers.filter(o => o.from === pi).length >= MAX_OPEN_OFFERS_PER_PLAYER) return 'TOO_MANY_OFFERS'
      const offer: Offer = {
        id: state.nextOfferId++,
        from: pi,
        to,
        give: action.give.slice(),
        giveFromMarket: action.giveFromMarket.slice(),
        want: action.want.slice(),
        wantFromMarket: action.wantFromMarket.slice(),
      }
      if (!offerFeasible(state, offer, null)) return 'CARDS_MISSING'
      state.offers.push(offer)
      const sig = offerSignature(pi, offer)
      if (!state.posted.includes(sig)) state.posted.push(sig)
      log(state, { key: 'offer', player: pi, ...(to !== null ? { other: to } : {}) })
      return null
    }
    case 'accept': {
      const offer = state.offers.find(o => o.id === action.offerId)
      if (!offer) return 'NO_SUCH_OFFER'
      if (state.phase !== 'market' || pi === offer.from) return 'NOT_NOW'
      if (offer.to === null ? isActive : pi !== offer.to) return 'NOT_FOR_YOU'
      if (!offerFeasible(state, offer, pi)) return 'CARDS_MISSING'
      const proposer = state.players[offer.from]
      removeCards(proposer.caravan, offer.give)
      removeCards(player.caravan, offer.want)
      removeCards(state.market, [...offer.giveFromMarket, ...offer.wantFromMarket])
      player.pending.push(...offer.give, ...offer.giveFromMarket)
      proposer.pending.push(...offer.want, ...offer.wantFromMarket)
      state.offers = state.offers.filter(o => o.id !== offer.id && offerFeasible(state, o, null))
      const n = offer.give.length + offer.giveFromMarket.length + offer.want.length + offer.wantFromMarket.length
      log(state, { key: 'trade', player: offer.from, other: pi, n })
      return null
    }
    case 'reject': {
      const offer = state.offers.find(o => o.id === action.offerId)
      if (!offer) return 'NO_SUCH_OFFER'
      if (offer.to !== pi) return 'NOT_FOR_YOU'
      state.offers = state.offers.filter(o => o !== offer)
      log(state, { key: 'reject', player: pi, other: offer.from })
      return null
    }
    case 'withdraw': {
      const offer = state.offers.find(o => o.id === action.offerId)
      if (!offer) return 'NO_SUCH_OFFER'
      if (offer.from !== pi) return 'NOT_FOR_YOU'
      state.offers = state.offers.filter(o => o !== offer)
      return null
    }
    case 'closeMarket': {
      if (!isActive || state.phase !== 'market') return 'NOT_NOW'
      player.pending.push(...state.market)
      state.market = []
      state.offers = []
      state.phase = 'deliver'
      log(state, { key: 'closeMarket', player: pi })
      maybeEndTurn(state)
      return null
    }
    default:
      return 'UNKNOWN_ACTION'
  }
}

// ---------------------------------------------------------------- view

export function viewFor(state: GameState, you: number): GameView {
  return {
    you,
    players: state.players.map((p, i) => ({
      name: p.name,
      isAI: p.isAI,
      caravanCount: p.caravan.length,
      ...(i === you || state.phase === 'ended' ? { caravan: p.caravan.slice() } : {}),
      stalls: p.stalls.map(s => ({ ...s })),
      gold: p.gold,
      pending: p.pending.slice(),
    })),
    deckCount: state.deck.length,
    discardCount: state.discard.length,
    market: state.market.slice(),
    phase: state.phase,
    active: state.active,
    stocked: state.stocked,
    turn: state.turn,
    royalOrder: state.royalOrder,
    runOuts: state.runOuts,
    runOutLimit: state.runOutLimit,
    finalRound: state.finalRound,
    offers: state.offers.map(o => ({ ...o })),
    log: state.log.slice(),
    winners: state.winners,
  }
}
