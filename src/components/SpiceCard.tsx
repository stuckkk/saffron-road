import type { ReactNode } from 'react'
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

interface CardProps {
  spice: Spice
  small?: boolean
  selected?: boolean
  dimmed?: boolean
  tag?: string
  onClick?: () => void
}

/** A spice card: icon, name and the card counts that pay 1/2/3/4 gold. */
export function SpiceCard({ spice, small, selected, dimmed, tag, onClick }: CardProps) {
  const { t } = useTranslation()
  const cls = ['card', small && 'card-sm', selected && 'card-selected', dimmed && 'card-dimmed', onClick && 'card-click']
    .filter(Boolean).join(' ')
  const body = (
    <>
      {tag && <span className="card-tag">{tag}</span>}
      <SpiceIcon spice={spice} size={small ? 22 : 30} />
      <span className="card-name">{t(`spice.${spice}`)}</span>
      {!small && (
        <span className="card-sales" aria-hidden="true">
          {SPICE_INFO[spice].sales.map(([cards, gold]) => (
            <span key={gold}><b>{cards}</b>→{gold}</span>
          ))}
        </span>
      )}
    </>
  )
  const style = { '--spice': SPICE_COLOR[spice] } as React.CSSProperties
  return onClick ? (
    <button type="button" className={cls} style={style} onClick={onClick} aria-pressed={selected}>{body}</button>
  ) : (
    <div className={cls} style={style}>{body}</div>
  )
}

/** Compact inline mention of some cards, e.g. in an offer. */
export function SpiceChips({ cards, tag }: { cards: Spice[]; tag?: string }) {
  const { t } = useTranslation()
  return (
    <>
      {cards.map((s, i) => (
        <span key={i} className="chip" style={{ '--spice': SPICE_COLOR[s] } as React.CSSProperties}>
          <SpiceIcon spice={s} size={14} />
          {t(`spice.${s}`)}
          {tag && <em>{tag}</em>}
        </span>
      ))}
    </>
  )
}
