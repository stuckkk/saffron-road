import { useContext, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SPICE_INFO, type Spice } from '../engine/cards'
import { canPlace, canSell, stallSaleValue } from '../engine/engine'
import type { PlayerView } from '../engine/types'
import { Crown, Ladder, RoyalContext, SPICE_COLOR, SpiceIcon } from './SpiceCard'

interface Props {
  player: PlayerView
  index: number
  /** The card waiting to be stocked; a stall that can take it becomes the button for it. */
  placing: Spice | null
  /** Draw attention to selling: the waiting card fits nowhere. */
  needRoom: boolean
  locked: boolean
  onPlace: () => void
  onSell: () => void
}

/** One of my stalls: what it holds, what it pays, and the two things I can do with it. */
export function StallView({ player, index, placing, needRoom, locked, onPlace, onSell }: Props) {
  const { t } = useTranslation()
  const royal = useContext(RoyalContext)
  const st = player.stalls[index]
  // The question is about one particular pile: forget it as soon as the pile changes.
  const pile = `${st.spice}:${st.count}`
  const [askedFor, setAskedFor] = useState<string | null>(null)
  const asking = askedFor === pile

  const value = stallSaleValue(st.spice, st.count, royal ?? 'pepper')
  const next = st.spice ? SPICE_INFO[st.spice].sales.find(([cards]) => cards > st.count) : undefined
  const target = !locked && placing !== null && canPlace(player, placing, index)
  const sellable = !locked && canSell(player, index)
  // Step back only while another stall is the place to tap; if the card fits nowhere, selling needs full attention.
  const elsewhere = !locked && !target && placing !== null && player.stalls.some((_, i) => canPlace(player, placing, i))
  const style = st.spice ? ({ '--spice': SPICE_COLOR[st.spice] } as React.CSSProperties) : undefined

  const pileClass = `pile ${st.spice ? '' : 'pile-free'} ${st.count > 1 ? 'pile-stack' : ''}`

  const content = st.spice ? (
    <>
      <span className="pile-title">
        <SpiceIcon spice={st.spice} size={28} />
        <span className="pile-name">{t(`spice.${st.spice}`)}</span>
        <span className="pile-count">×{st.count}</span>
      </span>
      <Ladder spice={st.spice} count={st.count} />
    </>
  ) : (
    <span className="pile-empty">{t('game.empty')}</span>
  )

  return (
    <div className={`stall ${target ? 'is-target' : ''} ${elsewhere ? 'is-off' : ''}`}>
      <div className="stall-title">
        {t('game.stall', { n: index + 1 })}
        {st.spice && st.spice === royal && <Crown />}
      </div>

      {target ? (
        <button type="button" key={pile} className={pileClass} style={style} onClick={onPlace}>
          {content}
          <span className="pile-cta">{t('game.place', { spice: t(`spice.${placing}`) })}</span>
        </button>
      ) : (
        <div key={pile} className={pileClass} style={style}>{content}</div>
      )}

      {st.spice && (
        <p className="stall-worth small">
          {value > 0 ? t('game.worth', { gold: value }) : t('game.worthNone')}
          <span className="muted"> · {next ? t('game.next', { n: next[0] - st.count, gold: next[1] + (st.spice === royal ? 1 : 0) }) : t('game.maxed')}</span>
        </p>
      )}

      {st.spice && asking && sellable && (
        <div className={`confirm ${value === 0 ? 'confirm-warn' : ''}`} role="group">
          <p className="small">
            {t('game.sellAsk', { n: st.count, spice: t(`spice.${st.spice}`), gold: value })}
            {value === 0 && <> <b>{t('game.sellNothing')}</b></>}
          </p>
          <div className="btn-row">
            <button type="button" className="btn btn-small btn-primary" onClick={() => { setAskedFor(null); onSell() }}>{t('game.sellConfirm')}</button>
            <button type="button" className="btn btn-small" onClick={() => setAskedFor(null)}>{t('game.keep')}</button>
          </div>
        </div>
      )}
      {st.spice && sellable && !asking && (
        <button type="button" className={`btn btn-small stall-sell ${needRoom ? 'is-urged' : value === 0 ? 'btn-ghost' : ''}`} onClick={() => setAskedFor(pile)}>
          {value > 0 ? t('game.sell', { gold: value }) : t('game.sellConfirm')}
        </button>
      )}
      {st.spice && !sellable && !locked && needRoom && <p className="muted small">{t('game.sellBlocked')}</p>}
    </div>
  )
}
