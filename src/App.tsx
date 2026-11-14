import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Game } from './components/Game'
import { Entrance, WaitingRoom } from './components/Lobby'
import { RulesSheet } from './components/RulesSheet'
import { useSession } from './network/useSession'

export default function App() {
  const { t, i18n } = useTranslation()
  const session = useSession()
  const [rules, setRules] = useState(false)
  const inGame = !!session.room && !!session.view

  const tools = (
    <div className="tools">
      <button type="button" className="btn btn-ghost btn-small" onClick={() => setRules(true)}>{t('app.rules')}</button>
      <button type="button" className="btn btn-ghost btn-small" onClick={() => i18n.changeLanguage(i18n.language === 'de' ? 'en' : 'de')}>
        {t('app.language')}
      </button>
    </div>
  )

  return (
    <>
      {inGame ? (
        <Game session={session} tools={tools} />
      ) : (
        <main className="lobby">
          <header className="lobby-head">
            {tools}
            <h1>{t('app.title')}</h1>
            <p className="muted">{t('app.tagline')}</p>
          </header>
          {!session.connected || session.restoring ? (
            <p className="muted center">{t('app.connecting')}</p>
          ) : session.room ? (
            <WaitingRoom session={session} />
          ) : (
            <Entrance session={session} />
          )}
        </main>
      )}
      {inGame && !session.connected && <div className="toast toast-info" role="status">{t('app.connecting')}</div>}
      {session.error && (
        <div className="toast" role="alert">
          {t(`error.${session.error}`, { defaultValue: t('error.generic') })}
        </div>
      )}
      {rules && <RulesSheet onClose={() => setRules(false)} />}
    </>
  )
}
