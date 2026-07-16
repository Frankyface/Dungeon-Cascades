# CLAUDE.md — Dungeon Cascades

Mobile rogue-lite where match-3 IS the combat engine; skill = engineering cascades, not luck.
Stack: Expo + React Native + TypeScript · @shopify/react-native-skia + react-native-reanimated + react-native-gesture-handler · Jest (ts-jest) · local device storage only, no backend.

## Start here (every session)
1. Read `handoff.md` FIRST, then follow its `🔗 Pointer` into the active stage's feature file.
2. Only then, if needed: `docs/master_plan.md` (vision/roadmap), `docs/decisions.md`, `docs/failed-approaches.md`.

## Doc model (linked list)
- `CLAUDE.md` = the constant, loaded every session (this file).
- `handoff.md` = the HEAD — single source of truth for "where are we right now" (≤60 lines).
- `staging/stage-*/` feature files = the list itself; handoff's pointer names the active node.
- Truth hierarchy: actual code/system state > handoff.md > stage files > docs/master_plan.md. Reality wins — fix the docs.

## Standing commands
- When the user says "update all relevant files" → run `/sync-docs`.
- `/resume` reboots a fresh session · `/verify` runs the verification loop.

## Coding conventions
- PURE ENGINE: `src/engine/` has ZERO React/React Native imports. Deterministic, seeded RNG ONLY — never `Date.now()` or `Math.random()` inside the engine.
- TDD: write the failing test first; hold ≥80% coverage on `src/engine/`.
- TypeScript strict mode on.
- Conventional commits: `feat: / fix: / docs: / test: / chore: / refactor:`. NO AI attribution lines.
- Trunk-based on `main`; short-lived branches only for risky experiments.
- Commit at every verified-green checkpoint.

## Run & test
- `npm test` — Jest unit tests.
- `npx expo start` — Expo Go on Cam's iPhone (the PRIMARY device).
- Sim harness CLI — headless bots + stats; exists only AFTER Stage 1's sim-bot feature lands.

## Verification protocol
- Status state machine (only path): `not started → in progress → awaiting verification → verified done`.
- Finishing code moves a feature to `awaiting verification`, NEVER straight to `verified done`.
- `verified done` REQUIRES a dated Verification Log entry with real evidence. No exceptions.
- `/verify` runs the loop. Game FEEL is judged ONLY by Cam on-device — never declare feel done.

## Design north star
Skill comes from engineering cascades (PRIMARY); drag-path execution and build strategy are amplifiers. Never add mechanics that reward pure luck.
