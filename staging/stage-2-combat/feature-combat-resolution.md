# Feature: Combat Resolution (combo → damage/heal, HP, win/lose)
_Stage: 2 — Combat · Status: not started_

## Goal
Turn a resolved drag-move into combat outcomes using the decided taxonomy (offense-first affinity: R/G/B/Y
damage vs enemy affinity table, P heals; every group feeds the cascade multiplier). Both sides have HP;
zero decides win/lose. Defines the encounter flow that stitches board, taxonomy, and enemy intents into
one playable fight — the thing Cam beats on-device to clear Stage 2.

## Success Criteria
- [ ] **Combat math implements the decisions.md defaults** (one config module): per damage group
      `ATTACK_BASE × (1 + GROUP_SIZE_BONUS×(size−3)) × affinity`; move damage = Σ groups × cascade
      multiplier `(1 + CASCADE_BONUS×(totalCombos−1))` with totalCombos counting ALL groups incl. heals;
      heal groups heal by `HEAL_BASE × (1 + GROUP_SIZE_BONUS×(size−3))` × cascade multiplier. Hand-computed
      fixtures assert exact damage/heal for at least: single 3-match; 4- and 5-tile groups; multi-group
      single wave; multi-wave cascade; mixed damage+heal move; each affinity multiplier; overheal capped at
      max HP.
- [ ] **HP tracking** for player and enemy applies damage/heal correctly across turns; no negative-HP
      underflow weirdness (floor at 0), overkill allowed on the killing blow.
- [ ] **Win/lose resolve cleanly**: enemy HP ≤ 0 after the player's resolution = win (enemy never acts
      dead); player HP ≤ 0 after the enemy acts = loss; encounter state machine reaches a terminal
      won/lost state and rejects further moves.
- [ ] **Encounter flow runs end to end headlessly**: `startEncounter(enemyId, seed)` → repeated
      `playTurn(state, path)` → terminal state, entirely in pure TS — proven by the combat sim (below)
      playing complete fights with no UI.
- [ ] **Sim-verified balance bands** (the automated stand-in for "combat is satisfying," pending Cam's
      on-device verdict): over 500 seeded encounters per enemy per bot —
      • greedy-combat bot (targets weaknesses) **wins ≥80%** vs each of the three enemies;
      • random bot **wins ≤40%** vs at least two of the three (skill must matter);
      • greedy median turns-to-win per fight is **4–12** (fits 8–12 encounters in a 15–20 min run);
      • reports byte-deterministic (same flags twice ⇒ identical stdout).
      Constants in the config module may be tuned within documented bounds to hit these bands; final
      values + the report go in the Verification Log and the constants' file.
- [ ] Cam can **beat a scripted encounter on-device** by playing drag-path moves. (Human gate — stays
      unticked until Cam plays.)

## How We'll Verify
1. `npm test` — TDD fixtures for all math above, turn-order edges, terminal-state behavior; `src/engine/`
   coverage ≥80%; `npx tsc --noEmit` exit 0.
2. Combat sim CLI (extends the Stage 1 harness, e.g. `npm run sim -- --mode combat --enemy skeleton
   --bot greedy-combat --games 500 --seed 42`): produces win rate, turns-to-win distribution,
   damage-per-move stats. Run per enemy per bot; assert the balance bands above; run the greedy command
   twice → `diff` stdout byte-identical.
3. Board-behavior regression: Stage 1 sim command still reproduces its baseline (board untouched).
4. On-device (Cam): beat the Slime, then ideally the Skeleton; confirm bigger cascades visibly hit harder.

## Verification Log
(empty until verification actually happens — a feature with an empty log can never be `verified done`)

## Open Questions
- Does 60 player HP + these enemy numbers create real jeopardy for a mid-skill human (bots bracket the
  extremes)? Cam's on-device play answers this; sims only bound it.
- Elemental targeting UI affordance (how the player learns/sees weaknesses) — combat UI feature question.
- Whether the cascade multiplier should cap (anti-degenerate guard) — watch the sim tail; note only.

## Notes & Decisions
- The damage curve is where "bigger cascade = bigger reward" becomes real; the sim bands are the
  machine-checkable proxy, Cam's feel is the truth. Combat math is pure engine, seeded, unit-tested; the
  UI renders outcomes.
- Resolution order within a move: compute all groups/waves from the board resolution first, then apply
  combat effects (damage sums, heals apply, capped) as one batch — the board never re-enters combat state
  mid-resolution. Keeps replay/animation clean and math associative.
