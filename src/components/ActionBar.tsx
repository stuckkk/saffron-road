import { useTranslation } from 'react-i18next'
import type { Action, GameView } from '../engine/types'
import type { TurnState } from './turnState'

const STEPS = ['stock', 'market', 'deliver', 'resupply'] as const

interface Props {
  view: GameView
  ts: TurnState
  act: (action: Action) => void
  /** Offers waiting for my answer. */
  waiting: number
  onMakeOffer: () => void
  /** Phones: open the sheet with offers and journal. */
  onOpenSide: () => void
}

/** The one place that says whose turn it is, where the turn stands, and what the next step is. */
export function ActionBar({ view, ts, act, waiting, onMakeOffer, onOpenSide }: Props) {
  const { t } = useTranslation()
  const { isActive } = ts
  const market = view.phase === 'market'
  return (
    <section className={`bar ${isActive ? 'is-mine' : ''}`} aria-label={t('game.turn')}>
      <ol className="steps">
        {STEPS.map((s, i) => (
          <li key={s} className={s === view.phase ? 'is-now' : ''} aria-current={s === view.phase ? 'step' : undefined}>
            <span className="step-no">{i + 1}</span> {t(`phase.${s}`)}
          </li>
        ))}
      </ol>
      <div className="bar-status" role="status">
        <b>{isActive ? t('game.yourTurn') : t('game.turnOf', { name: ts.activeName })}</b>
        <span>{ts.hint}</span>
      </div>
      <div className="bar-actions">
        <button type="button" className="btn bar-side-btn" onClick={onOpenSide}>
          {t('trade.offers')}
          {waiting > 0 && <span className="count">{waiting}</span>}
        </button>
        {market && (
          <button type="button" className={`btn ${isActive ? '' : 'btn-primary'}`} onClick={onMakeOffer}>{t('trade.make')}</button>
        )}
        {isActive && view.phase === 'stock' && (
          <button type="button" className="btn btn-primary" disabled={view.stocked === 0 && ts.caravan.length > 0} onClick={() => act({ type: 'endStock' })}>
            {t('game.openMarket')}
          </button>
        )}
        {isActive && market && (
          <button type="button" className="btn btn-primary" onClick={() => act({ type: 'closeMarket' })}>{t('game.closeMarket')}</button>
        )}
      </div>
    </section>
  )
}
