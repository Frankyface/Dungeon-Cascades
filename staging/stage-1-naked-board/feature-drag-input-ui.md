# Feature: Drag Input UI (Skia board + gesture drag-path + move timer)
_Stage: 1 — Naked Board · Status: awaiting verification_

## Goal
The on-device face of the naked board: a `@shopify/react-native-skia` canvas that renders the grid and,
via `react-native-gesture-handler` + `react-native-reanimated`, lets a finger pick up a tile and drag a
path through the grid. The held tile follows the finger, swaps animate, cascades animate legibly, and a
**move timer** (~5s default) is visible and counts down once the held tile first moves. This is what Cam
actually touches — it drives the engine and makes the core feel real.

## Success Criteria
- [ ] On Cam's iPhone in Expo Go, the board renders as a Skia canvas of colored tiles laid out as the
      configured grid.
- [ ] Touching a tile **picks it up**; while dragging, the **held tile follows the finger** and **swaps
      with each tile it passes** (orthogonal steps in v1), so the on-screen board matches what the engine
      resolves for that path.
- [ ] A **move timer** is visible and **starts counting down when the held tile first moves**; on
      **release or timeout** the move ends and resolution plays.
- [ ] **Swaps animate** as the finger moves and **cascades animate legibly** — a player can see which
      groups cleared, tiles falling, and new tiles dropping in, rather than the board snapping instantly.
- [ ] The resolved move's **combo count is surfaced on screen** so Cam can feel that engineering bigger
      cascades pays off.

## How We'll Verify
This feature is exercised on-device (rendering + feel can't be fully asserted headlessly), via a scripted
manual procedure:
1. `npx expo start`, open in **Expo Go on Cam's iPhone**.
2. Manual step: touch a tile and drag a short orthogonal path. **Expected:** the held tile follows the
   finger and each passed tile swaps behind it, mirroring the engine's resolution.
3. Manual step: start a move and watch the timer. **Expected:** timer is idle until the first move, then
   counts down (~5s default); letting it hit zero OR releasing ends the move and triggers resolution.
4. Manual step: deliberately build a 3+ match. **Expected:** matched groups clear with visible animation,
   tiles fall, new tiles drop from the top, cascades chain, and the combo count updates on screen.
5. Any pure logic extracted for the UI (e.g. pixel→grid-cell mapping, path building) gets Jest unit tests
   run with `npm test`; the engine itself is verified separately in `feature-board-engine.md`.

## Verification Log
### 2026-07-15 — Automated portion executed by manager session — PASS; on-device steps remain for Cam
- Code complete: Skia canvas board (6×5, 5 colors), gesture drag with dead-zone hysteresis (commit at pitch/2 + 0.18·pitch on the dominant axis), one-way 5s timer latch, wave-by-wave resolution animation, running "Combo ×N" + last-move total, input locked while resolving. All UI knobs in `src/ui/board/constants.ts`.
- `npm test` → 16 suites / 100 tests green, including 6 UI-logic suites / 42 tests (layout, hysteresis, path builder, timer, resolution replay, game reducer). The resolution-replay test pins the UI to the engine: the last replayed snapshot must deep-equal the engine's `finalBoard`.
- `npx tsc --noEmit` → exit 0 (strict). `npx expo export --platform ios` → exit 0, 4.1MB Hermes bundle. Engine untouched (grep guard clean).
- NOT verified (Cam's manual steps 2–4): on-device drag feel, timer behavior under a real finger, cascade legibility, fps. Status stays `awaiting verification` until Cam runs the procedure above via Expo Go — see `help.md`.
- Backtrack note: dragging back into the previous cell is a normal reverse step (P&D semantics — swap and inverse swap cancel); verified by unit test.

## Open Questions
- **Drag timer length** (~5s default) and whether it is fixed or later relic-modifiable — settle during
  Stage 1 / revisit later.
- **Diagonal drag** input: v1 is orthogonal-only; whether to allow diagonals is revisited at the fun gate
  and would need matching engine support.
- **State library** bridging engine ↔ UI (zustand is the proposed candidate) — decide when first needed.
- Exact animation timings/easing for swap and cascade legibility — tune on-device.

## Notes & Decisions
- Locked context (`docs/decisions.md`, 2026-07-15): Skia + Reanimated + Gesture Handler chosen for a
  60fps canvas board and drag input without adopting a game engine; all three run in Expo Go, so Stage 1
  needs no custom native build.
- The UI must NOT re-implement match/cascade logic — it renders and animates what `src/engine/` resolves.
  Keep the engine timer-agnostic; the countdown timer lives here in the UI.
