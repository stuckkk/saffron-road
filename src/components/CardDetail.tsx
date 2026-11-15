import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { SPICES, SPICE_INFO, type Spice } from '../engine/cards'
import type { GameView } from '../engine/types'
import { CardCount, SPICE_COLOR, SpiceIcon } from './SpiceCard'

const TOTAL_CARDS = SPICES.reduce((n, s) => n + SPICE_INFO[s].count, 0)

function rarity(spice: Spice): 'common' | 'uncommon' | 'rare' {
  const n = SPICE_INFO[spice].count
  return n >= 16 ? 'common' : n >= 10 ? 'uncommon' : 'rare'
}

interface Props {
  view: GameView
  /** Position of the card in my caravan. */
  index: number
  onIndex: (index: number) => void
  onClose: () => void
  /** Set while the market is open: put this card into a new offer. */
  onOffer?: (index: number) => void
}

/** A closer look at one card of my caravan: how many exist, what a stall of it pays, and where the copies are. */
export function CardDetail({ view, index, onIndex, onClose, onOffer }: Props) {
  const { t } = useTranslation()
  const me = view.players[view.you]
  const caravan = me.caravan ?? []
  const spice = caravan[index]
  const info = SPICE_INFO[spice]
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => closeRef.current?.focus(), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1)
      else if (e.key === 'ArrowRight' && index < caravan.length - 1) onIndex(index + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, caravan.length, onIndex, onClose])

  // Only what this player can see: their own caravan, every stall and delivery, and the market.
  const inCaravan = caravan.filter(s => s === spice).length
  const onStalls = view.players.reduce(
    (n, p) => n + p.stalls.reduce((m, st) => m + (st.spice === spice ? st.count : 0), 0) + p.pending.filter(s => s === spice).length, 0)
  const inMarket = view.market.filter(s => s === spice).length
  const asGold = view.goldCards[spice]
  const unknown = Math.max(0, info.count - inCaravan - onStalls - inMarket - asGold)
  const parts = [
    { key: 'inCaravan', n: inCaravan },
    { key: 'onStalls', n: onStalls },
    { key: 'inMarket', n: inMarket },
    { key: 'asGold', n: asGold },
    { key: 'unknown', n: unknown },
  ]

  const myStall = me.stalls.findIndex(st => st.spice === spice)
  const stall = myStall >= 0 ? me.stalls[myStall] : null
  const next = stall ? info.sales.find(([cards]) => cards > stall.count) : undefined
  const name = t(`spice.${spice}`)
  const style = { '--spice': SPICE_COLOR[spice] } as React.CSSProperties

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet spice-sheet" style={style} role="dialog" aria-modal="true" aria-label={name} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <span className="muted small">{t('detail.position', { n: index + 1, total: caravan.length })}</span>
          <button ref={closeRef} type="button" className="btn btn-ghost" onClick={onClose}>{t('app.close')}</button>
        </div>

        <div className="spice-hero">
          <button type="button" className="hero-nav" disabled={index === 0} onClick={() => onIndex(index - 1)} aria-label={t('detail.prev')}>‹</button>
          <div key={index} className="hero-card">
            {index === 0 && <span className="card-tag">{t('game.front')}</span>}
            <CardCount spice={spice} />
            <SpiceIcon spice={spice} size={72} />
            <h2>{name}</h2>
            <span className="hero-rarity">{t(`detail.${rarity(spice)}`)}</span>
            <span className="hero-total">{t('detail.ofTotal', { count: info.count, total: TOTAL_CARDS })}</span>
          </div>
          <button type="button" className="hero-nav" disabled={index === caravan.length - 1} onClick={() => onIndex(index + 1)} aria-label={t('detail.next')}>›</button>
        </div>
        {index === 0 && <p className="center small hero-note">{t('detail.front')}</p>}
        {onOffer && (
          <button type="button" className="btn btn-primary" onClick={() => onOffer(index)}>{t('detail.offer', { spice: name })}</button>
        )}

        <section>
          <h3>{t('detail.sales')}</h3>
          <ol className="steps-track" style={{ gridTemplateColumns: `repeat(${info.sales.length}, minmax(0, 1fr))` }}>
            {info.sales.map(([cards, gold]) => {
              const reached = !!stall && stall.count >= cards
              const isNext = next?.[0] === cards
              return (
                <li key={cards} className={`track-step ${reached ? 'is-reached' : ''} ${isNext ? 'is-next' : ''}`}>
                  <span className="track-cards">{t('game.cards', { count: cards })}</span>
                  <span className="track-coins" aria-hidden="true">
                    {Array.from({ length: gold }, (_, i) => <i key={i} className="coin" />)}
                  </span>
                  <span className="track-gold">{t('detail.gold', { gold })}</span>
                </li>
              )
            })}
          </ol>
          <p className="small">
            {stall ? (
              <>
                <b>{t('detail.yourStall', { n: myStall + 1, count: stall.count })}</b>
                <span className="muted"> · {next ? t('game.next', { n: next[0] - stall.count, gold: next[1] }) : t('game.maxed')}</span>
              </>
            ) : (
              <span className="muted">{t('detail.noStall', { spice: name })}</span>
            )}
          </p>
        </section>

        <section>
          <h3>{t('detail.where', { count: info.count })}</h3>
          <div className="where-bar" aria-hidden="true">
            {parts.map(p => p.n > 0 && <span key={p.key} className={`where-${p.key}`} style={{ flexGrow: p.n }} />)}
          </div>
          <ul className="where-legend small">
            {parts.map(p => (
              <li key={p.key} className={p.n === 0 ? 'is-zero' : ''}>
                <i className={`where-${p.key}`} aria-hidden="true" />
                <span>{t(`detail.${p.key}`)}</span>
                <b>{p.n}</b>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
