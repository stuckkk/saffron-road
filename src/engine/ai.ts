import { MAX_STALLS, saleGold, SPICE_INFO, STALL_COST, type Spice } from './cards'
import { canAccept, canSell, contains, offerSignature } from './engine'
import type { Action, GameState, Offer, OfferContent, PlayerState } from './types'

/** Expected worth of a stall: the sale table, linearly interpolated between its steps. */
function smooth(spice: Spice, count: number): number {
  let prevCards = 0
  let prevGold = 0
  for (const [cards, gold] of SPICE_INFO[spice].sales) {
    if (count <= cards) return prevGold + ((gold - prevGold) * (count - prevCards)) / (cards - prevCards)
    prevCards = cards
    prevGold = gold
  }
  return prevGold
}

function maxCards(spice: Spice): number {
  const sales = SPICE_INFO[spice].sales
  return sales[sales.length - 1][0]
}

/** What is given up by selling this stall now instead of letting it grow. */
function sellLoss(spice: Spice, count: number): number {
  return smooth(spice, count) - saleGold(spice, count)
}

function bestStallToSell(player: PlayerState): number {
  let best = -1
  let bestLoss = Infinity
  player.stalls.forEach((st, i) => {
    if (!st.spice || !canSell(player, i)) return
    const loss = sellLoss(st.spice, st.count) - saleGold(st.spice, st.count) * 0.01
    if (loss < bestLoss) {
      bestLoss = loss
      best = i
    }
  })
  return best
}

function stallFor(player: PlayerState, spice: Spice): number {
  const same = player.stalls.findIndex(st => st.count > 0 && st.spice === spice)
  return same >= 0 ? same : player.stalls.findIndex(st => st.count === 0)
}

function hasStallOf(player: PlayerState, spice: Spice): boolean {
  return player.stalls.some(st => st.count > 0 && st.spice === spice)
}

/** How much the player gains by having to stock one more card of `spice`. */
export function placeValue(player: PlayerState, spice: Spice): number {
  const same = player.stalls.find(st => st.count > 0 && st.spice === spice)
  if (same) {
    if (same.count >= maxCards(spice)) return 0.05
    return smooth(spice, same.count + 1) - smooth(spice, same.count)
  }
  if (player.stalls.some(st => st.count === 0)) return smooth(spice, 1) - 0.1
  const sell = bestStallToSell(player)
  if (sell < 0) return -1
  const st = player.stalls[sell]
  return smooth(spice, 1) - sellLoss(st.spice!, st.count) - 0.2
}

/** Cost of handing over a card from the caravan (negative: glad to be rid of it). */
function handCost(player: PlayerState, spice: Spice): number {
  if (hasStallOf(player, spice)) return 0.8 * Math.max(placeValue(player, spice), 0.2)
  return -0.3
}

/** Net gain for `pi` if it accepts `offer`. */
function acceptGain(state: GameState, offer: Offer, pi: number): number {
  const me = state.players[pi]
  let gain = 0
  for (const s of [...offer.give, ...offer.giveFromMarket]) gain += placeValue(me, s)
  for (const s of offer.want) gain -= handCost(me, s)
  // Market cards I would otherwise have to stock myself.
  for (const s of offer.wantFromMarket) gain -= placeValue(me, s)
  return gain
}

function proposal(state: GameState, pi: number, content: OfferContent): Action | null {
  if (state.posted.includes(offerSignature(pi, content))) return null
  return { type: 'propose', ...content }
}

const EMPTY: Pick<OfferContent, 'give' | 'giveFromMarket' | 'want' | 'wantFromMarket'> = {
  give: [], giveFromMarket: [], want: [], wantFromMarket: [],
}

/**
 * The next thing the AI in seat `pi` wants to do, or null when it has nothing to do right now.
 * Stateless: call it again after every change of the game state.
 */
export function chooseAction(state: GameState, pi: number): Action | null {
  if (state.phase === 'ended') return null
  const me = state.players[pi]
  const isActive = state.active === pi

  // Cash in a stall that cannot grow in value any more.
  const full = me.stalls.findIndex(st => st.spice && st.count >= maxCards(st.spice))
  if (full >= 0) return { type: 'sell', stall: full }

  if (me.pending.length && (state.phase === 'market' || state.phase === 'deliver')) {
    const spice = me.pending.find(s => hasStallOf(me, s)) ?? me.pending[0]
    const stall = stallFor(me, spice)
    if (stall >= 0) return { type: 'stockPending', spice, stall }
    return { type: 'sell', stall: bestStallToSell(me) }
  }

  if (state.phase === 'stock' && isActive) {
    if (me.gold >= STALL_COST && me.stalls.length < MAX_STALLS && state.runOuts === 0) return { type: 'buyStall' }
    const front = me.caravan[0]
    if (front && state.stocked === 0) {
      const stall = stallFor(me, front)
      if (stall >= 0) return { type: 'stock', stall }
      return { type: 'sell', stall: bestStallToSell(me) }
    }
    if (front && state.stocked === 1 && hasStallOf(me, front)) return { type: 'stock', stall: stallFor(me, front) }
    return { type: 'endStock' }
  }

  if (state.phase !== 'market') return null

  // Answer offers.
  for (const offer of state.offers) {
    if (offer.from === pi) continue
    if (canAccept(state, offer, pi)) {
      if (acceptGain(state, offer, pi) > 0.15) return { type: 'accept', offerId: offer.id }
      if (offer.to === pi) return { type: 'reject', offerId: offer.id }
    } else if (offer.to === pi) {
      return { type: 'reject', offerId: offer.id }
    }
  }

  if (isActive) {
    for (const spice of new Set(state.market)) {
      if (placeValue(me, spice) >= 0.3) continue
      // First try to get something useful for it, then give it away.
      const wanted = me.stalls
        .filter(st => st.spice && st.count > 0 && st.spice !== spice)
        .sort((a, b) => placeValue(me, b.spice!) - placeValue(me, a.spice!))[0]
      if (wanted) {
        const p = proposal(state, pi, { ...EMPTY, to: null, giveFromMarket: [spice], want: [wanted.spice!] })
        if (p) return p
      }
      const gift = proposal(state, pi, { ...EMPTY, to: null, giveFromMarket: [spice] })
      if (gift) return gift
    }
    // A front card that would wreck a stall next turn: see whether anyone wants it.
    const front = me.caravan[0]
    if (front && placeValue(me, front) < 0) {
      const gift = proposal(state, pi, { ...EMPTY, to: null, give: [front] })
      if (gift) return gift
    }
    return { type: 'closeMarket' }
  }

  // Not my turn: ask for market cards that fit my stalls.
  for (const spice of new Set(state.market)) {
    if (!hasStallOf(me, spice)) continue
    const spare = me.caravan.find(s => s !== spice && !hasStallOf(me, s))
    const content: OfferContent = { ...EMPTY, to: state.active, give: spare ? [spare] : [], wantFromMarket: [spice] }
    if (!contains(state.market, content.wantFromMarket)) continue
    const p = proposal(state, pi, content)
    if (p) return p
  }
  return null
}
