import { networkInterfaces } from 'node:os'
import { createGameServer } from './server'

const PORT = Number(process.env.PORT) || 8080

// Optional pacing overrides (milliseconds): how fast the AI moves, and how long it keeps its market open.
const pacing = {
  ...(process.env.AI_DELAY_MS ? { aiDelayMs: Number(process.env.AI_DELAY_MS) } : {}),
  ...(process.env.AI_MARKET_MS ? { aiMarketMs: Number(process.env.AI_MARKET_MS) } : {}),
}

const server = createGameServer(pacing)
server.http.listen(PORT, () => {
  console.log(`Saffron Road listening on http://localhost:${PORT}`)
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) console.log(`  on your network: http://${net.address}:${PORT}`)
    }
  }
})

// As PID 1 in a container Node ignores SIGTERM unless handled.
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => process.exit(0))
