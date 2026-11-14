import { useTranslation } from 'react-i18next'
import { SPICES, type Spice } from '../engine/cards'
import type { Action, GameView } from '../engine/types'
import { SpiceCard, SpiceChips, SpiceIcon } from './SpiceCard'

const MAX_WANTED = 6

/** An offer being put together. Cards are remembered by position, so the draft belongs to one table situation (`key`). */
export interface Draft {
  key: string
  to: number | null
  /** Indexes into my caravan. */
  give: number[]
  /** Indexes into the market: given by the active player, asked for by everyone else. */
  market: number[]
  /** Spices wanted from the other side's caravan. */
  want: Spice[]
}

export const emptyDraft = (key: string): Draft => ({ key, to: null, give: [], market: [], want: [] })

export function toggled(list: number[], i: number): number[] {
  return list.includes(i) ? list.filter(x => x !== i) : [...list, i].sort((a, b) => a - b)
}

interface Props {
  view: GameView
  draft: Draft
  change: (patch: Partial<Draft>) => void
  act: (action: Action) => void
  onClose: () => void
}

export function OfferBuilder({ view, draft, change, act, onClose }: Props) {
  const { t } = useTranslation()
  const isActive = view.active === view.you
  const caravan = view.players[view.you].caravan ?? []
  const giveCards = draft.give.map(i => caravan[i])
  const marketCards = draft.market.map(i => view.market[i])
  const total = draft.give.length + draft.market.length + draft.want.length
  const without = <T,>(list: T[], i: number) => list.filter((_, j) => j !== i)

  const submit = () => {
    act({
      type: 'propose',
      to: isActive ? draft.to : view.active,
      give: giveCards,
      giveFromMarket: isActive ? marketCards : [],
      want: draft.want,
      wantFromMarket: isActive ? [] : marketCards,
    })
    onClose()
  }

  const marketChips = <SpiceChips cards={marketCards} tag={t('trade.marketTag')} onRemove={i => change({ market: without(draft.market, i) })} />
  const giveCount = draft.give.length + (isActive ? draft.market.length : 0)
  const getCount = draft.want.length + (isActive ? 0 : draft.market.length)

  return (
    <div className="builder">
      <h3>{t('trade.new')}</h3>

      <div className="pick-row">
        <span className="pick-label">{t('trade.to')}</span>
        <div className="choice">
          {isActive ? (
            <>
              <button type="button" aria-pressed={draft.to === null} onClick={() => change({ to: null })}>{t('trade.anyone')}</button>
              {view.players.map((p, i) => i !== view.you && (
                <button key={i} type="button" aria-pressed={draft.to === i} onClick={() => change({ to: i })}>{p.name}</button>
              ))}
            </>
          ) : (
            <button type="button" aria-pressed="true" disabled>{view.players[view.active].name}</button>
          )}
        </div>
      </div>

      <div className="trays">
        <div className="tray">
          <span className="offer-label">{t('trade.give')}</span>
          <div className="offer-cards">
            <SpiceChips cards={giveCards} onRemove={i => change({ give: without(draft.give, i) })} />
            {isActive && marketChips}
            {giveCount === 0 && <span className="muted small">{t('trade.nothing')}</span>}
          </div>
        </div>
        <div className="tray">
          <span className="offer-label">{t('trade.get')}</span>
          <div className="offer-cards">
            {!isActive && marketChips}
            <SpiceChips cards={draft.want} onRemove={i => change({ want: without(draft.want, i) })} />
            {getCount === 0 && <span className="muted small">{t('trade.nothing')}</span>}
          </div>
        </div>
      </div>

      <p className="muted small">{t('trade.tapHint')}</p>

      {caravan.length > 0 && (
        <div className="pick-row">
          <span className="pick-label">{t('trade.give')} · {t('trade.fromCaravan')}</span>
          <div className="cards">
            {caravan.map((s, i) => (
              <SpiceCard key={i} spice={s} small selected={draft.give.includes(i)} onClick={() => change({ give: toggled(draft.give, i) })} />
            ))}
          </div>
        </div>
      )}
      {view.market.length > 0 && (
        <div className="pick-row">
          <span className="pick-label">{isActive ? t('trade.give') : t('trade.get')} · {t('trade.fromMarket')}</span>
          <div className="cards">
            {view.market.map((s, i) => (
              <SpiceCard key={i} spice={s} small selected={draft.market.includes(i)} onClick={() => change({ market: toggled(draft.market, i) })} />
            ))}
          </div>
        </div>
      )}
      <div className="pick-row">
        <span className="pick-label">{t('trade.get')} · {t('trade.fromTheirCaravan')}</span>
        <div className="palette">
          {SPICES.map(s => {
            const n = draft.want.filter(w => w === s).length
            return (
              <button key={s} type="button" className={`palette-btn ${n ? 'is-on' : ''}`} disabled={draft.want.length >= MAX_WANTED} onClick={() => change({ want: [...draft.want, s] })}>
                <SpiceIcon spice={s} size={18} />
                <span>{t(`spice.${s}`)}</span>
                {n > 0 && <span className="count">{n}</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="btn-row builder-actions">
        <button type="button" className="btn btn-primary" disabled={total === 0} onClick={submit}>{t('trade.send')}</button>
        <button type="button" className="btn" onClick={onClose}>{t('trade.cancel')}</button>
      </div>
    </div>
  )
}
