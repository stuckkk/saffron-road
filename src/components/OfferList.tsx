import { useTranslation } from 'react-i18next'
import type { Spice } from '../engine/cards'
import { contains } from '../engine/engine'
import type { Action, GameView, Offer } from '../engine/types'
import { SpiceChips } from './SpiceCard'
import { isForMe, isMine } from './turnState'

interface Props {
  view: GameView
  act: (action: Action) => void
}

/** Could I stock all of `cards` right now without selling anything? */
function fitsMyStalls(view: GameView, cards: Spice[]): boolean {
  const stalls = view.players[view.you].stalls
  const free = stalls.filter(s => s.count === 0).length
  const strangers = new Set(cards.filter(c => !stalls.some(s => s.count > 0 && s.spice === c)))
  return strangers.size <= free
}

function Side({ label, own, market }: { label: string; own: Spice[]; market: Spice[] }) {
  const { t } = useTranslation()
  return (
    <div className="offer-side">
      <span className="offer-label">{label}</span>
      <span className="offer-cards">
        <SpiceChips cards={own} />
        <SpiceChips cards={market} tag={t('trade.marketTag')} />
        {own.length + market.length === 0 && <span className="muted">{t('trade.nothing')}</span>}
      </span>
    </div>
  )
}

/** An offer I am part of, told from my side of the table: what I give, what I get. */
function MyOffer({ offer, view, act }: Props & { offer: Offer }) {
  const { t } = useTranslation()
  const mine = isMine(offer, view)
  const me = view.players[view.you]
  const affordable = contains(me.caravan ?? [], offer.want)
  const received = [...offer.give, ...offer.giveFromMarket]
  const title = mine
    ? t('trade.yourOfferTo', { name: offer.to === null ? t('trade.forAnyone') : view.players[offer.to].name })
    : t('trade.offerFrom', { name: view.players[offer.from].name })
  return (
    <li className={`offer ${mine ? '' : 'offer-for-me'}`}>
      <div className="offer-head">{title}</div>
      {mine ? (
        <>
          <Side label={t('trade.give')} own={offer.give} market={offer.giveFromMarket} />
          <Side label={t('trade.get')} own={offer.want} market={offer.wantFromMarket} />
        </>
      ) : (
        <>
          <Side label={t('trade.give')} own={offer.want} market={offer.wantFromMarket} />
          <Side label={t('trade.get')} own={offer.give} market={offer.giveFromMarket} />
        </>
      )}
      {!mine && !affordable && <p className="small offer-note is-warn">{t('trade.cantAccept')}</p>}
      {!mine && affordable && received.length > 0 && (
        <p className={`small offer-note ${fitsMyStalls(view, received) ? '' : 'is-warn'}`}>
          {fitsMyStalls(view, received) ? t('trade.fits') : t('trade.needsRoom')}
        </p>
      )}
      <div className="btn-row">
        {mine && <button type="button" className="btn btn-small" onClick={() => act({ type: 'withdraw', offerId: offer.id })}>{t('trade.withdraw')}</button>}
        {!mine && (
          <button type="button" className="btn btn-primary btn-small" disabled={!affordable} onClick={() => act({ type: 'accept', offerId: offer.id })}>
            {t('trade.accept')}
          </button>
        )}
        {!mine && offer.to === view.you && (
          <button type="button" className="btn btn-small" onClick={() => act({ type: 'reject', offerId: offer.id })}>{t('trade.reject')}</button>
        )}
      </div>
    </li>
  )
}

export function OfferList({ view, act }: Props) {
  const { t } = useTranslation()
  const forMe = view.offers.filter(o => isForMe(o, view))
  const mine = view.offers.filter(o => isMine(o, view))
  const others = view.offers.filter(o => !isForMe(o, view) && !isMine(o, view))
  if (view.offers.length === 0) return <p className="muted small">{t('trade.none')}</p>
  return (
    <>
      {forMe.length + mine.length > 0 && (
        <ul className="offers">
          {[...forMe, ...mine].map(o => <MyOffer key={o.id} offer={o} view={view} act={act} />)}
        </ul>
      )}
      {others.length > 0 && (
        <details className="other-offers">
          <summary>{t('trade.others', { n: others.length })}</summary>
          <ul>
            {others.map(o => (
              <li key={o.id} className="small">
                <b>{view.players[o.from].name}</b> → <b>{o.to === null ? t('trade.forAnyone') : view.players[o.to].name}</b>:{' '}
                <SpiceChips cards={o.give} /><SpiceChips cards={o.giveFromMarket} tag={t('trade.marketTag')} />
                {o.give.length + o.giveFromMarket.length === 0 && <span className="muted">{t('trade.nothing')}</span>}
                {' '}<span className="muted">{t('trade.for')}</span>{' '}
                <SpiceChips cards={o.want} /><SpiceChips cards={o.wantFromMarket} tag={t('trade.marketTag')} />
                {o.want.length + o.wantFromMarket.length === 0 && <span className="muted">{t('trade.nothing')}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  )
}
