# Feature: Board Engine (headless drag-path match-3 core)
_Stage: 1 — Naked Board · Status: not started_

## Goal
A pure-TypeScript, headless game engine (`src/engine/board/`) with ZERO React/React Native imports that
models the entire match-3 core: grid state, seeded tile spawning, drag-path move resolution, match
detection, and cascade/combo/gravity/refill. It is the deterministic heart of Dungeon Cascades — the
thing sim bots drive and the Skia UI renders — and its determinism is what makes the project's automated
verification convention possible.

## Success Criteria
- [ ] Given a **seed** and a **drag path** (start tile + ordered list of steps), the engine resolves the
      full move — swap-through, matches, cascades, gravity, refills — such that the same seed + same path
      produces **identical board states and identical combo counts across 1000 repeated resolutions**.
- [ ] A **move** picks up one tile and drags it; the held tile **swaps positions with each tile it
      passes**; movement is **orthogonal-only** in v1 (up/down/left/right steps).
- [ ] **Match detection** clears every horizontal or vertical line of **≥3 same-color tiles**; each
      distinct cleared group counts as **+1 combo**.
- [ ] After clears, **gravity** drops surviving tiles down their columns and **new tiles spawn from the
      top** via seeded, deterministic RNG; **cascades continue** and each new wave of clears adds combos
      until the board is stable, and the engine reports the **final total combo count** for the move.
- [ ] Combo counting **matches hand-computed fixture boards** — a set of small boards with known,
      pen-and-paper combo outcomes.
- [ ] **Gravity/refill invariants hold under property tests**: after resolution there are **no holes**
      (no empty cell below a filled cell), **no overlapping/phantom tiles**, and **tile-count is
      conserved** (filled cells == grid size; every cell holds exactly one valid color).

## How We'll Verify
Written before code (TDD — tests first, RED before GREEN):
1. Run the engine unit + property tests: `npm test` (Jest via ts-jest).
2. Determinism test: seed a board, apply a fixed drag path, snapshot the resulting board state + combo
   count, then repeat the identical seed+path 1000 times in a loop and assert every result deep-equals
   the first. Expected output: test passes, 0 mismatches.
3. Fixture test: for each hand-computed board in the fixtures directory, assert the engine's cleared
   groups and total combo count equal the recorded expected values. Expected: all fixtures pass.
4. Property tests (e.g. fast-check, or seeded random boards + random legal paths): after every resolution
   assert the three invariants (no holes, no phantom/overlap, tile count == grid cells). Expected: no
   counterexample found across the configured run count.
5. Coverage: `npm test -- --coverage` and confirm the summary shows **`src/engine/` ≥ 80%** statements
   and branches.

## Verification Log
(empty until verification actually happens — a feature with an empty log can never be `verified done`)

## Open Questions
- **Board size**: 6×5 (P&D standard, proposed default) vs 7×6 — settle during Stage 1.
- **Diagonal moves**: v1 default is orthogonal-only; diagonals are a tuning question revisited at the fun
  gate (and would need matching engine support).
- **Refill RNG model**: pure random vs a bag/weighted system (a bag reduces luck spikes and is a
  pro-skill lever) — open across Stages 1–2. Whatever is chosen must stay seeded and deterministic.
- **Drag timer length** (~5s default): the timer is enforced in the UI layer, but the engine must accept
  an arbitrary already-completed path — confirm the engine/UI boundary keeps the engine timer-agnostic.

## Notes & Decisions
- Locked context from `docs/decisions.md` (2026-07-15): drag-path (P&D-style) is the chosen move
  mechanic; refills stay random (possibly bag-weighted) but must be seeded/deterministic; the engine is
  pure headless TS with no React/RN imports.
- Keep the engine's public API small and serializable (board state as plain data) so the Skia UI and the
  sim bots both drive it without duplicating logic. Truth hierarchy: real engine state beats any doc — if
  a doc and the engine disagree, fix the doc.
