# Feature: Device Performance & Fun Gate (60fps spike + kill/pivot decision)
_Stage: 1 — Naked Board · Status: awaiting verification_

## Goal
The tech spike that de-risks the stack and the milestone build that triggers the FUN GATE. It proves the
Skia + Reanimated + Gesture Handler board holds a **sustained ~60fps during drag + cascade on Cam's
iPhone** in Expo Go, and it ends with **Cam playing the naked board and recording an explicit
continue / pivot / kill decision in `docs/decisions.md`**. This is the gate the entire project is staked
on: if the core isn't fun, we stop or pivot here, before any rogue-lite wrapper exists.

## Success Criteria
- [ ] On Cam's iPhone via Expo Go, the board **sustains ~60fps during an active drag AND during cascade
      resolution** (the two most frame-hungry moments), measured — not eyeballed.
- [ ] No sustained frame drops / jank that make the drag feel bad during a normal multi-combo move.
- [ ] Cam plays the naked board and reaches a clear verdict on whether the core loop is fun.
- [ ] The verdict is recorded as an explicit **continue / pivot / kill** decision, dated, in
      `docs/decisions.md`, with a sentence or two of reasoning.

## How We'll Verify
This feature's verification is **inherently manual** — it is the one deliberate exception to the
project's mostly-automated verification convention, because both on-device frame rate under real touch
and "is it fun" are things only an on-device human session can judge. Procedure:
1. `npx expo start`; open the build in **Expo Go on Cam's iPhone**.
2. Enable the on-device performance overlay (the Expo / React Native **performance monitor** from the
   dev menu — the FPS overlay) and read the UI + JS frame rate while dragging and during cascades.
   **Expected:** frame rate holds around 60fps through drag and cascade; record the observed numbers.
3. Cam plays several moves / a short session focused purely on the feel of engineering cascades with
   drag-path moves.
4. Cam writes a dated `## <date> — Stage 1 fun gate` entry in `docs/decisions.md` stating **continue**,
   **pivot**, or **kill**, and why. Claude does not make this call and never marks feel "done" for Cam.

## Verification Log
### 2026-07-15 — Build ready; verification is Cam's and has NOT happened yet
- The fun-gate build exists: the playable naked board runs from `app/index.tsx` (`npx expo start` → Expo Go). All automated gates pass (100 tests, strict tsc, clean iOS bundle export). Sim baseline for context: greedy bot 3.43 vs random 0.35 avg combos/move (~9.7× skill gap).
- Nothing on-device has been measured — no fps numbers exist and no fun verdict exists. Cam's procedure is in `help.md` ("Run the Stage 1 fun gate on your iPhone"): play, read the performance monitor during drag + cascade, paste the fps numbers here, and record the continue/pivot/kill verdict in `docs/decisions.md`. Only that closes this feature.

## Open Questions
- Exact **fps measurement method** and threshold: the Expo/RN performance monitor is the default; whether
  a more precise capture is needed depends on how borderline the on-device result looks.
- If 60fps is NOT held: is it a fixable rendering/animation issue, or does it trigger the decisions.md
  "revisit if Skia can't hold 60fps" clause on the tech-stack decision (a potential pivot)?
- What specifically counts as "fun enough to continue" — Cam defines this at the gate; it is intentionally
  a human judgment, not a metric.

## Notes & Decisions
- Locked context (`docs/decisions.md`, 2026-07-15): "core isn't fun" is Cam's named #1 risk; the defense
  is exactly this — build the naked board first and gate everything on an on-device kill/pivot decision.
  The tech-stack decision carries an explicit "revisit if Skia can't hold 60fps" trigger this feature
  tests directly.
- A **kill or pivot** here is a SUCCESSFUL outcome of Stage 1, not a failure — the stage exists to make
  that decision cheap and early. Do not treat "continue" as the only acceptable result.
