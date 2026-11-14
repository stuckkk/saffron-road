import { useTranslation } from 'react-i18next'
import type { GameView } from '../engine/types'
import { Gold } from './Gold'

export function EndScreen({ view, isHost, onAgain, onLeave }: { view: GameView; isHost: boolean; onAgain: () => void; onLeave: () => void }) {
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
