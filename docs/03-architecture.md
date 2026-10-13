# Architecture

```
packages/
  core/     Pure TypeScript. No DOM, no network. Runs in the browser, Node, and tests.
    features.ts    move features + static exchange evaluation
    evaluation.ts  expected points, accuracy
    review.ts      classification (Chess.com thresholds), horizon fix, summaries
    frame.ts       initiative / frame meter
    mind.ts        Mind Engine: tags, pressure, free choice, archetypes, identity index
    coach.ts       game story + prescriptions
    coaches.ts     seven coach personas and their voices
    bots.ts        six archetype bots
    openings.ts    3,865 named openings (lichess chess-openings, CC0)
    lessons.ts     curriculum incl. the Mind track
    rating.ts      Glicko-2
    pgn.ts         PGN import/export with [%clk] clocks
    uci.ts         UCI client for any Stockfish build
    protocol.ts    WebSocket message types
  server/   Node + ws. Lobby, pairing, private links, spectators, clocks, Glicko-2, PGN archive.
  web/      Vite + vanilla TS + chessground + Stockfish 17.1 WASM in a Web Worker.
```

## Data flow

```
 Play (bot / local / online)
   │ each move: uci, thinkMs, clockMs, considered squares (device only)
   ▼
 StoredGame (localStorage) ──► Review: Stockfish (Web Worker) multi-PV per position
                                 ▼
                         reviewGame()  → labels, accuracy, best lines
                                 ▼
                         readMinds()   → tags, frame, pressure, archetypes, identity
                                 ▼
                         coachReport() + coachSay()  → language
                                 ▼
                         "Your mind" aggregate (localStorage)
```

## Principles

1. **Compute on the edge.** Engine analysis runs in the user's browser, which keeps the platform free.
2. **Privacy by default.** Your "considered" squares and your psychological profile never leave your device. The server sees only moves and clocks.
3. **Pure core.** All chess and psychology logic is deterministic and unit-tested. The UI and server are thin.
4. **Degrade gracefully.** No clocks (old PGNs)? The focus and emotion lenses go quiet, and everything else still works.
5. **Copyleft.** AGPL-3.0 keeps hosted forks open.

## Scaling path (when it's needed)

| Stage | Change |
|---|---|
| 1 node | Current: in-memory games + JSON snapshot |
| Many nodes | Sticky sessions per game; Redis pub/sub for lobby + spectators |
| Durable history | Postgres for players, games (PGN + clocks), ratings |
| Shared analysis | Optional volunteer analysis (like Lichess fishnet) to cache deep evals of popular positions |
| Optional AI coach | An LLM layer (e.g. the Claude API) that takes `reviewGame` + `readMinds` output and speaks in the chosen coach's voice. Opt-in, bring-your-own-key, so the free baseline never depends on it. |

## Running

```bash
npm install
npm test                 # core + server tests (uses Stockfish in Node)
npm run server           # ws://localhost:8787/ws (also serves the built app)
npm run dev              # web app on http://localhost:5173 (proxies /ws to the server)
npm run build            # production build into packages/web/dist, then `npm run server` serves it
npx tsx scripts/review-pgn.ts game.pgn 14   # terminal review + mind read of any PGN
```
