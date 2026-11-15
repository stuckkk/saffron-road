import { useTranslation } from 'react-i18next'
import { stallSaleValue } from '../engine/engine'
import type { GameView } from '../engine/types'
import type { RoomInfo } from '../network/protocol'
import { Gold } from './Gold'
import { SPICE_COLOR, SpiceChips, SpiceIcon } from './SpiceCard'

interface Props {
  view: GameView
  room: RoomInfo
  /** Present for the host: hand the seat of a player who dropped out to an AI. */
  onHandToAI?: (seatId: string) => void
}

/** The other merchants, in turn order starting with whoever plays after me. */
export function Opponents({ view, room, onHandToAI }: Props) {
  const { t } = useTranslation()
  const n = view.players.length
  const order = view.players.map((_, i) => i).filter(i => i !== view.you).sort((a, b) => ((a - view.you + n) % n) - ((b - view.you + n) % n))
  return (
    <section className="opponents" aria-label={t('game.opponents')}>
      {order.map(i => {
        const p = view.players[i]
        const seat = room.seats[i]
        const offline = !!seat && !seat.connected
        const active = view.active === i
        return (
          <div key={i} className={`opponent ${active ? 'is-active' : ''}`}>
            <div className="opponent-head">
              <span className="seat-name">{p.name}</span>
              {p.isAI && <span className="badge">{t('lobby.ai')}</span>}
              {offline && <span className="badge badge-warn">{t('lobby.offline')}</span>}
              <Gold n={p.gold} />
            </div>
            <div className="opponent-meta small">
              {active && view.phase !== 'ended' && <span className="badge badge-gold">{t(`phase.${view.phase}`)}</span>}
              {!active && view.phase === 'market' && p.doneTrading && <span className="badge">{t('trade.doneBadge')}</span>}
              <span className="muted"><span className="card-back" aria-hidden="true" /> {t('game.cards', { count: p.caravanCount })}</span>
            </div>
            <ul className="mini-stalls">
              {p.stalls.map((st, s) => (
                <li key={s} className={`mini-stall ${st.spice ? '' : 'is-empty'}`} style={st.spice ? ({ '--spice': SPICE_COLOR[st.spice] } as React.CSSProperties) : undefined}>
                  {st.spice ? (
                    <>
                      <SpiceIcon spice={st.spice} size={16} />
                      <span className="mini-name">{t(`spice.${st.spice}`)}</span>
                      <b>×{st.count}</b>
                      <span className="mini-worth" title={t('game.worth', { gold: stallSaleValue(st.spice, st.count) })}>
                        {stallSaleValue(st.spice, st.count)}
                      </span>
                    </>
                  ) : (
                    t('game.empty')
                  )}
                </li>
              ))}
            </ul>
            {p.pending.length > 0 && (
              <div className="small"><SpiceChips cards={p.pending} /> <span className="muted">{t('game.toStock')}</span></div>
            )}
            {onHandToAI && offline && seat && view.phase !== 'ended' && (
              <button type="button" className="btn btn-small" onClick={() => onHandToAI(seat.id)}>{t('game.handToAI')}</button>
            )}
          </div>
        )
      })}
    </section>
  )
}
