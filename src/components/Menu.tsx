import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const LANGUAGES = ['en', 'de'] as const

export function LangSwitch() {
  const { t, i18n } = useTranslation()
  return (
    <div className="choice lang" role="group" aria-label={t('app.language')}>
      {LANGUAGES.map(lng => (
        <button key={lng} type="button" lang={lng} aria-pressed={i18n.language === lng} onClick={() => i18n.changeLanguage(lng)}>
          {lng.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

/** Everything that is not part of playing a turn, behind one button. */
export function GameMenu({ onRules, onLeave }: { onRules: () => void; onLeave: () => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const pick = (fn: () => void) => () => { setOpen(false); fn() }
  return (
    <div className="menu" onKeyDown={e => { if (e.key === 'Escape') setOpen(false) }}>
      <button type="button" className="btn btn-small" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span aria-hidden="true">☰</span> {t('app.menu')}
      </button>
      {open && (
        <>
          <div className="menu-backdrop" onClick={() => setOpen(false)} />
          <div className="menu-pop">
            <button type="button" className="btn btn-ghost" onClick={pick(onRules)}>{t('app.rules')}</button>
            <LangSwitch />
            <button type="button" className="btn btn-ghost" onClick={pick(onLeave)}>{t('lobby.leave')}</button>
          </div>
        </>
      )}
    </div>
  )
}
