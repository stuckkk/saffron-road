import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameView } from '../engine/types'
import type { ClientMessage, RoomInfo, ServerMessage } from './protocol'

const STORAGE_KEY = 'saffron-road-session'

interface Stored {
  roomId: string
  token: string
}

/** Per-tab id (survives reloads, not shared between tabs). */
function tabId(): string {
  try {
    let id = sessionStorage.getItem(STORAGE_KEY + '-tab')
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36)
      sessionStorage.setItem(STORAGE_KEY + '-tab', id)
    }
    return id
  } catch {
    return ''
  }
}

// The seat is kept per tab (so two tabs can hold two seats) and per browser (so a reopened
// browser finds its seat again); the tab's own record wins.
function loadStored(): Stored | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY) ?? 'null')
    return s && typeof s.roomId === 'string' && typeof s.token === 'string' ? s : null
  } catch {
    return null
  }
}

function store(s: Stored | null): void {
  try {
    if (s) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    } else {
      // Only forget the browser-wide record if it is this tab's seat.
      const mine = sessionStorage.getItem(STORAGE_KEY)
      sessionStorage.removeItem(STORAGE_KEY)
      if (!mine || mine === localStorage.getItem(STORAGE_KEY)) localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // Without storage a reload loses the seat; playing still works.
  }
}

export function roomFromUrl(): string {
  return (new URLSearchParams(location.search).get('room') ?? '').toUpperCase()
}

function setUrlRoom(roomId: string | null): void {
  const url = new URL(location.href)
  if (roomId) url.searchParams.set('room', roomId)
  else url.searchParams.delete('room')
  history.replaceState(null, '', url)
}

export interface Session {
  connected: boolean
  /** True while a stored seat is being reclaimed after (re)connecting. */
  restoring: boolean
  room: RoomInfo | null
  view: GameView | null
  seatId: string | null
  error: string | null
  /** Address of the server on the local network, if it told us. */
  lanHost: string | null
  send(msg: ClientMessage): void
}

export function useSession(): Session {
  const [connected, setConnected] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [room, setRoom] = useState<RoomInfo | null>(null)
  const [view, setView] = useState<GameView | null>(null)
  const [seatId, setSeatId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lanHost, setLanHost] = useState<string | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  // Re-render when the address bar's table code changes.
  const [, setUrlTick] = useState(0)

  useEffect(() => {
    let closed = false
    let retry: ReturnType<typeof setTimeout> | undefined
    let attempts = 0
    // Set when the remembered seat turned out to be open in another tab: this tab is a new guest.
    let seatTaken = false

    const reset = () => {
      setRoom(null)
      setView(null)
      setSeatId(null)
    }

    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      const socket = new WebSocket(`${proto}://${location.host}/ws`)
      socketRef.current = socket

      socket.onopen = () => {
        attempts = 0
        setConnected(true)
        const stored = loadStored()
        const urlRoom = roomFromUrl()
        // An invite link to another table beats the remembered seat.
        if (stored && !seatTaken && (!urlRoom || urlRoom === stored.roomId)) {
          setRestoring(true)
          socket.send(JSON.stringify({ type: 'rejoin', ...stored, tabId: tabId() } satisfies ClientMessage))
        }
      }

      socket.onmessage = event => {
        const msg = JSON.parse(event.data) as ServerMessage
        switch (msg.type) {
          case 'joined':
            store({ roomId: msg.roomId, token: msg.token })
            setUrlRoom(msg.roomId)
            setSeatId(msg.seatId)
            setLanHost(msg.lanHost)
            seatTaken = false
            setRestoring(false)
            break
          case 'room':
            setRoom(msg.room)
            break
          case 'game':
            setView(msg.view)
            break
          case 'left':
            store(null)
            setUrlRoom(null)
            reset()
            break
          case 'error':
            setRestoring(false)
            if (msg.code === 'SEAT_IN_USE') {
              // Not an error for the player: they simply join as someone new (see Entrance).
              seatTaken = true
              if (!roomFromUrl()) setUrlRoom(loadStored()?.roomId ?? null)
              setUrlTick(n => n + 1)
              break
            }
            if (msg.code === 'NO_SUCH_ROOM' || msg.code === 'BAD_TOKEN') {
              store(null)
              setUrlRoom(null)
              setUrlTick(n => n + 1)
            }
            setError(msg.code)
            break
        }
      }

      socket.onclose = () => {
        if (closed) return
        setConnected(false)
        retry = setTimeout(connect, Math.min(500 * 2 ** attempts++, 5000))
      }
    }

    connect()
    return () => {
      closed = true
      clearTimeout(retry)
      socketRef.current?.close()
    }
  }, [])

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 4000)
    return () => clearTimeout(t)
  }, [error])

  const send = useCallback((msg: ClientMessage) => {
    const socket = socketRef.current
    const full = msg.type === 'create' || msg.type === 'join' ? { ...msg, tabId: tabId() } : msg
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(full))
  }, [])

  return { connected, restoring, room, view, seatId, error, lanHost, send }
}
