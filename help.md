# help.md — Things only Cam can do

This is the running checklist of actions that Claude cannot perform and that only Cam
(the human) can clear — installs, accounts, on-device steps, physical devices, and
anything requiring Cam's credentials or judgment. Each item says what it is, why it is
needed, a link if one is known, and which stage it blocks.

> Sessions append new items here whenever they hit a wall that only Cam can clear. Do
> not delete items — check them off `[x]` when done and leave them in place as a record.

## Checklist

- [ ] **Install Expo Go on Cam's iPhone.**
  What: the Expo Go app from the iOS App Store, used to run the game on-device without a
  custom native build.
  Why: Stage 1 is verified on-device — the ~60fps drag+cascade tech spike and the fun
  gate both require playing the naked board on Cam's actual iPhone. All the Stage 1
  libraries (Skia, Reanimated, Gesture Handler) run inside Expo Go, so no Apple
  Developer account is needed for this.
  Link: https://apps.apple.com/app/expo-go/id982107779
  Blocks: **Stage 1** on-device testing and the fun gate.

- [ ] **Confirm Apple Developer account status.**
  What: check whether Cam already has an active Apple Developer Program membership —
  Cam may already have one from the earlier drill-deck app.
  Why: a Developer account is required for TestFlight distribution so friends can play.
  It is **only** needed at Stage 5; Stage 1 works in Expo Go without it, so this is not
  urgent — just confirm the status before Stage 5.
  Link: https://developer.apple.com/account
  Blocks: **Stage 5** (TestFlight / sharing with friends) only.

- [x] **Verify Node.js 20+ and npm are installed on the Windows dev machine.**
  What: confirm a current Node.js LTS (version 20 or newer) and npm are installed and on
  PATH (`node -v` and `npm -v`).
  Why: Expo / React Native tooling and the Jest test suite need a modern Node runtime;
  this is the prerequisite for the very first Stage 1 task (creating the Expo app).
  Link: https://nodejs.org
  Blocks: **Stage 1** first task (scaffolding the Expo app).
  ✅ Verified 2026-07-15 by a Claude session: Node v24.15.0, npm 11.16.0.

- [ ] **Run the Stage 1 fun gate on your iPhone (the big one).**
  What: the naked board is built and all automated checks pass. Playing it and judging it
  is yours alone: (1) `npx expo start` in the project folder, scan the QR with Expo Go on
  your iPhone; (2) drag tiles, build cascades, feel the ~5s timer; (3) open the Expo dev
  menu (shake the phone) → "Show performance monitor" and watch the UI/JS FPS during a
  drag and during a big cascade — note the numbers; (4) play until you have a verdict and
  then record it, dated, in `docs/decisions.md` as `## <date> — Stage 1 fun gate` with
  **continue**, **pivot**, or **kill** and a sentence or two of why. Also paste your FPS
  numbers into `staging/stage-1-naked-board/feature-device-performance.md`'s Verification
  Log. A pivot/kill verdict is a SUCCESSFUL outcome of Stage 1 — don't force a continue.
  Why: this is the kill/pivot gate the whole project is staked on; feel and fps can only
  be judged on-device by you.
  Blocks: **Stage 1 completion and everything after it.**
