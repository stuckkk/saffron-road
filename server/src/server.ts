import { existsSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import path from 'node:path'
import sirv from 'sirv'
import { WebSocketServer, type WebSocket } from 'ws'
import { RoomManager, type Connection, type RoomOptions } from './rooms'

const MAX_PAYLOAD_BYTES = 16 * 1024
const HEARTBEAT_MS = 30_000

export interface GameServer {
  http: Server
  rooms: RoomManager
  close(): Promise<void>
}

/** HTTP (built frontend from dist/, health check) plus the game WebSocket on /ws. */
export function createGameServer(
  options: Partial<RoomOptions> = {},
  staticDir: string = path.resolve(process.cwd(), 'dist'),
): GameServer {
  const rooms = new RoomManager(options)
  // Without a build (`npm run dev:server`) there is nothing to serve; Vite does that then.
  const serveStatic = existsSync(staticDir) ? sirv(staticDir, { single: true }) : null
  const http = createServer((req, res) => {
    if ((req.url ?? '').split('?')[0] === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('ok')
      return
    }
    if (serveStatic) return serveStatic(req, res)
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Frontend not built. Run `npm run build`, or use `npm run dev` during development.')
  })

  const wss = new WebSocketServer({ server: http, path: '/ws', maxPayload: MAX_PAYLOAD_BYTES })

  // A phone that lost its network never says goodbye: drop connections that miss a ping.
  const alive = new WeakSet<WebSocket>()
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (!alive.has(socket)) {
        socket.terminate()
        continue
      }
      alive.delete(socket)
      socket.ping()
    }
  }, HEARTBEAT_MS)
  heartbeat.unref()

  wss.on('connection', socket => {
    const conn: Connection = { roomId: null, memberId: null }
    alive.add(socket)
    socket.on('pong', () => alive.add(socket))
    socket.on('error', () => {})
    socket.on('message', raw => {
      // Whatever a client sends must never take the server down.
      try {
        rooms.handle(socket, conn, JSON.parse(raw.toString()))
      } catch (err) {
        console.error('message handling failed', err)
        if (socket.readyState === socket.OPEN) socket.send(JSON.stringify({ type: 'error', code: 'MALFORMED_MESSAGE' }))
      }
    })
    socket.on('close', () => rooms.detach(socket, conn))
  })

  return {
    http,
    rooms,
    close: () =>
      new Promise(resolve => {
        clearInterval(heartbeat)
        rooms.close()
        for (const socket of wss.clients) socket.terminate()
        wss.close(() => http.close(() => resolve()))
      }),
  }
}
