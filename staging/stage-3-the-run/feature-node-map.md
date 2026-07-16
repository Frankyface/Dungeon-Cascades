# Feature: Node Map (seeded branching run map)
_Stage: 3 — The Run · Status: not started_

## Goal
The Slay the Spire-style map that turns fights into a run: a seeded, layered DAG of typed nodes
(fight / elite / event / shop / rest / boss) the player routes through. Route choice is the
build-strategy skill layer. Lives in `src/engine/run/` — pure TS, seeded, unit-tested.

## Success Criteria
- [ ] `generateMap(seed)` produces a **layered DAG ~7 floors deep** with 2–3 reachable choices per floor,
      every node reachable from the start, every path reaching the boss, and edges only between adjacent
      floors — asserted by graph-invariant property tests across many seeds.
- [ ] **Node-type distribution constraints hold on every path**: any start→boss path contains 8–12
      encounters (fights+elite, within the v1 target), ≥1 rest, and the boss terminal; the map overall
      contains ≥1 elite, exactly 1 shop... (constraint set encoded as a property test; exact mix constants
      in config, sim-tunable).
- [ ] **Same seed ⇒ identical map** (deep-equal across 1000 regenerations); different seeds produce
      structurally different maps (sanity check on a sample).
- [ ] **Navigation API**: current node, legal next nodes (only adjacent-floor connected), visited path;
      illegal jumps rejected. Serializable plain-data MapState.
- [ ] **Difficulty scalar** exposed per floor (config curve) that encounter generation consumes — deeper
      floors yield scaled enemy stats, unit-asserted.

## How We'll Verify
1. `npm test`: graph-invariant property tests (fast-check over seeds), distribution constraints,
   determinism repeats, navigation legality fixtures. `src/engine/` coverage stays ≥80%; tsc clean.
2. Downstream, the full-run sim (feature-run-lifecycle) exercises thousands of generated maps end to end —
   any generator pathology (dead ends, unreachable boss) surfaces there as a hard failure.

## Verification Log
(empty until verification actually happens — a feature with an empty log can never be `verified done`)

## Open Questions
- Exact floor count / branching factor for best route tension (7 deep × 2–3 wide is the starting point —
  tune with Cam's on-device feel in the milestone build).
- Whether event nodes should be able to substitute for a rest on some paths (variance vs guarantee).

## Notes & Decisions
- Structural defaults locked in decisions.md ("Stage 3 structural defaults", 2026-07-15).
- Map seed derives from the run seed via the sim's established deriveSeed tree so runs are fully
  reproducible end to end.
