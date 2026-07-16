# Handoff — Dungeon Cascades
_Last updated: 2026-07-15 · Current stage: stage-1-naked-board_

## 🎯 Goals
Get Cam through the Stage 1 FUN GATE. All Stage 1 code is built and every automated
check passes — what remains is Cam playing the naked board on his iPhone and recording
the continue/pivot/kill verdict.

## 📍 Current State
- Board engine: **verified done** — deterministic drag-path resolution, 52 tests, 99% coverage.
- Sim bots: **verified done** — 1000-game runs byte-deterministic; greedy 3.43 vs random 0.35
  combos/move (~9.7× skill gap: skill dominates luck on the naked board).
- Drag-input UI: **awaiting verification** — built + 42 logic tests + clean iOS bundle;
  on-device feel untested.
- Device perf + fun gate: **awaiting verification** — build ready; no fps numbers, no verdict yet.
- Suite: 16 suites / 100 tests green · `npx tsc --noEmit` clean · `npx expo export` clean.

## 📂 Files I'm Working On
- `staging/stage-1-naked-board/feature-device-performance.md` — the active feature (Cam's fun gate).
- `help.md` — has Cam's exact fun-gate procedure.

## ✅ Things I've Changed
- 2026-07-15 — Skia drag-input UI built (`src/ui/board/`, `app/index.tsx`); awaiting on-device check.
- 2026-07-15 — Sim bots + stats CLI built and verified (`src/engine/sim/`, `npm run sim`).
- 2026-07-15 — Board engine built and verified (`src/engine/board/`).
- 2026-07-15 — Refill RNG settled by structured debate: uniform random behind a seeded TileSource seam.
- 2026-07-15 — Expo SDK 57 skeleton (ts-jest pipeline, Skia/Reanimated/Gesture Handler).

## ❌ Watch Out
- Greedy sim runs cost ~100s per 1000 games (DFS depth 4) — drop `greedyMaxDepth` to 3 for fast iteration.
- Jest discovers tests via `testRegex` (not `testMatch`) because the repo path contains a dot-directory.
- UI must never re-implement engine logic — the replay test pins UI output to `finalBoard`; keep it green.

## ➡️ Next Up
1. **Cam:** run the fun gate (procedure in `help.md`): `npx expo start` → Expo Go → play →
   fps numbers into feature-device-performance.md → verdict into `docs/decisions.md`.
2. If verdict = continue: flip the two awaiting-verification features per their logs, close
   Stage 1 in `overview.md`, then spec Stage 2's tile taxonomy (`staging/stage-2-combat/`).
3. If pivot/kill: record it in `docs/failed-approaches.md` + decisions.md — that is a
   successful Stage 1 outcome, not a failure.

## 🔗 Pointer
Current stage folder: `staging/stage-1-naked-board/`
Active feature file: `staging/stage-1-naked-board/feature-device-performance.md`
