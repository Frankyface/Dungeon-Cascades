# Feature: Run UI (map, draft, shop, event, rest, victory/defeat screens)
_Stage: 3 — The Run · Status: awaiting verification (built + automated gates green; on-device flows are Cam's)_

## Goal
The screens that make the run playable on-device: a map screen (route choice), draft screen (pick 1 of 3),
shop / event / rest screens, and victory/defeat endings — all thin renderers over engine RunState,
navigated with expo-router, consistent with the Stage 1/2 board+combat screens. Placeholder-grade art;
readability over beauty.

## Success Criteria
- [ ] **Map screen**: renders the generated DAG (floors bottom-to-top or left-to-right), shows node types
      distinctly (icon/glyph per type), current position, and ONLY legal next nodes as tappable; tapping
      navigates into that node's screen. Visited path visibly marked.
- [ ] **Draft screen**: after fight/elite wins, shows the 3 offered relics with name/flavor/effect text;
      picking one adds it to the run and returns to the map; the choice is irreversible and skip is
      allowed (config).
- [ ] **Shop / event / rest screens**: stock with prices + gold balance (shop); event text + 2–3 choice
      buttons with outcomes applied (event); heal action with before/after HP (rest); leaving is always
      available; all mutations go through engine functions — zero game logic in components.
- [ ] **Run HUD**: persistent HP, gold, relic count (tappable → owned-relic list) across run screens.
- [ ] **Victory/defeat screens**: reached on boss win / any death; show run summary (encounters cleared,
      relics, gold, total combos); "New run" resets cleanly.
- [ ] **Resume flow**: app cold-start with a saved run offers Continue (loads via the storage adapter) or
      Abandon; abandoning clears the save.
- [ ] **All screen logic that can be pure is pure and unit-tested** (`.ts` view-models: map layout math,
      legal-move filtering, summary computation), following the Stage 1 UI pattern; components stay thin.

## How We'll Verify
1. `npm test`: view-model unit tests green; full suite green. `npx tsc --noEmit` exit 0.
2. `npx expo export --platform ios` → bundles clean.
3. Storage adapter smoke: jest test with a mock port proves the UI save/resume wiring calls the engine
   round-trip correctly (device persistence itself is confirmed in Cam's on-device pass).
4. On-device (Cam, with feature-run-lifecycle's human gate): navigate a full run through every node type;
   kill and reopen the app mid-run to verify Continue.

## Verification Log
### 2026-07-15 — Built; automated portion verified — on-device flows remain for Cam
- All screens live under `app/run/*` with a phase-driven RunProvider: map (13-floor DAG, glyphs, legal-node
  tapping), draft (pick/skip), shop/event/rest, encounter (reused combat screen with injected
  `playEncounterTurn` — relic-modified damage numbers and per-phase boss affinity flow through), victory/
  defeat summaries, HUD (HP/gold/floor/relics), menu Continue/Abandon.
- async-storage installed (the stage's one new dependency); `AsyncStorageRunStore` adapter is UI-side only
  (engine purity intact — grep shows no engine import; two doc-comment mentions only). Save fires on every
  committed action; in-memory round-trip proven deep-equal at every checkpoint; clear-on-terminal tested.
- 39 UI view-model tests green (total suite 415); tsc clean; `npx expo export --platform ios` clean (4.3MB).
- REMAINING (Cam, on-device): full run through every node type; kill+reopen mid-run → Continue resumes.

## Open Questions
- Map rendering approach: plain RN views + absolute layout vs a Skia canvas (default: plain RN — the map
  is static UI, save Skia for the board).
- How weaknesses/resistances surface pre-fight (map node preview? in-combat only?) — combat UI carries an
  intent+affinity display; decide preview at build time and flag for Cam's feel pass.
- Async-storage dependency install (`@react-native-async-storage/async-storage` via `npx expo install`) —
  the ONE new dependency this stage; the UI build agent owns package.json for it.

## Notes & Decisions
- Components render engine state; every tap calls an engine function and re-renders the result. No
  gameplay rules in the UI layer — the full-run sim must be able to play the identical run headlessly.
- expo-router file-based routes for the new screens; keep the board/combat screen as the fight route.
