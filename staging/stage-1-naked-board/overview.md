# Stage 1 — Naked Board

_Status: not started · Folder: `staging/stage-1-naked-board/`_

## Goal
Prove the core is fun BEFORE building any rogue-lite wrapper around it. Dungeon Cascades' single biggest
named risk is "the core isn't fun," so this stage builds only the naked drag-path match-3 board — no
combat, no map, no relics — and ends in an explicit **FUN GATE**: Cam plays it on his iPhone and records
a continue / pivot / kill decision in `docs/decisions.md`. Everything downstream (Stages 2–5) is gated on
that decision. If the naked board isn't fun, we kill or pivot here, cheaply.

## First task (no code exists yet)
Only docs exist after scaffolding. The very first Stage 1 task is to **create the Expo TypeScript app
skeleton** before any feature work:
- Expo + React Native + TypeScript app, with **expo-router** for navigation.
- **Jest + ts-jest** configured for unit tests; coverage reporting enabled.
- The `src/` structure from the architecture sketch in the brief: `src/engine/` (pure TS, ZERO React/RN
  imports), `src/ui/`, `src/state/`.
- App must launch in **Expo Go** on Cam's iPhone (no custom native build needed — all Stage 1 libraries
  run in Expo Go).

## Features
- [ ] `feature-board-engine.md` — headless pure-TS engine: grid state, seeded tile spawn, drag-path move
      resolution, match detection, cascade/combo resolution, gravity/refill.
- [ ] `feature-drag-input-ui.md` — Skia board renderer + gesture drag-path input + visible move timer.
- [ ] `feature-sim-bot.md` — headless random-path + greedy bots and a stats CLI over N seeded games.
- [ ] `feature-device-performance.md` — the 60fps tech spike + the fun-gate build and recorded decision.

## Definition of done (testable checklist)
Stage 1 is done only when EVERY box below can be checked with real evidence:

- [ ] The engine resolves drag-path moves — swaps, match detection, cascades, gravity and seeded refills
      — **deterministically under a seed**, with Jest unit tests achieving **≥80% coverage on
      `src/engine/`**.
- [ ] The **random-path and greedy** sim bots complete **1000 headless seeded games without error** and
      produce a stats report (avg combos/move, cascade-depth distribution, resolution time).
- [ ] The board **renders on Skia** and a **finger drag-path move works on Cam's iPhone via Expo Go**,
      with a **visible move timer** counting down once the held tile first moves.
- [ ] The build sustains **~60fps during drag + cascade on-device** (measured, not eyeballed).
- [ ] **Cam plays it and records an explicit continue / pivot / kill decision in `docs/decisions.md`**
      (the FUN GATE). Claude never declares feel "done" — only Cam can.

## Notes
- Board mechanic parameters (board size 6×5 vs 7×6, timer length, diagonal moves, refill RNG model) are
  open questions to settle DURING this stage, largely at the fun gate. See each feature's Open Questions.
- Status state machine for every feature: not started → in progress → awaiting verification → verified
  done. `verified done` REQUIRES a dated Verification Log entry with real evidence — no exceptions.
- A kill or pivot at the fun gate is a SUCCESSFUL outcome of Stage 1 (the stage exists to make that call
  cheap and early), not a failure.
