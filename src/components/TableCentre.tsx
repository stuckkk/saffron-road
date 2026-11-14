import { useTranslation } from 'react-i18next'
import type { GameView } from '../engine/types'
import { Crown, SpiceCard, SpiceIcon } from './SpiceCard'
import { logText } from './turnState'

interface Props {
  view: GameView
  /** Market cards currently in the offer draft (indexes). */
  offered: number[]
  /** Set while the market is open: tapping a market card puts it into an offer. */
  onOffer?: (index: number) => void
  onJournal: () => void
}

/** The middle of the table: deck, Royal Order and the market. */
export function TableCentre({ view, offered, onOffer, onJournal }: Props) {
  const { t } = useTranslation()
  const deckNo = Math.min(view.runOuts + 1, view.runOutLimit)
  const latest = view.log[view.log.length - 1]
  return (
    <section className="zone centre" aria-label={t('game.market')}>
      <div className="centre-info">
        <div className="tile">
          <span className="tile-label">{t('game.deck')}</span>
          <span className="tile-main"><span className="card-back" aria-hidden="true" /> {view.deckCount}</span>
          {view.finalRound ? (
            <span className="badge badge-warn">{t('game.finalRound')}</span>
          ) : (
            <span className="tile-sub">
              <span className="pips" aria-hidden="true">
                {Array.from({ length: view.runOutLimit }, (_, i) => <i key={i} className={i < deckNo ? 'is-on' : ''} />)}
              </span>
              {t('game.deckOf', { n: deckNo, max: view.runOutLimit })}
            </span>
          )}
        </div>
        <div className="tile tile-royal">
          <span className="tile-label"><Crown size={12} /> {t('game.royalOrder')}</span>
          <span className="tile-main"><span className="royal-icon"><SpiceIcon spice={view.royalOrder} size={20} /></span> {t(`spice.${view.royalOrder}`)}</span>
          <span className="tile-sub">{t('game.royalHint')}</span>
        </div>
      </div>

      <div className="market">
        <h2>{t('game.market')}</h2>
        {view.market.length ? (
          <div className="cards">
            {view.market.map((s, i) => (
              <SpiceCard key={i} spice={s} selected={offered.includes(i)} onClick={onOffer ? () => onOffer(i) : undefined} />
            ))}
          </div>
        ) : (
          <p className="market-empty muted small">{view.phase === 'stock' ? t('game.marketClosed') : t('game.marketEmpty')}</p>
        )}
      </div>

      {latest && (
        <button type="button" key={latest.seq} className="ticker" onClick={onJournal} title={t('game.log')}>
          <span className="ticker-text" aria-live="polite">{logText(latest, view, t)}</span>
          <span className="ticker-more">{t('game.log')} ›</span>
        </button>
      )}
    </section>
  )
}
