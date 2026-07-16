# Feature: Node Map (seeded branching run map)
_Stage: 3 — The Run · Status: verified done_

## Goal
The Slay the Spire-style map that turns fights into a run: a seeded, layered DAG of typed nodes
(fight / elite / event / shop / rest / boss) the player routes through. Route choice is the
build-strategy skill layer. Lives in `src/engine/run/` — pure TS, seeded, unit-tested.

## Success Criteria
- [x] `generateMap(seed)` produces a **layered DAG ~7 floors deep** with 2–3 reachable choices per floor,
      every node reachable from the start, every path reaching the boss, and edges only between adjacent
      floors — asserted by graph-invariant property tests across many seeds.
- [x] **Node-type distribution constraints hold on every path**: any start→boss path contains 8–12
      encounters (fights+elite, within the v1 target), ≥1 rest, and the boss terminal; the map overall
      contains ≥1 elite, exactly 1 shop... (constraint set encoded as a property test; exact mix constants
      in config, sim-tunable).
- [x] **Same seed ⇒ identical map** (deep-equal across 1000 regenerations); different seeds produce
      structurally different maps (sanity check on a sample).
- [x] **Navigation API**: current node, legal next nodes (only adjacent-floor connected), visited path;
      illegal jumps rejected. Serializable plain-data MapState.
- [x] **Difficulty scalar** exposed per floor (config curve) that encounter generation consumes — deeper
      floors yield scaled enemy stats, unit-asserted.

## How We'll Verify
1. `npm test`: graph-invariant property tests (fast-check over seeds), distribution constraints,
   determinism repeats, navigation legality fixtures. `src/engine/` coverage stays ≥80%; tsc clean.
2. Downstream, the full-run sim (feature-run-lifecycle) exercises thousands of generated maps end to end —
   any generator pathology (dead ends, unreachable boss) surfaces there as a hard failure.

## Verification Log
### 2026-07-15 — Manager re-verified all gates — PASS
- 266 tests / 33 suites green (property tests over 250–400 seeds: DAG invariants via linear DP, per-path
  distribution, 1000× same-seed determinism, navigation legality). tsc clean; src/engine coverage ≥80%
  all metrics (engine/run 97.7/87.3); Stage 1+2 sim baselines byte-identical.
- DEVIATION (accepted): 13 floors with a per-floor role template, not "~7" — the hard per-path 8–12
  encounter gate forces it under one-role-per-floor construction. Floor plan is config data.
- OPEN QUESTION FOR CAM (route richness): role-per-floor means every route crosses the same node-type
  sequence — route choice picks the instance, not the type mix. If runs feel flat on-device, the
  generator's floor template should move to mixed-type rows (StS-style) — revisit at the Stage 3 milestone.

## Open Questions
- Exact floor count / branching factor for best route tension (7 deep × 2–3 wide is the starting point —
  tune with Cam's on-device feel in the milestone build).
- Whether event nodes should be able to substitute for a rest on some paths (variance vs guarantee).

## Notes & Decisions
- Structural defaults locked in decisions.md ("Stage 3 structural defaults", 2026-07-15).
- Map seed derives from the run seed via the sim's established deriveSeed tree so runs are fully
  reproducible end to end.
