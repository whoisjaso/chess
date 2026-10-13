# Roadmap

Ordered by leverage. Each item says what it unlocks.

## Phase 1: Complete the platform (parity)
1. **Puzzles.** Import the Lichess CC0 puzzle database, add a puzzle Glicko rating and Puzzle Rush. *Unlocks the #1 daily-habit loop.*
2. **Rating-window matchmaking.** Pair within ±100, widening over time. *Fair games at scale.*
3. **Accounts (optional).** OAuth or passkeys to sync games across devices; anonymous play stays the default.
4. **Daily (correspondence) games**, plus Postgres persistence.
5. **Tournaments.** Arena and swiss.
6. **Promotion picker, premoves, sounds, board themes.**
7. **Mobile.** PWA install, then a Capacitor wrapper.

## Phase 2: Deepen the Mind Engine (the moat)
1. **Calibration set.** Label ~500 games for archetype, tilt, and impulse; fit the hand-set weights; publish the dataset (CC0).
2. **Cross-game profiling.** Mask stability, identity trend, per-opening book dependency, and time-control effects (does the mask change in bullet?).
3. **Opponent scouting.** Before a game, read the opponent's public games (Lichess API) and show their mask and its counter. Lasker's method, automated.
4. **Live frame bar for training mode.** Shows initiative during play against bots only, never in rated games.
5. **Retry with intent.** After a review, replay your pressure moments, not just your blunders.
6. **Optional LLM coach.** Bring-your-own-key Claude layer that turns the structured read into a conversation in the chosen coach's voice.

## Phase 3: Beyond the board
The Mind Engine is domain-agnostic. A move is a marked choice, a script break is an interrupted script, and frame is initiative. The same pipeline can run on **conversation transcripts**:

| Chess | Conversation |
|---|---|
| Move | Utterance |
| Think time | Response latency |
| Book | Memorized pitch / small-talk script |
| Threat / check | Question / qualifying question |
| Reactive move | Justification / explanation |
| Frame bar | Glow ring |
| Game review | Post-call breakdown ("14:32: 90-second justification, frame blunder") |

Chess is the proving ground: the domain where move-quality ground truth exists (Stockfish). The labels and weights calibrated here transfer.
