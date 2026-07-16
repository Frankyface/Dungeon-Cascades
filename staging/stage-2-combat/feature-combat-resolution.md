# Feature: Combat Resolution (combo → damage/heal, HP, win/lose)
_Stage: 2 — Combat · Status: awaiting verification (all automated gates passed; Cam's on-device win remains)_

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
      on-device verdict; AMENDED 2026-07-15 by the "Combat recalibration" decision after first sim
      contact — see decisions.md): over 500 seeded encounters per enemy per bot —
      • greedy-combat bot (targets weaknesses) **wins ≥80%** vs each of the three enemies;
      • random bot **wins ≤40%** vs at least two of the three (skill must matter);
      • greedy median turns-to-win: **slime 3–8** (intro enemy), **skeleton 5–12**, **bat 4–12**;
      • reports byte-deterministic (same flags twice ⇒ identical stdout).
      Constants tune within the recalibration decision's bounds; final values + the report go in the
      Verification Log and the constants' file.
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
### 2026-07-15 — Engine-math portion verified (manager re-ran all gates) — sim bands + Cam's gate remain
- Combat math implemented per decisions.md defaults with ONE documented rounding site (round-half-up on
  aggregate damage and aggregate heal AFTER the cascade multiplier — pinned by a discriminating fixture:
  two 4-tile groups → round(25×1.25)=31, not per-group 33). All required hand-computed fixtures pass
  (group sizes, multi-wave, mixed damage+heal, every affinity tier, overheal cap, floor-at-0, overkill,
  terminal-state rejection). 20 suites / 139 tests green; combat coverage 100%; tsc clean.
- `startEncounter`/`playTurn` run fights end-to-end headlessly (transcript fixtures). Encounter seed
  splits into independent board/refill streams per the board engine's contract.
- REMAINING before verified done: the sim balance bands (win rates, turns-to-win, determinism diff — the
  combat-sim feature runs these) and Cam beating a scripted encounter on-device.

### 2026-07-15 — Recalibration verified; ALL automated gates pass — only Cam's on-device win remains
- Recalibrated per the decisions.md "Combat recalibration" entry: ATTACK_BASE 10→3, HEAL_BASE 5→2,
  slime 80 HP/atk 8, skeleton 120 HP/[8,charge,16], bat 90 HP/[atk 6,heal 8]. All combat fixtures
  hand-recomputed (arithmetic audited — incl. the single-rounding discriminator: (3.75+3.75)×1.25=9.375→9).
- **Amended band results (500 games, seed 42, manager re-ran spot-checks independently):**
  greedy-combat: slime 100% / median 5 · skeleton 96.6% / median 7 · bat 100% / median 7 — all in band.
  random: slime 0.6% · skeleton 0.0% · bat 0.4% — skill dominates (band: ≤40% on ≥2).
- Determinism: combat report byte-identical across repeat runs (manager-diffed). Stage 1 board baseline
  byte-identical (avg combos/move 3.4309). `npm test` 24 suites / 189 tests green; tsc clean;
  src/engine coverage ≥80% both metrics.
- One UI drift-guard fixture updated by the manager (slime telegraph 6→8, authorized recalibration value).

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
