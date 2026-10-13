# REA: Reverse Engineering Chess.com

A teardown of what Chess.com actually is, meaning the product systems, the engines under them, and the loops that make it work, followed by the open-source build that replaces each one.

**Sourcing key.** ✅ = documented publicly by Chess.com or a primary source. 🔍 = inferred from observable product behaviour or industry-standard practice. Their internals are not public, so where it matters we say which is which.

---

## 0. The one-paragraph model

Chess.com is four machines bolted together:

1. **A real-time game server.** It pairs players, runs clocks, and enforces rules.
2. **An engine farm.** Stockfish plus their own "Torch" engine grade every move.
3. **A content library.** Lessons, puzzles, openings, and bots all serve as structured practice.
4. **A monetization layer.** It meters the expensive parts: engine review, lessons, and puzzles.

The engine farm is the cost center. The paywall sits exactly there: free users get limited Game Reviews per day. **ChessButFree's core economic move is to run the engine on the player's own device (Stockfish WASM), so the expensive machine costs us nothing and nothing has to be metered.**

---

## 1. Product map

| Area | What Chess.com ships | How it works | ChessButFree |
|---|---|---|---|
| Live play | Bullet, blitz, rapid; quick pairing; rematch; spectating | WebSocket game servers, server-side clocks, rating-window matchmaking 🔍 | ✅ Built: `packages/server` |
| Daily (correspondence) | Days per move | Same rules engine, persistent storage, notifications 🔍 | Roadmap |
| Bots | Level bots + personality bots (celebrity/novelty bots like Mittens) | An engine with limited strength, plus a persona layer (opening book, style, chat lines) 🔍 | ✅ Built: 6 **archetype bots**, `core/src/bots.ts` |
| Game Review | Move labels, accuracy, "Coach" explanations, key moments, retry mistakes | Engine eval → Expected Points model → classification ✅; templated coach text over engine lines 🔍 | ✅ Built: `core/src/review.ts` + **Mind Read** |
| Analysis board | Free analysis with engine lines | In-browser Stockfish.js (which Chess.com itself maintains, GPLv3 ✅) | ✅ Built: client-side Stockfish 17.1 |
| Lessons | Video + interactive "challenge" positions, organised by level | Author-curated sequences: explain → position → find the move → auto-reply → next ✅ (visible format) | ✅ Built: `core/src/lessons.ts`, plus a new **Mind track** |
| Puzzles | Rated puzzles, Puzzle Rush, Puzzle Battle | Positions mined from games where one move wins; puzzles and players both carry Glicko ratings 🔍 | Roadmap (import the Lichess CC0 puzzle database) |
| Openings | Explorer with names and stats | ECO-named positions + game database statistics 🔍 | ✅ Built: 3,865 named lines (CC0) + book continuations |
| Ratings | Separate ratings per time control | Glicko-1 ✅ | ✅ Glicko-2 per speed (as Lichess uses) |
| Fair play | Cheat detection | Statistical "Strength Score" across many games ✅ + behavioural signals 🔍 | Roadmap (the Mind Engine signals are the same raw data) |
| Social | Clubs, friends, chat, tournaments | Standard social graph + arena/swiss pairing 🔍 | Roadmap |

---

## 2. Game Review: the core system, fully decoded

This is the feature people pay for, so it gets the deepest teardown.

### 2.1 Pipeline

```
PGN / live game
  └─► for every position: engine search (multi-PV)         ← cost center
        └─► eval (centipawns or mate) for best & 2nd-best
              └─► Expected Points (win probability, rating-aware)
                    └─► EP lost by the move played  ──► label
                    └─► per-move accuracy           ──► game accuracy (CAPS2)
              └─► opening database lookup           ──► "Book"
              └─► sacrifice detection (material)    ──► "Brilliant"
              └─► only-move detection (PV gap)      ──► "Great"
              └─► opponent's last move was an error ──► "Miss"
        └─► templated explanations + key moments    ──► "Coach"
```

### 2.2 Classification V2 ✅ (Chess.com Help Center, "How are moves classified?")

Chess.com grades a move by how many **Expected Points** it costs. Expected Points is the probability of scoring (1 = win, 0.5 = draw, 0 = loss) from the engine eval *and the player's rating*.

| Label | EP lost |
|---|---|
| Best | 0.00 (engine's top move) |
| Excellent | 0.00 – 0.02 |
| Good | 0.02 – 0.05 |
| Inaccuracy | 0.05 – 0.10 |
| Mistake | 0.10 – 0.20 |
| Blunder | ≥ 0.20 |

Special labels:
- **Brilliant (!!)**: a good piece sacrifice. Always among the best moves; the definition is more generous for lower-rated players.
- **Great (!)**: changes the outcome (losing → equal, equal → winning) or is the only good move.
- **Miss**: you failed to punish the opponent's error and ended up equal or worse.
- **Book**: in the opening database.

**Our implementation** (`core/src/review.ts`) uses those exact thresholds. Expected Points comes from the published Lichess logistic fit `1 / (1 + e^(−0.00368208·cp))`, with a rating factor that flattens it for lower ratings. Brilliant = static-exchange sacrifice of ≥ 2 pawns of material, played as the best move, without leaving you lost. Great = second-best line is ≥ 0.15 EP worse. Miss = the opponent just lost ≥ 0.10, you had ≥ 0.70, and you gave ≥ 0.10 back.

**Horizon correction (our addition).** Shallow searches prune sacrifices, so the real point of a combination often appears only one ply later. When the opponent replies with the engine's own best move, we let the next position's deeper read correct the previous move's grade. This turns Morphy's 15.Bxd7+ from a false "blunder" into "great". It is covered by a test.

### 2.3 Accuracy ✅/🔍

Chess.com's CAPS2 is proprietary ✅. It was redesigned in 2021 to read like a school grade (most games between 50 and 95). We use the **open Lichess formula**, which is in the same spirit:

- per move: `103.1668·e^(−0.04354·Δwin%) − 3.1669`
- per game: mean of a volatility-weighted average and a harmonic average, so one disaster drags the score.

### 2.4 The Coach 🔍

The Chess.com coach reads as **templates over engine facts**: "{move} is a mistake. {best} was better because it {threat/material/mate}." It adds key moments (largest EP swings) and "retry" positions. ChessButFree does the same for the board, then adds what no review tool has: a read on the **player** (Section 5).

---

## 3. Multiplayer: how live chess actually runs 🔍

From observable behaviour (and from Lichess, whose identical system is open source):

| Concern | Industry design | ChessButFree |
|---|---|---|
| Transport | Persistent WebSocket per client; small JSON or binary frames | `ws` server, JSON protocol in `core/src/protocol.ts` |
| Authority | The server validates every move; the client only proposes | `chess.js` on the server (`server/src/game.ts`) |
| Clocks | The server owns them; they start after each side's first move; increment added after the move | Same |
| Lag | Client reports its own think time; the server refunds network lag up to a cap | Up to 1,000 ms refunded per move |
| Flagging | Server timer; flag vs. insufficient mating material = draw | 100 ms tick; Lichess rule applied |
| Matchmaking | Pools per time control, rating window widening over time | First-come pairing per exact time control (rating window: roadmap) |
| Private games | Challenge link | `createPrivate` → share link → `join` |
| Reconnect | Session token; the server replays the live game | Anonymous player id in `localStorage`; live game resent on `hello` |
| Ratings | Glicko per speed bucket | Glicko-2; buckets estimated as `initial + 40 × increment` |
| Spectators | Fan-out of moves to watchers | `watch` → same move stream |
| Persistence | Relational DB + cache 🔍 | JSON snapshot (single node); Postgres + Redis pub/sub on the roadmap |
| Abuse | Rate limits, fair play | 30 msgs/s per socket, 16 KB frame cap; fair play on the roadmap |

**Scaling truth.** Lichess serves millions of games a day as a donation-funded, open-source project ([lichess-org/lila](https://github.com/lichess-org/lila)). A free, open chess platform at scale is proven. The expensive parts are engine analysis (we push it to clients) and real-time fan-out (cheap per game).

---

## 4. Lessons, puzzles, bots: the teaching systems

### Lessons (the visible Chess.com format)
1. A short concept (text or video).
2. "Challenge" positions where the learner must find the move.
3. A wrong move snaps back with a hint; a right move triggers the opponent's scripted reply.
4. The lesson completes, and progress is saved.

ChessButFree keeps this loop exactly (`LessonStep.tasks[]` with `accept[]` + `reply`). Every exercise is verified by tests: moves are legal, and mates really mate.

### Puzzles 🔍
Puzzles are mined from real games. Find positions where exactly one move wins and the rest don't, then rate puzzle and player against each other with Glicko. Lichess publishes ~5M puzzles under CC0, which is our import path.

### Bots 🔍
Strength is limited by depth, skill level, or deliberate sub-optimal picks among multi-PV candidates. Personality comes from opening choices, style, and chat. **Our twist:** each bot wears one of the six psychological masks and picks among near-equal engine moves by that mask's preferences. Bookworm cracks when taken out of theory; the Underdog's tolerance collapses once it is losing; the Warlord never retreats. You learn to *read and exploit a person*, not just beat an engine.

---

## 5. What Chess.com does not do (the opening)

Chess.com grades **the board**. It never asks:

- Why did you play that? What were you reacting to?
- Were you still inside memorized theory, or improvising?
- Did your quality hold when the clock ran low, or right after your last mistake?
- Who was steering the game, regardless of the eval?
- Across 20 games, what are you *for*: spectacle, safety, conformity, certainty, sympathy, control?

All the evidence is already in the data: think times (`[%clk]` comments, even in Chess.com and Lichess exports), move types, initiative, and quality under pressure. Chess.com uses the same behavioural signals to **police** players (fair play). ChessButFree uses them to **coach** them. That is the product. See [`02-mind-engine.md`](./02-mind-engine.md).

---

## 6. Monetization → free

| Chess.com meters | Why it's expensive for them | Why it's free for us |
|---|---|---|
| Game Reviews per day | Server-side engine time | Runs on your device |
| Lessons | Content licensing and production | Open lessons, community PRs, CC0 data |
| Puzzles | Server + content | CC0 puzzle DB, client-side checking |
| Ad-free | Ads fund the free tier | No ads; hosting is one small Node process |

The license is **AGPL-3.0**, so every fork that serves users must share its code. That is what keeps it free.
