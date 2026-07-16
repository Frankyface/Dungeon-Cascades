# Stage 2 — Combat

_Status: in progress (started 2026-07-15) · Folder: `staging/stage-2-combat/`_
_Gate note: originally gated on the Stage 1 fun gate; Cam explicitly directed building ahead while his
TestFlight verdict is pending (see decisions.md "Build Stages 2–5 ahead of the fun-gate verdict"). If the
verdict is pivot/kill, this work stops and the verdict governs._

## Goal
Make matching **mean something**. Stage 1 proves the drag-path cascade board is fun in a vacuum; Stage 2
attaches consequences: tile colors map to actions (attack, block, etc.), a single enemy telegraphs its
intent, and turn-based combat resolves your drag-move into damage/block against it. Still no map / relics
/ run — just one board versus one enemy, enough to prove combat is satisfying.

## Features
- [x] `feature-tile-taxonomy.md` — DECIDED (offense-first affinity model) and implemented data-driven.
      (verified done 2026-07-15)
- [x] `feature-enemy-encounters.md` — 3 enemies, trustworthy telegraphs, turn order. (verified done
      2026-07-15)
- [~] `feature-combat-resolution.md` — combat math verified; sim balance bands + Cam's on-device win
      remain. (in progress 2026-07-15)

## Definition of done (testable checklist)
- [x] The **tile taxonomy is decided and recorded** in `docs/decisions.md`, and the engine implements the
      chosen tile types. (evidence: feature-tile-taxonomy.md Verification Log, 2026-07-15)
- [x] **Combat math is unit-tested** (combo → damage/heal scaling, HP, win/lose conditions) with Jest,
      TDD, `src/engine/` ≥80% coverage (combat module itself 100%). (evidence: feature-combat-resolution.md
      Verification Log, 2026-07-15)
- [x] At least one **enemy with a telegraphed intent** exists (three do), and combat runs turn-based.
      (evidence: feature-enemy-encounters.md Verification Log, 2026-07-15)
- [ ] **Sim balance bands pass** (greedy-combat ≥80% win, random ≤40% on 2+, turns-to-win median 4–12,
      byte-deterministic reports — see feature-combat-resolution.md).
- [ ] Cam can **beat a scripted encounter on-device** — a full win by playing drag-path moves. (Human gate.)

## Notes
- Combat lives in `src/engine/combat/` (tile→action mapping, enemy intents, damage/block math) per the
  architecture sketch — pure TS, seeded, unit-tested like the board engine.
- Spec detail is intentionally MODERATE at this stage; feature files carry goals, rough criteria, and open
  questions, with verification steps rougher than Stage 1. Sharpen success/verify sections when Stage 1
  nears its fun gate.
- Open: the **combo → damage scaling curve** and the **tile taxonomy** are the two biggest unresolved
  design questions and are owned by features in this stage.
