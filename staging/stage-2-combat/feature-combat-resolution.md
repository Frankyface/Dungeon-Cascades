# Feature: Combat Resolution (combo → damage/block, HP, win/lose)
_Stage: 2 — Combat · Status: not started_

## Goal
Turn a resolved drag-move into combat outcomes. Combo count and cleared tile types drive **damage** and
**block**; both player and enemy have **HP**; reaching zero decides **win/lose**. Defines the encounter
flow that stitches the board, the tile taxonomy, and enemy intents into one playable fight — the thing Cam
beats on-device to clear Stage 2.

## Success Criteria
- [ ] A resolved move's **combo count scales into damage/block** per a defined curve (bigger engineered
      cascades hit meaningfully harder — the skill payoff), using the tile types from the taxonomy.
- [ ] **HP tracking** works for player and enemy; damage and block apply correctly across turns.
- [ ] **Win/lose conditions** resolve: enemy HP ≤ 0 = win, player HP ≤ 0 = loss, and the encounter ends
      cleanly on either.
- [ ] **Encounter flow** runs end to end: start → repeated (player drag-move → resolve → enemy acts) → win
      or lose — no dead ends or stuck states.
- [ ] Cam can **beat a scripted encounter on-device** in Expo Go by playing drag-path moves.

## How We'll Verify
(Rougher than Stage 1 — sharpen when Stage 1 nears its fun gate.)
1. Unit tests (Jest, TDD, `npm test`) for the combat math: fixed combo counts / tile mixes produce the
   expected damage and block; HP math and win/lose thresholds are asserted with fixtures; keep
   `src/engine/` at ≥80% coverage.
2. A headless combat sim (extending the Stage 1 sim harness): a bot plays a scripted encounter and the
   result (win/lose, turns taken) is deterministic under a seed.
3. On-device (Expo Go, iPhone): Cam plays and **beats a scripted encounter**, confirming the loop feels
   right and the damage curve rewards bigger cascades.

## Verification Log
(empty until verification actually happens — a feature with an empty log can never be `verified done`)

## Open Questions
- **Combo → damage scaling curve** (linear, exponential, tiered?) — a headline open question; tune with
  the sim harness so cascades feel rewarding without trivializing fights.
- Whether **block** carries over between turns, expires, or caps — decide during Stage 2.
- Interaction between multiple tile types cleared in one move (e.g. attack + heal in the same cascade) —
  define resolution order.
- How this generalizes to many encounters / a boss (Stage 3) — note but don't build the run layer here.

## Notes & Decisions
- The whole point of combat is to make the Stage 1 skill (engineering cascades) pay off — the damage curve
  is where "bigger cascade = bigger reward" becomes real. Validate it against sim data AND Cam's on-device
  feel.
- Combat math is pure engine (`src/engine/combat/`), seeded and unit-tested; the UI renders outcomes.
