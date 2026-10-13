# ChessButFree

**Free, open-source chess that reads the mind behind the moves.**

Play: https://chessbutfree.vercel.app · Multiplayer server: [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/whoisjaso/chess)

ChessButFree has what you'd expect from a chess platform: live multiplayer, bots, game review, lessons, and an opening explorer. All of it is free, with no paywall on analysis, because the engine runs on your own device.

It also does something the big platforms don't. It reads **the player**, not just the position:

- **Why** you played it. Were you reacting to a threat, playing on impulse, tilting, or making a free choice?
- **Script breaks.** It finds the moment the opening theory ran out and the real player showed up.
- **The frame bar.** Separate from the eval bar, it shows who held the initiative and who only made forced moves.
- **The identity index.** Your quality under pressure (low clock, just after a mistake, lost frame) divided by your quality when calm. Identity holds; ego collapses.
- **The mask.** Your blend of the six archetypes (Significance, Approval, Acceptance, Intelligence, Pity, Strength), read from the choices you make when the position doesn't force you.
- **Ego work.** It names your script and prescribes one drill to rebuild identity through reps nobody watches.

## Features

| | |
|---|---|
| **Play** | Six archetype bots (Showman, Diplomat, Bookworm, Professor, Underdog, Warlord) × six strength levels; online quick pairing; friend links; spectating; pass & play |
| **Review** | Brilliant → blunder, using Chess.com's published expected-points thresholds; accuracy; best lines; key moments; eval bar + **frame bar** + **Mind Read** |
| **Coaches** | Seven original teachers modelled on fiction's sharpest minds; each owns one psychological lens and voices your reviews |
| **Lessons** | Foundations, tactics, mates, openings, endgames, plus the **Mind track**: frame, out-of-book, tilt, time pressure, reading opponents |
| **Openings** | 3,865 named lines with book continuations |
| **Ratings** | Glicko-2 per speed |
| **Import** | Paste any Chess.com or Lichess PGN. `[%clk]` think times are read, so the psychology works on your existing games. |

## Quick start

```bash
npm install
npm test            # 36 tests, including real Stockfish reviews of the Opera Game
npm run server      # multiplayer server on :8787
npm run dev         # app on http://localhost:5173
```

Terminal review of any PGN: `npx tsx scripts/review-pgn.ts game.pgn 14`

## Voices

- **Coach and bot voices.** Every coach and bot has its own voice profile. By default it uses the browser's speech engine. Optional **HD neural voices** (Piper, running on your device) download once per character.
- **Voice Mode.** Speak your moves to the bots ("knight f3", "bishop takes c6", "castle kingside", "hint", "takeback"). The bot answers out loud.
- **Voice chat.** Online games open a peer-to-peer WebRTC audio channel between the two players, on by default. Turn off *My mic* or *Opponent's voice* in settings or with the buttons on the player bars.

## Deploy

| Piece | Where | How |
|---|---|---|
| Web app (bots, Voice Mode, review, puzzles, lessons, openings) | Vercel / any static host | `vercel.json` is included: import the repo, and it builds `packages/web/dist` |
| Multiplayer + voice-chat signalling server | Render / Fly / any Docker host | `render.yaml` + `Dockerfile` are included. Then set `VITE_WS_URL=wss://<your-server>/ws` on the web app and redeploy |

The Docker image also serves the built web app, so a single Render service is a complete deployment.

## Docs

1. [REA: Reverse engineering Chess.com](docs/01-REA-chess-com.md): every system, how it works, and our equivalent
2. [The Mind Engine](docs/02-mind-engine.md): the psychology → signals → code
3. [Architecture](docs/03-architecture.md)
4. [Roadmap](docs/04-roadmap.md)

## License & credits

AGPL-3.0-or-later. Built on [Stockfish](https://stockfishchess.org) via [stockfish.js](https://github.com/nmrugg/stockfish.js) (GPLv3), [chessground](https://github.com/lichess-org/chessground) (GPLv3), [chess.js](https://github.com/jhlywa/chess.js) (BSD-2), and [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) (CC0). Coach personas are original characters; the fictional characters cited as inspiration belong to their creators. Not affiliated with Chess.com.

Mind Read is a coaching lens on observable choices. It is not a psychological diagnosis.
