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
- Device perf + fun gate: **awaiting verification** — build ready, TestFlight/EAS configured; no verdict yet.
- Suite: 16 suites / 100 tests green · `tsc` clean · `expo export` clean · `expo-doctor` 20/20.

## 📂 Files I'm Working On
- `staging/stage-1-naked-board/feature-device-performance.md` — the active feature (Cam's fun gate).
- `help.md` — has Cam's exact fun-gate procedure.

## ✅ Things I've Changed
- 2026-07-15 — TestFlight/EAS configured: bundle id `com.frankyface.dungeoncascades`, `eas.json`, app renamed from tmp-expo.
- 2026-07-15 — Skia drag-input UI built (`src/ui/board/`, `app/index.tsx`); awaiting on-device check.
- 2026-07-15 — Sim bots + stats CLI built and verified (`src/engine/sim/`, `npm run sim`).
- 2026-07-15 — Board engine built and verified (`src/engine/board/`).
- 2026-07-15 — Refill RNG settled by structured debate: uniform random behind a seeded TileSource seam.

## ❌ Watch Out
- Greedy sim runs cost ~100s per 1000 games (DFS depth 4) — drop `greedyMaxDepth` to 3 for fast iteration.
- Jest discovers tests via `testRegex` (not `testMatch`) because the repo path contains a dot-directory.
- UI must never re-implement engine logic — the replay test pins UI output to `finalBoard`; keep it green.

## ➡️ Next Up
1. **Cam:** push to TestFlight — run the authenticated commands in `help.md` (`eas login`
   → `eas init` → `eas build -p ios --profile production` → `eas submit`). Needs your Expo +
   Apple logins, so Claude can't run them; everything else is configured.
2. **Cam:** play the TestFlight build; record continue/pivot/kill in `docs/decisions.md`
   (+ perf notes in feature-device-performance.md). That closes the fun gate.
3. If continue: flip the two awaiting-verification features, close Stage 1 in `overview.md`,
   spec Stage 2 tile taxonomy. If pivot/kill: log it — a successful Stage 1 outcome.

## 🔗 Pointer
Current stage folder: `staging/stage-1-naked-board/`
Active feature file: `staging/stage-1-naked-board/feature-device-performance.md`
