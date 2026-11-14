import { useState } from 'react'
import { useTranslation } from 'react-i18next'

/** A gold amount. When the number changes, the difference floats up briefly. */
export function Gold({ n, big }: { n: number; big?: boolean }) {
  const { t } = useTranslation()
  const [prev, setPrev] = useState(n)
  const [delta, setDelta] = useState<{ d: number; id: number } | null>(null)
  if (n !== prev) {
    setPrev(n)
    setDelta({ d: n - prev, id: (delta?.id ?? 0) + 1 })
  }
  return (
    <span className={`gold ${big ? 'gold-big' : ''}`} title={t('game.gold')}>
      <span className="coin" aria-hidden="true" />
      {n}
      <span className="sr-only"> {t('game.gold')}</span>
      {delta && <span key={delta.id} className="gold-float" aria-hidden="true">{delta.d > 0 ? `+${delta.d}` : delta.d}</span>}
    </span>
  )
}
