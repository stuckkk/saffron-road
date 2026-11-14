import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Action } from '../engine/types'
import type { Session } from '../network/useSession'
import { ActionBar } from './ActionBar'
import { EndScreen } from './EndScreen'
import { GameMenu } from './Menu'
import { MyArea } from './MyArea'
import { emptyDraft, OfferBuilder, toggled, type Draft } from './OfferBuilder'
import { OfferList } from './OfferList'
import { Opponents } from './Opponents'
import { SidePanel, type SideTab } from './SidePanel'
import { RoyalContext } from './SpiceCard'
import { TableCentre } from './TableCentre'
import { isForMe, turnState } from './turnState'

/**
 * The table. Its zones keep their place in every phase:
 * the others on top, the market in the middle, the action bar, my stalls and caravan, offers and journal at the side.
 */
export function Game({ session, onRules }: { session: Session; onRules: () => void }) {
  const { t } = useTranslation()
  const view = session.view!
  const room = session.room!
  const isHost = room.hostId === session.seatId
  const act = (action: Action) => session.send({ type: 'action', action })

  const [pick, setPick] = useState(0)
  const ts = turnState(view, pick, t)
  const market = view.phase === 'market'
  const ended = view.phase === 'ended'

  // Card positions shift whenever the market or my caravan changes: the draft starts afresh then.
  const draftKey = `${view.turn}|${view.market.join()}|${ts.caravan.join()}`
  const [stored, setStored] = useState<Draft>(emptyDraft(''))
  const draft = market && stored.key === draftKey ? stored : emptyDraft(draftKey)
  const change = (patch: Partial<Draft>) => setStored({ ...draft, ...patch })
  const [builderTurn, setBuilderTurn] = useState(-1)
  const building = market && builderTurn === view.turn

  const [tab, setTab] = useState<SideTab>('offers')
  const [sideOpen, setSideOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const openBuilder = (patch: Partial<Draft> = {}) => {
    change(patch)
    setBuilderTurn(view.turn)
    setTab('offers')
    setSideOpen(true)
  }
  const closeBuilder = () => {
    setBuilderTurn(-1)
    setStored(emptyDraft(''))
  }
  const waiting = view.offers.filter(o => isForMe(o, view)).length
  const leave = () => session.send({ type: 'leave' })

  return (
    <RoyalContext.Provider value={view.royalOrder}>
      <main className="game">
        <header className="g-head">
          <h1>{t('app.title')}</h1>
          <span className="badge" title={t('lobby.table', { id: room.id })}>{room.id}</span>
          <GameMenu onRules={onRules} onLeave={() => (ended ? leave() : setLeaving(true))} />
        </header>

        <Opponents view={view} room={room} onHandToAI={isHost ? seatId => session.send({ type: 'replaceWithAI', seatId }) : undefined} />

        <TableCentre
          view={view} offered={draft.market}
          onOffer={market ? i => openBuilder({ market: toggled(draft.market, i) }) : undefined}
          onJournal={() => { setTab('journal'); setSideOpen(true) }}
        />

        {!ended && (
          <ActionBar
            view={view} ts={ts} act={act} waiting={waiting}
            onMakeOffer={() => openBuilder()}
            onOpenSide={() => { setTab('offers'); setSideOpen(true) }}
          />
        )}

        <MyArea
          view={view} ts={ts} act={act} onPick={setPick} offered={draft.give}
          onOffer={market ? i => openBuilder({ give: toggled(draft.give, i) }) : undefined}
        />

        <SidePanel view={view} tab={tab} onTab={setTab} open={sideOpen} onClose={() => setSideOpen(false)} waiting={waiting}>
          {building ? (
            <OfferBuilder view={view} draft={draft} change={change} act={act} onClose={closeBuilder} />
          ) : (
            <>
              <OfferList view={view} act={act} />
              {market ? (
                <button type="button" className="btn" onClick={() => openBuilder()}>{t('trade.make')}</button>
              ) : (
                !ended && <p className="muted small">{t('trade.onlyMarket')}</p>
              )}
            </>
          )}
        </SidePanel>

        {ended && <EndScreen view={view} isHost={isHost} onAgain={() => session.send({ type: 'restart' })} onLeave={leave} />}
        {leaving && (
          <div className="overlay" onClick={() => setLeaving(false)}>
            <div className="sheet end" role="alertdialog" aria-modal="true" onClick={e => e.stopPropagation()}>
              <h2>{t('game.leaveAsk')}</h2>
              <button type="button" className="btn btn-primary" onClick={() => setLeaving(false)}>{t('game.stay')}</button>
              <button type="button" className="btn btn-ghost" onClick={leave}>{t('lobby.leave')}</button>
            </div>
          </div>
        )}
      </main>
    </RoyalContext.Provider>
  )
}
