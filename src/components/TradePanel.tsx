import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SPICES, type Spice } from '../engine/cards'
import { contains } from '../engine/engine'
import type { Action, GameView, Offer } from '../engine/types'
import { SpiceCard, SpiceChips, SpiceIcon } from './SpiceCard'

interface Props {
  view: GameView
  act: (action: Action) => void
}

function toggle(set: Set<number>, i: number): Set<number> {
  const next = new Set(set)
  if (!next.delete(i)) next.add(i)
  return next
}

function OfferRow({ offer, view, act }: Props & { offer: Offer }) {
  const { t } = useTranslation()
  const me = view.players[view.you]
  const mine = offer.from === view.you
  const forMe = offer.to === view.you || (offer.to === null && view.active !== view.you && !mine)
  const affordable = contains(me.caravan ?? [], offer.want)
  const gives = offer.give.length + offer.giveFromMarket.length
  const wants = offer.want.length + offer.wantFromMarket.length
  return (
    <li className={`offer ${forMe ? 'offer-for-me' : ''}`}>
      <div className="offer-head">
        <b>{mine ? t('lobby.you') : view.players[offer.from].name}</b>
        {' → '}
        <b>{offer.to === null ? t('trade.forAnyone') : offer.to === view.you ? t('trade.you') : view.players[offer.to].name}</b>
      </div>
      <div className="offer-line">
        <span className="offer-verb">{t('trade.gives')}</span>
        <SpiceChips cards={offer.give} />
        <SpiceChips cards={offer.giveFromMarket} tag={t('trade.marketTag')} />
        {gives === 0 && <span className="muted">{t('trade.nothing')}</span>}
      </div>
      <div className="offer-line">
        <span className="offer-verb">{t('trade.wants')}</span>
        <SpiceChips cards={offer.want} />
        <SpiceChips cards={offer.wantFromMarket} tag={t('trade.marketTag')} />
        {wants === 0 && <span className="muted">{t('trade.nothing')}</span>}
      </div>
      <div className="offer-actions">
        {mine && <button type="button" className="btn btn-small" onClick={() => act({ type: 'withdraw', offerId: offer.id })}>{t('trade.withdraw')}</button>}
        {forMe && (
          <button
            type="button" className="btn btn-primary btn-small" disabled={!affordable} title={affordable ? undefined : t('trade.cantAccept')}
            onClick={() => act({ type: 'accept', offerId: offer.id })}
          >
            {affordable ? t('trade.accept') : t('trade.cantAccept')}
          </button>
        )}
        {offer.to === view.you && <button type="button" className="btn btn-small" onClick={() => act({ type: 'reject', offerId: offer.id })}>{t('trade.reject')}</button>}
      </div>
    </li>
  )
}

function OfferBuilder({ view, act }: Props) {
  const { t } = useTranslation()
  const me = view.players[view.you]
  const isActive = view.active === view.you
  const caravan = me.caravan ?? []
  const [to, setTo] = useState<number | null>(null)
  const [give, setGive] = useState<Set<number>>(new Set())
  const [market, setMarket] = useState<Set<number>>(new Set())
  const [want, setWant] = useState<Spice[]>([])

  const marketCards = [...market].map(i => view.market[i])
  const total = give.size + market.size + want.length
  const submit = () => {
    act({
      type: 'propose',
      to: isActive ? to : view.active,
      give: [...give].sort((a, b) => a - b).map(i => caravan[i]),
      giveFromMarket: isActive ? marketCards : [],
      want,
      wantFromMarket: isActive ? [] : marketCards,
    })
    setGive(new Set())
    setMarket(new Set())
    setWant([])
  }

  const marketPicker = view.market.length > 0 && (
    <div className="pick-row">
      <span className="pick-label">{t('trade.fromMarket')}</span>
      <div className="cards">
        {view.market.map((s, i) => (
          <SpiceCard key={i} spice={s} small selected={market.has(i)} onClick={() => setMarket(toggle(market, i))} />
        ))}
      </div>
    </div>
  )

  return (
    <div className="builder">
      <h4>{t('trade.new')}</h4>
      {isActive && (
        <label className="pick-row">
          <span className="pick-label">{t('trade.to')}</span>
          <select value={to ?? ''} onChange={e => setTo(e.target.value === '' ? null : Number(e.target.value))}>
            <option value="">{t('trade.anyone')}</option>
            {view.players.map((p, i) => i !== view.you && <option key={i} value={i}>{p.name}</option>)}
          </select>
        </label>
      )}
      <div className="builder-side">
        <h5>{t('trade.give')}</h5>
        {caravan.length > 0 && (
          <div className="pick-row">
            <span className="pick-label">{t('trade.fromCaravan')}</span>
            <div className="cards">
              {caravan.map((s, i) => (
                <SpiceCard key={i} spice={s} small selected={give.has(i)} onClick={() => setGive(toggle(give, i))} />
              ))}
            </div>
          </div>
        )}
        {isActive && marketPicker}
      </div>
      <div className="builder-side">
        <h5>{t('trade.want')}</h5>
        {!isActive && marketPicker}
        <div className="pick-row">
          <span className="pick-label">{t('trade.fromTheirCaravan')}</span>
          <div className="palette" aria-label={t('trade.addWanted')}>
            {SPICES.map(s => (
              <button key={s} type="button" className="palette-btn" title={t(`spice.${s}`)} aria-label={t(`spice.${s}`)} disabled={want.length >= 6} onClick={() => setWant([...want, s])}>
                <SpiceIcon spice={s} size={20} />
              </button>
            ))}
          </div>
        </div>
        {want.length > 0 && (
          <div className="cards">
            {want.map((s, i) => (
              <SpiceCard key={i} spice={s} small selected onClick={() => setWant(want.filter((_, j) => j !== i))} />
            ))}
          </div>
        )}
        {want.length === 0 && <p className="muted small">{t('trade.addWanted')}</p>}
      </div>
      <button type="button" className="btn btn-primary" disabled={total === 0} onClick={submit}>{t('trade.send')}</button>
    </div>
  )
}

export function TradePanel({ view, act }: Props) {
  const { t } = useTranslation()
  // Card positions shift whenever the market or the caravan changes: start the draft afresh then.
  const draftKey = `${view.turn}|${view.market.join()}|${(view.players[view.you].caravan ?? []).join()}`
  return (
    <section className="panel trade">
      <h3>{t('trade.offers')}</h3>
      {view.offers.length === 0 ? (
        <p className="muted small">{t('trade.none')}</p>
      ) : (
        <ul className="offers">
          {view.offers.map(o => <OfferRow key={o.id} offer={o} view={view} act={act} />)}
        </ul>
      )}
      <OfferBuilder key={draftKey} view={view} act={act} />
    </section>
  )
}
