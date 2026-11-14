import type { TFunction } from 'i18next'
import type { Spice } from '../engine/cards'
import { canPlace } from '../engine/engine'
import type { GameView, LogEntry, Offer, PlayerView } from '../engine/types'

/** Everything the table needs to know about "what can I do right now", derived from the view. */
export interface TurnState {
  me: PlayerView
  caravan: Spice[]
  isActive: boolean
  activeName: string
  /** Market or deliver phase: received cards can be stocked. */
  trading: boolean
  pendingIndex: number
  /** The card that goes onto the next stall I tap, if any. */
  placing: Spice | null
  placingPending: boolean
  /** True when `placing` fits no stall: one has to be sold first. */
  needRoom: boolean
  hint: string
}

export function turnState(view: GameView, pick: number, t: TFunction): TurnState {
  const me = view.players[view.you]
  const caravan = me.caravan ?? []
  const isActive = view.active === view.you
  const activeName = view.players[view.active].name
  const trading = view.phase === 'market' || view.phase === 'deliver'
  const pendingIndex = Math.max(0, Math.min(pick, me.pending.length - 1))
  const pendingSpice = trading && me.pending.length ? me.pending[pendingIndex] : null
  const frontSpice = !pendingSpice && isActive && view.phase === 'stock' && view.stocked < 2 ? caravan[0] ?? null : null
  const placing = pendingSpice ?? frontSpice
  const fits = placing ? me.stalls.some((_, i) => canPlace(me, placing, i)) : true
  // The second caravan card is optional, so a full house only blocks the first one and delivered cards.
  const needRoom = !fits && (pendingSpice !== null || view.stocked === 0)

  let hint = ''
  if (view.phase === 'stock') {
    if (!isActive) hint = t('hint.wait', { name: activeName })
    else if (view.stocked === 0 && caravan.length === 0) hint = t('hint.stockNone')
    else if (view.stocked === 0) hint = fits ? t('hint.stockFirst') : t('hint.needRoom', { spice: t(`spice.${placing}`) })
    else hint = t('hint.stockMore')
  } else if (trading) {
    const waiting = view.players.filter(p => p.pending.length > 0).map(p => p.name)
    if (placing && !fits) hint = t('hint.needRoom', { spice: t(`spice.${placing}`) })
    else if (me.pending.length) hint = t('hint.deliverYou')
    else if (view.phase === 'deliver') hint = t('hint.deliverWait', { names: waiting.join(', ') })
    else hint = isActive ? t('hint.marketActive') : t('hint.marketOther', { name: activeName })
  }

  return { me, caravan, isActive, activeName, trading, pendingIndex, placing, placingPending: pendingSpice !== null, needRoom, hint }
}

export function logText(e: LogEntry, view: GameView, t: TFunction): string {
  return t(`log.${e.key}`, {
    player: e.player !== undefined ? view.players[e.player].name : '',
    other: e.other !== undefined ? view.players[e.other].name : '',
    spice: e.spice ? t(`spice.${e.spice}`) : '',
    n: e.n,
    gold: e.gold,
  })
}

export const isMine = (o: Offer, view: GameView) => o.from === view.you
/** An offer I may accept: addressed to me, or made to everyone by the active player. */
export const isForMe = (o: Offer, view: GameView) => o.from !== view.you && (o.to === view.you || o.to === null)
