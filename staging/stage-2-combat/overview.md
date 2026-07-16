# Stage 2 — Combat

_Status: not started · Folder: `staging/stage-2-combat/`_
_Gated on: the Stage 1 fun gate returning **continue**. Do NOT start Stage 2 until that decision is
recorded in `docs/decisions.md`._

## Goal
Make matching **mean something**. Stage 1 proves the drag-path cascade board is fun in a vacuum; Stage 2
attaches consequences: tile colors map to actions (attack, block, etc.), a single enemy telegraphs its
intent, and turn-based combat resolves your drag-move into damage/block against it. Still no map / relics
/ run — just one board versus one enemy, enough to prove combat is satisfying.

## Features
- [ ] `feature-tile-taxonomy.md` — the open design decision: what each tile color maps to (attack, block,
      mana/skill, heal, gold). Owns settling this in `docs/decisions.md`.
- [ ] `feature-enemy-encounters.md` — enemy definitions, telegraphed intents, and turn order.
- [ ] `feature-combat-resolution.md` — combo count → damage/block scaling, HP, win/lose, encounter flow.

## Definition of done (testable checklist)
- [ ] The **tile taxonomy is decided and recorded** in `docs/decisions.md`, and the engine implements the
      chosen tile types.
- [ ] **Combat math is unit-tested** (combo count → damage/block scaling, HP, win/lose conditions) with
      Jest, TDD, keeping `src/engine/` at ≥80% coverage.
- [ ] At least one **enemy with a telegraphed intent** exists, and combat runs turn-based: the player's
      drag-move resolves, then the enemy acts on its telegraphed intent.
- [ ] Cam can **beat a scripted encounter on-device** in Expo Go — a full win condition reached by
      playing drag-path moves.

## Notes
- Combat lives in `src/engine/combat/` (tile→action mapping, enemy intents, damage/block math) per the
  architecture sketch — pure TS, seeded, unit-tested like the board engine.
- Spec detail is intentionally MODERATE at this stage; feature files carry goals, rough criteria, and open
  questions, with verification steps rougher than Stage 1. Sharpen success/verify sections when Stage 1
  nears its fun gate.
- Open: the **combo → damage scaling curve** and the **tile taxonomy** are the two biggest unresolved
  design questions and are owned by features in this stage.
