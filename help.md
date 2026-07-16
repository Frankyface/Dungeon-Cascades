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

- [ ] **Verify Node.js 20+ and npm are installed on the Windows dev machine.**
  What: confirm a current Node.js LTS (version 20 or newer) and npm are installed and on
  PATH (`node -v` and `npm -v`).
  Why: Expo / React Native tooling and the Jest test suite need a modern Node runtime;
  this is the prerequisite for the very first Stage 1 task (creating the Expo app).
  Link: https://nodejs.org
  Blocks: **Stage 1** first task (scaffolding the Expo app).
