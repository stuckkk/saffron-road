import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MAX_PLAYERS, MIN_PLAYERS } from '../engine/cards'
import { roomFromUrl, type Session } from '../network/useSession'

const NAME_KEY = 'saffron-road-name'

function storedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

// One automatic join per page load (React's strict mode runs effects twice in development).
let autoJoinTried = false

export function Entrance({ session }: { session: Session }) {
  const { t } = useTranslation()
  const [name, setName] = useState(storedName)
  const invited = roomFromUrl()
  const [code, setCode] = useState(invited)
  const remember = () => {
    // The visitor chose for themselves: no automatic join after this.
    autoJoinTried = true
    try {
      localStorage.setItem(NAME_KEY, name)
    } catch {
      // not remembered
    }
  }
  const finalName = name.trim() || t('lobby.namePlaceholder')
  const join = (roomId: string) => {
    remember()
    session.send({ type: 'join', roomId, name: finalName })
  }

  // Opened through an invite link and the name is already known: go straight to the table.
  const { connected, seatId } = session
  useEffect(() => {
    // Never while this tab already holds a seat (e.g. the moment after one was restored).
    if (!connected || seatId || autoJoinTried || !invited || !storedName().trim()) return
    autoJoinTried = true
    session.send({ type: 'join', roomId: invited, name: storedName().trim() })
  }, [connected, seatId, invited, session])

  const nameField = (
    <label>
      {t('lobby.yourName')}
      <input value={name} maxLength={20} placeholder={t('lobby.namePlaceholder')} onChange={e => setName(e.target.value)} autoComplete="nickname" autoFocus={!!invited} />
    </label>
  )
  const createButton = (primary: boolean) => (
    <button
      type="button" className={primary ? 'btn btn-primary' : 'btn'} disabled={!connected}
      onClick={() => { remember(); session.send({ type: 'create', name: finalName }) }}
    >
      {t('lobby.create')}
    </button>
  )

  if (invited) {
    return (
      <form className="panel entrance" onSubmit={e => { e.preventDefault(); join(invited) }}>
        <h2>{t('lobby.invited', { id: invited })}</h2>
        {nameField}
        <button type="submit" className="btn btn-primary" disabled={!connected}>{t('lobby.joinTable', { id: invited })}</button>
        <div className="divider">{t('lobby.orCreate')}</div>
        {createButton(false)}
      </form>
    )
  }
  return (
    <div className="panel entrance">
      {nameField}
      {createButton(true)}
      <div className="divider">{t('lobby.or')}</div>
      <form className="join-row" onSubmit={e => { e.preventDefault(); join(code) }}>
        <input
          value={code} maxLength={5} placeholder={t('lobby.code')} aria-label={t('lobby.code')} autoCapitalize="characters" autoComplete="off"
          onChange={e => setCode(e.target.value.toUpperCase().trim())}
        />
        <button type="submit" className="btn" disabled={!connected || code.length < 5}>{t('lobby.join')}</button>
      </form>
    </div>
  )
}

export function WaitingRoom({ session }: { session: Session }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const room = session.room!
  const isHost = room.hostId === session.seatId
  // "localhost" only works on the server's own machine: hand out its network address instead.
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
  const origin = local && session.lanHost ? `${location.protocol}//${session.lanHost}${location.port ? ':' + location.port : ''}` : location.origin
  const link = `${origin}/?room=${room.id}`
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard needs a secure context; the link can still be selected by hand.
    }
  }
  return (
    <div className="panel entrance">
      <h2>{t('lobby.table', { id: room.id })}</h2>
      <label>
        {t('lobby.invite')}
        <span className="join-row">
          <input readOnly value={link} onFocus={e => e.target.select()} />
          <button type="button" className="btn" onClick={copy}>{copied ? t('lobby.copied') : t('lobby.copy')}</button>
        </span>
      </label>
      <p className="muted small">{t('lobby.inviteHint')}</p>
      <h3>{t('lobby.seats', { n: room.seats.length, max: MAX_PLAYERS })}</h3>
      <ul className="seat-list">
        {room.seats.map(seat => (
          <li key={seat.id}>
            <span className="seat-name">{seat.name}</span>
            {seat.isAI && <span className="badge">{t('lobby.ai')}</span>}
            {seat.id === room.hostId && <span className="badge badge-gold">{t('lobby.host')}</span>}
            {seat.id === session.seatId && <span className="badge">{t('lobby.you')}</span>}
            {!seat.connected && <span className="badge badge-warn">{t('lobby.offline')}</span>}
            {isHost && seat.id !== session.seatId && (
              <button type="button" className="btn btn-ghost btn-small" onClick={() => session.send({ type: 'removeSeat', seatId: seat.id })}>
                {t('lobby.remove')}
              </button>
            )}
          </li>
        ))}
      </ul>
      {isHost ? (
        <>
          <button type="button" className="btn" disabled={room.seats.length >= MAX_PLAYERS} onClick={() => session.send({ type: 'addAI' })}>
            {t('lobby.addAI')}
          </button>
          <button type="button" className="btn btn-primary" disabled={room.seats.length < MIN_PLAYERS} onClick={() => session.send({ type: 'start' })}>
            {t('lobby.start')}
          </button>
          {room.seats.length < MIN_PLAYERS && <p className="muted small">{t('lobby.needPlayers')}</p>}
        </>
      ) : (
        <p className="muted">{t('lobby.waitHost')}</p>
      )}
      <button type="button" className="btn btn-ghost" onClick={() => session.send({ type: 'leave' })}>{t('lobby.leave')}</button>
    </div>
  )
}
