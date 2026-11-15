import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MAX_STALLS, STALL_COST } from '../engine/cards'
import type { Action, GameView } from '../engine/types'
import { CardDetail } from './CardDetail'
import { Gold } from './Gold'
import { SpiceCard } from './SpiceCard'
import { StallView } from './StallView'
import type { TurnState } from './turnState'

interface Props {
  view: GameView
  ts: TurnState
  act: (action: Action) => void
  onPick: (index: number) => void
  /** Caravan cards currently in the offer draft (indexes). */
  offered: number[]
  /** Set while an offer is being put together: tapping a caravan card adds it to the offer or takes it out. */
  onOffer?: (index: number) => void
  /** Set while the market is open: start an offer with this caravan card (from the card's detail view). */
  onOfferCard?: (index: number) => void
}

/** My side of the table: stalls on top, caravan below. Always in this order, in every phase. */
export function MyArea({ view, ts, act, onPick, offered, onOffer, onOfferCard }: Props) {
  const { t } = useTranslation()
  const { me, caravan, isActive, placing } = ts
  const ended = view.phase === 'ended'
  const stockingFront = placing !== null && !ts.placingPending
  const canBuy = isActive && !ended && me.gold >= STALL_COST
  const [detail, setDetail] = useState<number | null>(null)

  return (
    <section className={`zone mine ${isActive ? 'is-active' : ''}`} aria-label={t('game.stalls')}>
      <div className="zone-head">
        <h2>{t('game.stalls')}</h2>
        <Gold n={me.gold} big />
      </div>

      {me.pending.length > 0 && (
        <div className="pending">
          <h3>{t('game.mustStock')}</h3>
          <div className="cards">
            {me.pending.map((s, i) => (
              <SpiceCard key={i} spice={s} small selected={ts.trading && i === ts.pendingIndex} onClick={() => onPick(i)} />
            ))}
          </div>
        </div>
      )}

      <div className="stalls">
        {me.stalls.map((_, i) => (
          <StallView
            key={i} player={me} index={i} placing={placing} needRoom={ts.needRoom} locked={ended}
            onPlace={() => act(ts.placingPending ? { type: 'stockPending', spice: placing!, stall: i } : { type: 'stock', stall: i })}
            onSell={() => act({ type: 'sell', stall: i })}
          />
        ))}
        {me.stalls.length < MAX_STALLS && !ended && (
          <button type="button" className="stall-buy" disabled={!canBuy} onClick={() => act({ type: 'buyStall' })}>
            <span className="stall-buy-plus" aria-hidden="true">+</span>
            <span>{t('game.buyStall')}</span>
            <span className="small">{t('game.buyStallCost', { gold: STALL_COST })}</span>
            {!isActive && <span className="small muted">{t('game.buyStallWhen')}</span>}
          </button>
        )}
      </div>

      <div className="zone-head">
        <h2>{t('game.caravan')}</h2>
        <span className="muted small">{t('game.caravanOrder')}</span>
      </div>
      {caravan.length ? (
        <div className="cards caravan">
          {caravan.map((s, i) => (
            <SpiceCard
              key={i} spice={s} tag={i === 0 ? t('game.front') : undefined}
              selected={(i === 0 && stockingFront) || offered.includes(i)}
              onClick={onOffer ? () => onOffer(i) : () => setDetail(i)}
            />
          ))}
        </div>
      ) : (
        <p className="muted small">{t('game.caravanEmpty')}</p>
      )}
      {detail !== null && caravan.length > 0 && !onOffer && (
        <CardDetail
          view={view} index={Math.min(detail, caravan.length - 1)} onIndex={setDetail} onClose={() => setDetail(null)}
          onOffer={onOfferCard ? i => { setDetail(null); onOfferCard(i) } : undefined}
        />
      )}
    </section>
  )
}
