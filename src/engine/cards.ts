export const SPICES = [
  'pepper', 'cumin', 'cinnamon', 'ginger', 'clove', 'cardamom', 'nutmeg', 'saffron',
] as const

export type Spice = (typeof SPICES)[number]

export interface SpiceInfo {
  /** Copies in the deck. */
  count: number
  /** Sale table: [cards on the stall, gold paid], ascending. */
  sales: [cards: number, gold: number][]
}

export const SPICE_INFO: Record<Spice, SpiceInfo> = {
  pepper: { count: 20, sales: [[4, 1], [6, 2], [8, 3], [10, 4]] },
  cumin: { count: 18, sales: [[3, 1], [6, 2], [8, 3], [9, 4]] },
  cinnamon: { count: 16, sales: [[3, 1], [5, 2], [7, 3], [8, 4]] },
  ginger: { count: 14, sales: [[3, 1], [5, 2], [6, 3], [7, 4]] },
  clove: { count: 12, sales: [[2, 1], [4, 2], [6, 3], [7, 4]] },
  cardamom: { count: 10, sales: [[2, 1], [4, 2], [5, 3], [6, 4]] },
  nutmeg: { count: 8, sales: [[2, 1], [3, 2], [4, 3], [5, 4]] },
  saffron: { count: 6, sales: [[2, 2], [3, 3]] },
}

export const HAND_SIZE = 5
export const DRAW_COUNT = 3
export const MARKET_SIZE = 2
export const START_STALLS = 2
export const MAX_STALLS = 3
export const STALL_COST = 3
export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 5

/** The discard pile is shuffled into a new deck twice, so a game uses this many decks. */
export const DECK_COUNT = 3

export function isSpice(x: unknown): x is Spice {
  return typeof x === 'string' && (SPICES as readonly string[]).includes(x)
}

/** Gold paid for selling a stall holding `count` cards of `spice`. */
export function saleGold(spice: Spice, count: number): number {
  let gold = 0
  for (const [cards, g] of SPICE_INFO[spice].sales) if (count >= cards) gold = g
  return gold
}

export function buildDeck(): Spice[] {
  const deck: Spice[] = []
  for (const s of SPICES) for (let i = 0; i < SPICE_INFO[s].count; i++) deck.push(s)
  return deck
}
