import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { MAX_STALLS, SPICE_INFO, STALL_COST, type Spice } from '../engine/cards'
import { canPlace, canSell, stallSaleValue } from '../engine/engine'
import type { Action, GameView, LogEntry, PlayerView, Stall } from '../engine/types'
import type { Session } from '../network/useSession'
import { SpiceCard, SpiceChips, SpiceIcon } from './SpiceCard'
import { TradePanel } from './TradePanel'

function nextStep(st: Stall): { n: number; gold: number } | null {
  if (!st.spice) return null
  const step = SPICE_INFO[st.spice].sales.find(([cards]) => cards > st.count)
  return step ? { n: step[0] - st.count, gold: step[1] } : null
}

function Gold({ n }: { n: number }) {
  const { t } = useTranslation()
  return <span className="gold" title={t('game.gold')}><span className="coin" aria-hidden="true" />{n}<span className="sr-only"> {t('game.gold')}</span></span>
}

function Opponent({ player, active, offline, onHandToAI }: { player: PlayerView; active: boolean; offline: boolean; onHandToAI?: () => void }) {
  const { t } = useTranslation()
  return (
    <div className={`opponent ${active ? 'is-active' : ''}`}>
      <div className="opponent-head">
        <span className="seat-name">{player.name}</span>
        {player.isAI && <span className="badge">{t('lobby.ai')}</span>}
        {offline && <span className="badge badge-warn">{t('lobby.offline')}</span>}
        <Gold n={player.gold} />
      </div>
      <div className="opponent-stalls">
        {player.stalls.map((st, i) => (
          <span key={i} className="mini-stall">
            {st.spice ? <><SpiceIcon spice={st.spice} size={16} />{t(`spice.${st.spice}`)} ×{st.count}</> : <span className="muted">{t('game.empty')}</span>}
          </span>
        ))}
      </div>
      <div className="opponent-foot muted small">
        {t('game.caravanOf')}: {t('game.cards', { count: player.caravanCount })}
      </div>
      {player.pending.length > 0 && (
        <div className="opponent-pending small"><SpiceChips cards={player.pending} /> <span className="muted">{t('game.toStock')}</span></div>
      )}
      {onHandToAI && <button type="button" className="btn btn-small" onClick={onHandToAI}>{t('game.handToAI')}</button>}
    </div>
  )
}

function Journal({ view }: { view: GameView }) {
  const { t } = useTranslation()
  const [all, setAll] = useState(false)
  const text = (e: LogEntry) =>
    t(`log.${e.key}`, {
      player: e.player !== undefined ? view.players[e.player].name : '',
      other: e.other !== undefined ? view.players[e.other].name : '',
      spice: e.spice ? t(`spice.${e.spice}`) : '',
      n: e.n,
      gold: e.gold,
    })
  const entries = view.log.slice().reverse().slice(0, all ? undefined : 5)
  return (
    <section className="panel journal">
      <div className="panel-head">
        <h3>{t('game.log')}</h3>
        <button type="button" className="btn btn-ghost btn-small" onClick={() => setAll(!all)}>{all ? t('game.showLess') : t('game.showAll')}</button>
      </div>
      <ol aria-live="polite">
        {entries.map(e => <li key={e.seq}>{text(e)}</li>)}
      </ol>
    </section>
  )
}

function EndScreen({ view, isHost, onAgain, onLeave }: { view: GameView; isHost: boolean; onAgain: () => void; onLeave: () => void }) {
  const { t } = useTranslation()
  const winners = view.winners ?? []
  const ranking = view.players.map((p, i) => ({ p, i })).sort((a, b) => b.p.gold - a.p.gold || b.p.caravanCount - a.p.caravanCount)
  return (
    <div className="overlay">
      <div className="sheet end" role="dialog" aria-modal="true">
        <p className="muted">{t('game.over')}</p>
        <h2>
          {winners.length === 1
            ? t('game.winner', { name: view.players[winners[0]].name })
            : t('game.winners', { names: winners.map(i => view.players[i].name).join(', ') })}
        </h2>
        <ol className="ranking">
          {ranking.map(({ p, i }) => (
            <li key={i} className={winners.includes(i) ? 'is-winner' : ''}>
              <span className="seat-name">{p.name}{i === view.you && <span className="badge">{t('lobby.you')}</span>}</span>
              <Gold n={p.gold} />
            </li>
          ))}
        </ol>
        {isHost ? <button type="button" className="btn btn-primary" onClick={onAgain}>{t('game.again')}</button> : <p className="muted small">{t('game.waitAgain')}</p>}
        <button type="button" className="btn btn-ghost" onClick={onLeave}>{t('lobby.leave')}</button>
      </div>
    </div>
  )
}

export function Game({ session, tools }: { session: Session; tools: ReactNode }) {
  const { t } = useTranslation()
  const view = session.view!
  const room = session.room!
  const me = view.players[view.you]
  const caravan = me.caravan ?? []
  const isActive = view.active === view.you
  const isHost = room.hostId === session.seatId
  const activeName = view.players[view.active].name
  const act = (action: Action) => session.send({ type: 'action', action })
  const [pick, setPick] = useState(0)

  const trading = view.phase === 'market' || view.phase === 'deliver'
  const pendingIndex = Math.min(pick, me.pending.length - 1)
  const pendingSpice: Spice | null = trading && me.pending.length ? me.pending[pendingIndex] : null
  const frontSpice: Spice | null =
    !pendingSpice && isActive && view.phase === 'stock' && view.stocked < 2 ? caravan[0] ?? null : null
  const placing = pendingSpice ?? frontSpice
  const fits = placing ? me.stalls.some((_, i) => canPlace(me, placing, i)) : true
  const placeOn = (stall: number) =>
    act(pendingSpice ? { type: 'stockPending', spice: pendingSpice, stall } : { type: 'stock', stall })

  let hint = ''
  if (view.phase === 'stock') {
    if (!isActive) hint = t('hint.wait', { name: activeName })
    else if (view.stocked === 0 && caravan.length === 0) hint = t('hint.stockNone')
    else if (view.stocked === 0) hint = fits ? t('hint.stockFirst') : t('hint.needRoom', { spice: t(`spice.${placing}`) })
    else hint = t('hint.stockMore')
  } else if (trading) {
    const waiting = view.players.filter(p => p.pending.length > 0).map(p => p.name)
    if (placing && !fits) hint = t('hint.needRoom', { spice: t(`spice.${placing}`) })
    else if (me.pending.length) hint = t('hint.deliverYou')
    else if (view.phase === 'deliver') hint = t('hint.deliverWait', { names: waiting.join(', ') })
    else hint = isActive ? t('hint.marketActive') : t('hint.marketOther', { name: activeName })
  }

  const others = view.players.map((p, i) => ({ p, i })).filter(x => x.i !== view.you)
  others.sort((a, b) => ((a.i - view.you + view.players.length) % view.players.length) - ((b.i - view.you + view.players.length) % view.players.length))
  const leave = () => {
    if (view.phase === 'ended' || window.confirm(t('lobby.leave') + '?')) session.send({ type: 'leave' })
  }

  return (
    <main className="game">
      <header className="topbar">
        <div className="topbar-title">
          <h1>{t('app.title')}</h1>
          <span className="badge">{room.id}</span>
        </div>
        <div className="topbar-stats">
          <span className="stat">{t('game.deck')} <b>{view.deckCount}</b></span>
          <span className="stat">{t('game.discard')} <b>{view.discardCount}</b></span>
          <span className={`stat ${view.finalRound ? 'stat-alert' : ''}`}>
            {view.finalRound ? t('game.finalRound') : t('game.pass', { n: Math.min(view.runOuts + 1, view.runOutLimit), max: view.runOutLimit })}
          </span>
          <span className="stat royal" title={t('game.royalHint')}>
            {t('game.royalOrder')}: <SpiceIcon spice={view.royalOrder} size={16} /> <b>{t(`spice.${view.royalOrder}`)}</b> <span className="muted">({t('game.royalHint')})</span>
          </span>
        </div>
        <div className="tools">
          {tools}
          <button type="button" className="btn btn-ghost btn-small" onClick={leave}>{t('game.leave')}</button>
        </div>
      </header>

      <section className="opponents" aria-label="Opponents">
        {others.map(({ p, i }) => {
          const seat = room.seats[i]
          const offline = !!seat && !seat.connected
          return (
            <Opponent
              key={i} player={p} active={view.active === i} offline={offline}
              onHandToAI={isHost && offline && view.phase !== 'ended' ? () => session.send({ type: 'replaceWithAI', seatId: seat.id }) : undefined}
            />
          )
        })}
      </section>

      <div className={`turn-banner ${isActive ? 'is-mine' : ''}`} role="status">
        <b>{isActive ? t('game.yourTurn') : t('game.turnOf', { name: activeName })}</b>
        <span>{hint}</span>
      </div>

      <div className="columns">
        <div className="col">
          {trading && (
            <section className="panel">
              <h3>{t('game.market')}</h3>
              {view.market.length ? (
                <div className="cards">{view.market.map((s, i) => <SpiceCard key={i} spice={s} />)}</div>
              ) : (
                <p className="muted small">{t('game.marketEmpty')}</p>
              )}
              {isActive && view.phase === 'market' && (
                <div className="action-row">
                  <button type="button" className="btn btn-primary" onClick={() => act({ type: 'closeMarket' })}>{t('game.closeMarket')}</button>
                  {view.market.length > 0 && <span className="muted small">{t('game.closeMarketHint')}</span>}
                </div>
              )}
            </section>
          )}
          {view.phase === 'market' && <TradePanel view={view} act={act} />}
          <Journal view={view} />
        </div>

        <div className="col">
          <section className={`panel mine ${isActive ? 'is-active' : ''}`}>
            <div className="panel-head">
              <h3>{t('game.stalls')}</h3>
              <Gold n={me.gold} />
            </div>

            {me.pending.length > 0 && (
              <div className="pending">
                <h4>{t('game.mustStock')}</h4>
                <div className="cards">
                  {me.pending.map((s, i) => (
                    <SpiceCard key={i} spice={s} small selected={trading && i === pendingIndex} onClick={() => setPick(i)} />
                  ))}
                </div>
              </div>
            )}

            <div className="stalls">
              {me.stalls.map((st, i) => {
                const value = stallSaleValue(st.spice, st.count, view.royalOrder)
                const next = nextStep(st)
                const sellable = canSell(me, i) && view.phase !== 'ended'
                return (
                  <div key={i} className="stall">
                    <div className="stall-title">{t('game.stall', { n: i + 1 })}</div>
                    {st.spice ? (
                      <>
                        <SpiceCard spice={st.spice} tag={`×${st.count}`} />
                        <div className="small">
                          {t('game.worth', { gold: value })}
                          {next && <span className="muted"> · {t('game.next', next)}</span>}
                        </div>
                      </>
                    ) : (
                      <div className="card card-empty">{t('game.empty')}</div>
                    )}
                    {placing && canPlace(me, placing, i) && (
                      <button type="button" className="btn btn-primary btn-small" onClick={() => placeOn(i)}>
                        {t('game.place', { spice: t(`spice.${placing}`) })}
                      </button>
                    )}
                    {st.count > 0 && (
                      <button type="button" className="btn btn-small" disabled={!sellable} title={sellable ? undefined : t('game.sellBlocked')} onClick={() => act({ type: 'sell', stall: i })}>
                        {t('game.sell', { gold: value })}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="action-row">
              {isActive && view.phase === 'stock' && (
                <button type="button" className="btn btn-primary" disabled={view.stocked === 0 && caravan.length > 0} onClick={() => act({ type: 'endStock' })}>
                  {t('game.openMarket')}
                </button>
              )}
              {isActive && view.phase !== 'ended' && me.stalls.length < MAX_STALLS && (
                <button type="button" className="btn" disabled={me.gold < STALL_COST} onClick={() => act({ type: 'buyStall' })}>{t('game.buyStall')}</button>
              )}
            </div>

            <h3>{t('game.caravan')}</h3>
            {caravan.length ? (
              <div className="cards caravan">
                {caravan.map((s, i) => (
                  <SpiceCard key={i} spice={s} tag={i === 0 ? t('game.front') : undefined} selected={i === 0 && frontSpice !== null} dimmed={i > 0 && isActive && view.phase === 'stock'} />
                ))}
              </div>
            ) : (
              <p className="muted small">{t('game.caravanEmpty')}</p>
            )}
          </section>
        </div>
      </div>

      {view.phase === 'ended' && <EndScreen view={view} isHost={isHost} onAgain={() => session.send({ type: 'restart' })} onLeave={leave} />}
    </main>
  )
}
