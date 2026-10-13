# The Mind Engine

> The engine scores the board. The Mind Engine reads the player.

This document maps the psychology system (the Observer, identity vs. ego, the mask, the six archetypes, leakage, frame, and FATE) onto measurable chess signals. It also shows where each one lives in code (`packages/core/src/mind.ts`, `frame.ts`, `features.ts`).

---

## 1. The loop, as the product reads it

| Step | Psychology | What we can observe on the board |
|---|---|---|
| 1. Being | Acting without an audience | Not observable. This is the goal state of training. |
| 2. The observed moment | Shame becomes possible | — |
| 3. The mask forms | A blend of two of the six needs | **Archetype blend** across games (`PlayerProfile.archetypes`) |
| 4. Living "in book" | Scripts (Tribe + Emotion) | **Book moves**, opening depth, textbook development |
| 5. Leakage | Marked choices, strongest under interruption and pressure | **Free choices**, **script breaks**, **pressure moves** |
| 6. Frame | Identity holds it; ego hands it over | **Frame bar**, reactive streaks, identity index |
| 7. The skilled reader | Interrupts, reads, feeds evidence | **Coaches** + archetype bots to practise against |
| 8. Ego work | Name the script; rebuild through unwatched reps | **Prescriptions**: one named script + one drill per mask |

Steps 3–6 are what the product reads. Step 7 is what it coaches. Step 8 is what it prescribes.

---

## 2. Raw evidence per move (`features.ts`)

Every legal move is an option; the one picked is a **marked choice**. For each move we extract:

`capture · check · mate · castle · promotion · recapture · trade · tradeOffer · materialGiven (static exchange) · sacrifice · retreat · development · pawnStorm · kingPressure · threatsCreated · inCheckBefore · respondsToThreat · legalMoves · quiet`

From the engine (`review.ts`): **EP before/after**, **EP of the 2nd-best move** (to detect free choices and only-moves), and **forcing**, meaning how narrow a path the move left the opponent.

From the clock and client: **think time** (also parsed from `[%clk]` in imported Chess.com and Lichess PGNs), **remaining clock**, and **considered squares**, the pieces you picked up before committing. Considered squares are recorded on-device only and never sent to the server.

---

## 3. FATE → signals

### F: Focus ("when a script is interrupted, focus is created")
| Signal | Rule | Tag |
|---|---|---|
| Script break | First move after the last named-opening position | `script-break` |
| Forced to improvise | First move after the *opponent* broke the script | `improvising` |
| Deep think | think ≥ 2.5× your median and > 8s | `deep-think` |
| Missed the gift | Classification `miss` | `missed-gift` |
| Hesitation | ≥ 3 different pieces picked up | `hesitation` |
| Touched the answer | You picked up the best move's piece, then played something worse | `abandoned-best` |

**Book dependency:** accuracy in your first 5 moves after theory vs. your game accuracy. A big gap means the opening was memorized, not understood: borrowed identity.

### A: Authority ("authority is identity made visible")
| Signal | Rule | Tag |
|---|---|---|
| Held under the clock | Low clock and ≤ 0.02 EP lost on a non-routine move | `pressure-hold` |
| Seized the frame | Threat-making move while the opponent held the initiative | `frame-seized` |
| Counter-punch | Threatened, answered with a bigger threat instead of defending | `counter-punch` |

**Identity Index** = accuracy on *pressure* moves ÷ accuracy on *calm* moves × 100.
Pressure = low clock, within your last 2 moves after your own mistake, frame state red, or your first 3 moves out of book.
- ≥ 90 → identity: it holds when the mask is stripped.
- 70–90 → wobble: partly borrowed.
- < 70 → ego game: the mask was doing the work.

This is the chess version of "the ego player collapses into blunders; the identity player falls back on understanding built in private."

### T: Tribe (conformity, safety, the group script)
| Signal | Rule | Tag |
|---|---|---|
| Trading to safety | Even trade or trade offer in a balanced position (not a recapture) | `safety-trade` |
| Unprovoked retreat | Retreat with no threat present | `retreat-unprovoked` |
| Book loyalty | Each book move, textbook development | (Acceptance evidence) |

### E: Emotion ("emotion decides; logic justifies")
| Signal | Rule | Tag |
|---|---|---|
| Impulse | think < 0.35× median, non-routine position, ≥ 0.05 EP lost | `impulse` |
| Tilt | ≥ 0.05 EP lost within your 2 moves after your own mistake | `tilt` |
| Cracked under the clock | Low clock and ≥ 0.10 EP lost | `pressure-crack` |

---

## 4. Frame = initiative (`frame.ts`)

Separate from the evaluation. You can be +2 and still be the one answering.

```
impulse  = check + 0.8·threats + 0.15·kingPressure + 0.4·(non-recapture capture)
         + 0.6·sacrifice + 0.3·pawnStorm + 0.8·forcing
reaction = inCheck + 0.8·respondsToThreat + 0.6·recapture + 0.4·(≤3 legal moves)
frame_t  = 0.72·frame_{t−1} + 0.28·tanh(impulse − reaction) · (+1 White / −1 Black)
frame_0  = +0.1   (White moves first: baseline authority, like the closer on a call)
```

State per player: **green** (holding), **yellow** (slipping, or 2 reactive moves in a row), **red** (3 reactive moves in a row = "only making forced moves", or deep negative frame).

| Chess | On a call |
|---|---|
| Making a threat | Asking a question |
| Being forced to respond | Answering, justifying, explaining |
| Gaining tempo | Redirecting the agenda |
| Losing the initiative | Starting to defend yourself |
| Only forced moves | **Red. Frame lost.** |

---

## 5. The six masks (`ARCHETYPE_INFO`, evidence weights in `readMinds`)

| Mask | Board tell | Main evidence | Hughes inverse |
|---|---|---|---|
| **Significance** | Plays for the spectacular | Sacrifices, spectacle (sac or check when a quiet move was better), loud bluffs | Brilliance-hunting can cover a fear of being ordinary |
| **Approval** | Trades to safety | Safety trades, unprovoked retreats, free choices that trade | Safety can cover a fear of being judged |
| **Acceptance** | Plays what the books say | Book moves, textbook development, free choices that develop | Conformity can cover a fear of thinking alone |
| **Intelligence** | Needs certainty | Deep thinks, **overthinking routine moves**, quiet free choices, finding great/brilliant moves | Over-calculation can cover a fear of not knowing |
| **Pity** | Collapses after setbacks | Tilt, frame lost, cracking under the clock, resigning with chances | Collapse can cover a fear that effort won't be enough |
| **Strength** | Must hold the initiative | Initiative share (±), counter-punches, pawn storms, seizing the frame | Aggression can cover insecurity about the position |

**Free choice is the purest leak.** When the engine's top two moves are within 0.03 EP, the position didn't decide; the person did. Free choices get heavy weight (×1.2) toward the archetype their style points at.

**The inverse rule is a first-class signal.** `loud-bluff` fires when an aggressive move (check, sacrifice, threat, or pawn storm) comes from a worse position (EP < 0.40) and loses ≥ 0.08. Loud aggression, covering a position the player senses is slipping.

Profiles are reported as a two-mask **blend** with confidence (`low` < 15 own moves, `high` ≥ 30). The "Your mind" page aggregates across games, because one game is a snapshot and twenty games is a person.

---

## 6. Coaching (step 7) and ego work (step 8)

- **Per move:** a plain-language "why" combining the board label with the most important psychological tag.
- **Per game:** the story (opening → script break → who held the frame → turning point), key moments, both players' mask blends, and identity index.
- **Coaches:** seven personas, each owning a lens. Each one's lines respond to specific tags (Kiyo → identity/pressure; Tenka → frame; Shūji → free choices and masks; Herr Namenlos → scripts and book; Doc Flint → calculation discipline; Karasu → tilt and sacrifice; Lumen → spectacle and planning).
- **Prescriptions:** the named script ("I need this game to look brilliant") plus one drill. Hughes's fourth rule of scripts: a script discussed openly loses power.
- **Bots:** practise reading each mask against a bot that wears it.

## 7. Honest limits

- Weights are hand-set v0 heuristics. The roadmap calibrates them against labelled games (Section 4 of the roadmap).
- Static exchange ignores pins and x-rays, so some sacrifices are mis-sized.
- Without clock data, the focus and emotion lenses go quiet; the board, frame, and mask lenses still work.
- This is a coaching lens on observable choices, not a clinical assessment. The UI says so.
