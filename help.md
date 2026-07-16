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

- [ ] **Active Apple Developer Program membership (now needed — TestFlight path chosen).**
  What: an active Apple Developer Program membership ($99/yr). Cam may already have one
  from the earlier drill-deck app.
  Why: Cam has chosen to run the Stage 1 fun gate through TestFlight (not local Expo Go),
  so a paid membership is required NOW, not just at Stage 5 — TestFlight cannot distribute
  a build without it.
  Link: https://developer.apple.com/account
  Blocks: **the TestFlight fun-gate build** (see next item).

- [ ] **TestFlight: ONE command left — the first interactive submit.**
  Status 2026-07-16: ✅ EAS project linked, ✅ signing credentials on file, ✅ **production .ipa built**
  (build eb16630d, "finished"). The only remaining step needs your Apple sign-in, interactively:
  1. In the project folder run: `npx eas-cli submit -p ios --latest`
  2. It will ask you to pick/create the App Store Connect app (bundle `com.frankyface.dungeoncascades`)
     and sign in to Apple; approve, and it uploads the finished build to TestFlight.
  3. First time only — it can store an App Store Connect API key so future submits are automatic.
  4. Then App Store Connect → TestFlight → add yourself as internal tester → build appears in the
     TestFlight app in minutes.
  Blocks: **testing via TestFlight** (Expo Go via `npm run dev` works right now regardless).

- [x] ~~Build & push to TestFlight — run the authenticated commands~~ (superseded by the item above —
  build already produced 2026-07-16; original steps kept below for reference).
  **Original item:**
  The repo is fully configured for this: bundle id `com.frankyface.dungeoncascades`,
  `eas.json` with a `production` profile (auto-incrementing build numbers), app name
  "Dungeon Cascades". Claude cannot run these because each needs YOUR credentials
  (Expo account + Apple ID) — entering those is yours to do. In the project folder:
  1. `npm install -g eas-cli` (or use `npx eas-cli@latest` for each command below).
  2. `eas login` — sign in to your Expo account (create a free one at https://expo.dev if needed).
  3. `eas init` — links this repo to a new EAS project and writes the project id into
     `app.json` (commit that change afterward, or ask a Claude session to).
  4. In **App Store Connect**, create the app record first: My Apps → + → New App, and set
     the bundle id to **`com.frankyface.dungeoncascades`** (must match exactly, or the
     submit fails with "No suitable application records found").
  5. `eas build -p ios --profile production` — the first run prompts for your Apple ID to
     generate the distribution certificate + provisioning profile (let EAS manage them).
  6. `eas submit -p ios --profile production` — uploads the build to TestFlight. It will
     ask for your Apple ID / the App Store Connect app; provide them at the prompt.
     (Shortcut for steps 5–6 combined: `npx testflight`.)
  7. In App Store Connect → TestFlight, add yourself as an internal tester; the build
     appears in the TestFlight app on your iPhone within a few minutes (no review needed
     for internal testers).
  Note: the app currently uses the default Expo icon (placeholder) — fine for TestFlight;
  swap in real art before any public release.
  Blocks: **the Stage 1 fun gate** (below).

- [x] **Verify Node.js 20+ and npm are installed on the Windows dev machine.**
  What: confirm a current Node.js LTS (version 20 or newer) and npm are installed and on
  PATH (`node -v` and `npm -v`).
  Why: Expo / React Native tooling and the Jest test suite need a modern Node runtime;
  this is the prerequisite for the very first Stage 1 task (creating the Expo app).
  Link: https://nodejs.org
  Blocks: **Stage 1** first task (scaffolding the Expo app).
  ✅ Verified 2026-07-15 by a Claude session: Node v24.15.0, npm 11.16.0.

- [ ] **Provide sounds & graphics for Stage 5 (you offered — here's the shopping list).**
  What: the assets Stage 5 integrates. Sounds (short SFX, .wav or .m4a): tile pickup, swap tick,
  match-clear pop, cascade chain (rising pitch variants welcome), enemy hit, weakness hit, player hurt,
  heal, victory sting, defeat sting, UI tap. Optional: one ambient/music loop. Graphics: 5 tile faces
  (R/G/B/Y/P — readable at ~55px), enemy art for slime/skeleton/bat + one boss, app icon (1024×1024),
  splash image, and optionally relic icons (~12) and node-type map icons (fight/elite/event/shop/rest/boss).
  Why: the build intentionally stops after Stage 4 until these arrive (decisions.md, 2026-07-15) — juice
  and art integration happen against your real assets, not placeholders.
  Blocks: **Stage 5** only.

- [ ] **Run the Stage 1 fun gate on your iPhone (the big one).**
  What: the naked board is built and all automated checks pass. Playing it and judging it
  is yours alone: (1) install the TestFlight build from the item above (or, for a faster
  loop, `npx expo start` + Expo Go); (2) drag tiles, build cascades, feel the ~5s timer;
  (3) watch the frame rate during a drag and during a big cascade — in a TestFlight
  (release) build use Xcode/Instruments or just judge visible smoothness, since the JS
  performance overlay is a dev-build feature; note what you observe; (4) play until you have a verdict and
  then record it, dated, in `docs/decisions.md` as `## <date> — Stage 1 fun gate` with
  **continue**, **pivot**, or **kill** and a sentence or two of why. Also paste your FPS
  numbers into `staging/stage-1-naked-board/feature-device-performance.md`'s Verification
  Log. A pivot/kill verdict is a SUCCESSFUL outcome of Stage 1 — don't force a continue.
  Why: this is the kill/pivot gate the whole project is staked on; feel and fps can only
  be judged on-device by you.
  Blocks: **Stage 1 completion and everything after it.**
