import { createContext, useContext, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { SPICE_INFO, type Spice } from '../engine/cards'

export const SPICE_COLOR: Record<Spice, string> = {
  pepper: '#4a4a55',
  cumin: '#a9772f',
  cinnamon: '#b4532a',
  ginger: '#c99a2e',
  clove: '#7a3b4e',
  cardamom: '#5f8f4e',
  nutmeg: '#8a5a3c',
  vanilla: '#3f6f8f',
  saffron: '#d9480f',
}

/** The spice the Royal Order currently names; cards and stalls of it carry a crown. */
export const RoyalContext = createContext<Spice | null>(null)

const ICONS: Record<Spice, ReactNode> = {
  pepper: (
    <g fill="currentColor">
      <circle cx="9" cy="9" r="3.4" /><circle cx="16.5" cy="7.5" r="3" /><circle cx="13" cy="15" r="3.6" /><circle cx="6.5" cy="16.5" r="2.6" /><circle cx="19" cy="14.5" r="2.4" />
    </g>
  ),
  cumin: (
    <g fill="currentColor">
      <ellipse cx="8" cy="9" rx="2" ry="5.5" transform="rotate(-30 8 9)" /><ellipse cx="16" cy="8.5" rx="2" ry="5.5" transform="rotate(25 16 8.5)" /><ellipse cx="12" cy="17" rx="2" ry="5.5" transform="rotate(80 12 17)" />
    </g>
  ),
  cinnamon: (
    <g fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round">
      <path d="M5 19 17 5" /><path d="M9 20 20 9" />
    </g>
  ),
  ginger: (
    <g fill="currentColor">
      <ellipse cx="11" cy="13" rx="6.5" ry="4" transform="rotate(-20 11 13)" /><circle cx="17.5" cy="8" r="3.2" /><circle cx="6" cy="8.5" r="2.6" /><circle cx="17" cy="17" r="2.4" />
    </g>
  ),
  clove: (
    <g fill="currentColor" stroke="currentColor" strokeLinecap="round">
      <path d="M12 11v9" strokeWidth="2.6" fill="none" /><circle cx="12" cy="7.5" r="3" /><path d="M7 9l3 2M17 9l-3 2" strokeWidth="2" fill="none" />
    </g>
  ),
  cardamom: (
    <g>
      <path d="M12 3c5 4 5 14 0 18-5-4-5-14 0-18z" fill="currentColor" /><path d="M12 6v12" stroke="#fff" strokeOpacity=".55" strokeWidth="1.2" />
    </g>
  ),
  nutmeg: (
    <g>
      <ellipse cx="12" cy="12" rx="6.5" ry="8" fill="currentColor" /><path d="M8 8c3 2 5 2 8 0M7 13c3 2 7 2 10 0" stroke="#fff" strokeOpacity=".5" strokeWidth="1.2" fill="none" />
    </g>
  ),
  vanilla: (
    <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M6 4c-1 7 1 12 4 17" /><path d="M12 3c0 7 1 12 3 17" /><path d="M18 4c1 6 0 11-1 15" />
    </g>
  ),
  saffron: (
    <g fill="currentColor">
      <path d="M12 3c2 4 2 8 0 11-2-3-2-7 0-11zM4 8c4 0 7 2 8 6-4 0-7-2-8-6zM20 8c-4 0-7 2-8 6 4 0 7-2 8-6z" /><path d="M12 14v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </g>
  ),
}

export function SpiceIcon({ spice, size = 20 }: { spice: Spice; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={{ color: SPICE_COLOR[spice], flex: 'none' }}>
      {ICONS[spice]}
    </svg>
  )
}

export function Crown({ size = 14 }: { size?: number }) {
  const { t } = useTranslation()
  return (
    <svg className="crown" viewBox="0 0 24 24" width={size} height={size} role="img" aria-label={t('game.royalOrder')}>
      <title>{t('game.royalOrder')}: {t('game.royalHint')}</title>
      <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z" fill="currentColor" />
    </svg>
  )
}

/**
 * The sale table of one spice: card counts on top, the gold they pay below.
 * With `count`, the steps a stall has already reached are lit and the next one is marked.
 */
export function Ladder({ spice, count }: { spice: Spice; count?: number }) {
  const royal = useContext(RoyalContext) === spice
  const sales = SPICE_INFO[spice].sales
  const next = count === undefined ? -1 : sales.findIndex(([cards]) => cards > count)
  return (
    <span className="ladder" aria-hidden="true">
      {sales.map(([cards, gold], i) => (
        <span key={cards} className={`rung ${count !== undefined && count >= cards ? 'is-reached' : ''} ${i === next ? 'is-next' : ''}`}>
          <span className="rung-cards">{cards}</span>
          <span className="rung-gold">{royal && count !== undefined ? gold + 1 : gold}</span>
        </span>
      ))}
    </span>
  )
}

interface CardProps {
  spice: Spice
  small?: boolean
  selected?: boolean
  tag?: string
  onClick?: () => void
}

/** A spice card: icon, name and its sale table. */
export function SpiceCard({ spice, small, selected, tag, onClick }: CardProps) {
  const { t } = useTranslation()
  const royal = useContext(RoyalContext) === spice
  const cls = ['card', small && 'card-sm', selected && 'card-selected', onClick && 'card-click'].filter(Boolean).join(' ')
  const body = (
    <>
      {tag && <span className="card-tag">{tag}</span>}
      {royal && <span className="card-crown"><Crown size={small ? 11 : 13} /></span>}
      <SpiceIcon spice={spice} size={small ? 22 : 30} />
      <span className="card-name">{t(`spice.${spice}`)}</span>
      {!small && <Ladder spice={spice} />}
    </>
  )
  const style = { '--spice': SPICE_COLOR[spice] } as React.CSSProperties
  return onClick ? (
    <button type="button" className={cls} style={style} onClick={onClick} aria-pressed={selected}>{body}</button>
  ) : (
    <div className={cls} style={style}>{body}</div>
  )
}

/** Compact inline mention of some cards, e.g. in an offer. With `onRemove` each chip is a button. */
export function SpiceChips({ cards, tag, onRemove }: { cards: Spice[]; tag?: string; onRemove?: (index: number) => void }) {
  const { t } = useTranslation()
  return (
    <>
      {cards.map((s, i) => {
        const style = { '--spice': SPICE_COLOR[s] } as React.CSSProperties
        const body = (
          <>
            <SpiceIcon spice={s} size={14} />
            {t(`spice.${s}`)}
            {tag && <em>{tag}</em>}
          </>
        )
        return onRemove ? (
          <button key={i} type="button" className="chip chip-remove" style={style} onClick={() => onRemove(i)}>
            {body}<span aria-hidden="true">×</span><span className="sr-only"> {t('trade.remove')}</span>
          </button>
        ) : (
          <span key={i} className="chip" style={style}>{body}</span>
        )
      })}
    </>
  )
}
