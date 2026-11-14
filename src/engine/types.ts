import type { Spice } from './cards'

export type Phase = 'stock' | 'market' | 'deliver' | 'ended'

export interface Stall {
  spice: Spice | null
  count: number
}

export interface PlayerState {
  name: string
  isAI: boolean
  /** Hand in fixed order; index 0 is the front. */
  caravan: Spice[]
  stalls: Stall[]
  gold: number
  /** Cards received this turn that must be stocked before the turn can end. */
  pending: Spice[]
}

export interface OfferContent {
  /** Player index the offer is addressed to; null = anyone (only the active player may do that). */
  to: number | null
  /** Cards from the proposer's caravan. */
  give: Spice[]
  /** Market cards the proposer hands over (active player only). */
  giveFromMarket: Spice[]
  /** Cards wanted from the other side's caravan. */
  want: Spice[]
  /** Market cards wanted from the active player (non-active proposers only). */
  wantFromMarket: Spice[]
}

export interface Offer extends OfferContent {
  id: number
  from: number
}

export interface LogEntry {
  seq: number
  key: string
  /** Player index the entry is about, if any. */
  player?: number
  other?: number
  spice?: Spice
  n?: number
  gold?: number
}

export interface GameState {
  players: PlayerState[]
  deck: Spice[]
  discard: Spice[]
  market: Spice[]
  phase: Phase
  active: number
  /** Cards the active player has stocked from the caravan this turn. */
  stocked: number
  turn: number
  royalOrder: Spice
  runOuts: number
  runOutLimit: number
  finalRound: boolean
  offers: Offer[]
  nextOfferId: number
  /** Signatures of offers posted this turn (the AI uses it to avoid repeating itself). */
  posted: string[]
  log: LogEntry[]
  logSeq: number
  rng: number
  winners: number[] | null
}

export type Action =
  | { type: 'stock'; stall: number }
  | { type: 'endStock' }
  | { type: 'stockPending'; spice: Spice; stall: number }
  | { type: 'sell'; stall: number }
  | { type: 'buyStall' }
  | ({ type: 'propose' } & OfferContent)
  | { type: 'accept'; offerId: number }
  | { type: 'reject'; offerId: number }
  | { type: 'withdraw'; offerId: number }
  | { type: 'closeMarket' }

export type ActionResult = { ok: true; state: GameState } | { ok: false; error: string }

/** What one player is allowed to see. */
export interface PlayerView {
  name: string
  isAI: boolean
  caravanCount: number
  /** Only present for the viewer's own seat. */
  caravan?: Spice[]
  stalls: Stall[]
  gold: number
  pending: Spice[]
}

export interface GameView {
  you: number
  players: PlayerView[]
  deckCount: number
  discardCount: number
  market: Spice[]
  phase: Phase
  active: number
  stocked: number
  turn: number
  royalOrder: Spice
  runOuts: number
  runOutLimit: number
  finalRound: boolean
  offers: Offer[]
  log: LogEntry[]
  winners: number[] | null
}
