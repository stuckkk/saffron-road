import { useTranslation } from 'react-i18next'
import { SPICES, SPICE_INFO } from '../engine/cards'
import { SpiceIcon } from './SpiceCard'

export function RulesSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const sections = t('rules.sections', { returnObjects: true }) as { h: string; p: string }[]
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={t('rules.title')} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{t('rules.title')}</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('app.close')}</button>
        </div>
        {sections.map(s => (
          <section key={s.h}>
            <h3>{s.h}</h3>
            <p>{s.p}</p>
          </section>
        ))}
        <h3>{t('rules.table')}</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('rules.spice')}</th>
                <th>{t('rules.inDeck')}</th>
                {[1, 2, 3, 4].map(g => <th key={g}>{t('rules.cardsFor', { gold: g })}</th>)}
              </tr>
            </thead>
            <tbody>
              {SPICES.map(s => (
                <tr key={s}>
                  <td><span className="cell-spice"><SpiceIcon spice={s} size={16} />{t(`spice.${s}`)}</span></td>
                  <td>{SPICE_INFO[s].count}</td>
                  {[1, 2, 3, 4].map(g => <td key={g}>{SPICE_INFO[s].sales.find(x => x[1] === g)?.[0] ?? '–'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
