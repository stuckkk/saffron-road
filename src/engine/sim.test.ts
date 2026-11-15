import { describe, expect, it } from 'vitest'
import { chooseAction } from './ai'
import { applyAction, createGame } from './engine'
import type { GameState } from './types'

/** Plays one all-AI game to the end; throws on any illegal action. */
export function playOut(players: number, seed: number): { state: GameState; steps: number; trades: number } {
  let s = createGame(Array.from({ length: players }, (_, i) => ({ name: `Bot ${i}`, isAI: true })), seed)
  let steps = 0
  let trades = 0
  while (s.phase !== 'ended') {
    if (++steps > 20000) throw new Error(`game ${seed} did not end`)
    // Everyone gets to act before the active player closes the market.
    let pi = -1
    for (let k = 0; k < players && pi < 0; k++) {
      const i = (s.active + k) % players
      const a = chooseAction(s, i)
      if (a && a.type !== 'closeMarket') pi = i
    }
    if (pi < 0) pi = s.active
    const action = chooseAction(s, pi)
    if (!action) throw new Error(`game ${seed}: nobody can act in phase ${s.phase}`)
    const r = applyAction(s, pi, action)
    if (!r.ok) throw new Error(`game ${seed}: ${action.type} by ${pi} rejected: ${r.error}`)
    if (action.type === 'accept') trades++
    s = r.state
    const cards = s.deck.length + s.discard.length + s.market.length + Object.values(s.goldCards).reduce((n, g) => n + g, 0) + s.players.reduce(
      (n, p) => n + p.caravan.length + p.pending.length + p.stalls.reduce((m, st) => m + st.count, 0), 0)
    if (cards !== 104) throw new Error(`game ${seed}: ${cards} cards in play`)
  }
  return { state: s, steps, trades }
}

describe('all-AI simulation', () => {
  for (const players of [3, 4, 5]) {
    it(`plays 150 legal ${players}-player games to the end`, () => {
      let turns = 0
      let gold = 0
      let trades = 0
      const games = 150
      for (let seed = 1; seed <= games; seed++) {
        const r = playOut(players, seed * 7919 + players)
        expect(r.state.winners!.length).toBeGreaterThan(0)
        turns += r.state.turn
        trades += r.trades
        gold += r.state.players.reduce((n, p) => n + p.gold, 0) / players
      }
      console.log(
        `${players}p: ${(turns / games / players).toFixed(1)} turns per player, ` +
        `${(gold / games).toFixed(1)} gold per player, ${(trades / games).toFixed(1)} trades per game`)
      // Paid-out cards leave the game, so the later decks are thinner: about 5 turns each with 5 players.
      expect(turns / games / players).toBeGreaterThan(4)
    })
  }
})
