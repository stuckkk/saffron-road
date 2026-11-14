import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { GameView } from '../engine/types'
import { logText } from './turnState'

export type SideTab = 'offers' | 'journal'

interface Props {
  view: GameView
  tab: SideTab
  onTab: (tab: SideTab) => void
  /** Phones show the panel as a sheet from the bottom; on wide screens it is always there. */
  open: boolean
  onClose: () => void
  waiting: number
  /** The offers tab: list or builder. */
  children: ReactNode
}

export function SidePanel({ view, tab, onTab, open, onClose, waiting, children }: Props) {
  const { t } = useTranslation()
  return (
    <>
      {open && <div className="side-backdrop" onClick={onClose} />}
      <aside className={`zone side ${open ? 'is-open' : ''}`}>
        <div className="side-head">
          <div className="tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'offers'} onClick={() => onTab('offers')}>
              {t('trade.offers')}
              {waiting > 0 && <span className="count">{waiting}</span>}
            </button>
            <button type="button" role="tab" aria-selected={tab === 'journal'} onClick={() => onTab('journal')}>{t('game.log')}</button>
          </div>
          <button type="button" className="btn btn-ghost btn-small side-close" onClick={onClose}>{t('app.close')}</button>
        </div>
        <div className="side-body" role="tabpanel">
          {tab === 'offers' ? children : (
            <ol className="journal">
              {view.log.slice().reverse().map(e => <li key={e.seq}>{logText(e, view, t)}</li>)}
            </ol>
          )}
        </div>
      </aside>
    </>
  )
}
