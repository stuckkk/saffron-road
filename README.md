# Saffron Road

An original card-trading game for 3 to 5 spice merchants, playable in the browser: every player on
their own phone or computer, with any seat optionally filled by an AI merchant. The interface is
available in English and German.

You run one small server; everyone opens it in a browser.

## The game in one minute

- Your hand is a **caravan**: cards stay in the order they arrived, and you always stock from the front.
- You own two **stalls** (a third costs 3 gold). A stall holds cards of a single spice.
- On your turn: **stock** the front card (optionally the next one too), open the **market** (two
  cards from the deck), **trade** freely with everyone, then everybody **delivers** (stocks) what
  they received, and you **resupply** with three cards.
- Sell a stall at any time; the more cards, the more gold. The spice named by the **Royal Order**
  pays 1 extra gold.
- The game ends in the round in which the deck runs out for the second time (third time with 4 or 5
  players). Most gold wins.

The full rules and the sale table are behind the **Rules** button in the app. The card set lives in
`src/engine/cards.ts`.

## Run it

Requires Node 22 or newer.

```sh
npm install
npm run build
npm start          # http://localhost:8080
```

On start the server prints the addresses it is reachable at on your network. Players on the same
Wi-Fi open that address; the host opens a table and shares the invite link or the 5-letter table
code. Add AI merchants in the lobby for a solo or mixed game.

A player who reloads or loses the connection gets their seat back automatically (the seat is
remembered in the browser). If someone is gone for good, the host can hand the seat to an AI.
Games live in the server's memory: restarting the server ends them.

### Settings (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8080` | Port to listen on |
| `AI_DELAY_MS` | `900` | Pause before each AI move |
| `AI_MARKET_MS` | `12000` | How long an AI keeps its market open for offers when people are playing |

### Docker

```sh
docker build -t saffron-road .
docker run -p 8080:8080 saffron-road
```

The image works as-is on hosts such as Render or Fly.io (one instance; WebSockets required).

## Develop

```sh
npm run dev:server   # game server on :8080, restarts on change
npm run dev          # Vite on :5173, proxies /ws to the server
npm test             # engine rules, AI simulation, server integration, translations
```

Layout:

- `src/engine/` – the rules as pure functions (`engine.ts`), the card set (`cards.ts`) and the AI (`ai.ts`). Shared by server and client.
- `server/src/` – HTTP + WebSocket server, tables, reconnects, AI driver. The server is authoritative; clients only ever receive what their seat may see.
- `src/components/`, `src/network/`, `src/i18n/` – the React client.
