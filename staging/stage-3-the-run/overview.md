# Stage 3 — The Run

_Status: specced 2026-07-15 (features written as Stage 2 built) · Folder: `staging/stage-3-the-run/`_
_Gate note: building ahead of the Stage 1 fun-gate verdict per Cam's directive (see decisions.md); a
pivot/kill verdict stops this work._

## Features
- [ ] `feature-node-map.md` — seeded branching DAG map, node types, navigation, difficulty ramp.
- [ ] `feature-relics-drafting.md` — typed relic-hook engine, ~12-relic roster, pick-1-of-3 drafting.
- [ ] `feature-economy-nodes.md` — performance-scaled gold, shop, ~6 events, rest sites.
- [ ] `feature-run-lifecycle.md` — RunState, boss, save/load port, death/victory, the full-run sim gates.
- [ ] `feature-run-ui.md` — map/draft/shop/event/rest/victory/defeat screens + run HUD + resume flow.

## Goal
Wrap the combat core in the full rogue-lite loop. Stage 2 gives one fight; Stage 3 gives a whole **run**:
a branching Slay the Spire-style node map (fight / elite / event / shop / rest), drafting a reward
(relic/upgrade) after fights, an economy for shops, a boss at the end, and run save / death / victory
handling. One starting build in v1 ("the Adventurer" — placeholder name).

## Scope (from the brief; to become feature files later)
- **Branching node map**: fight, elite, event, shop, rest — route choice is real strategy.
- **Drafting**: pick a reward (relic/upgrade) after fights; one starting build in v1.
- **Shops / events / rest sites**: an economy and non-combat nodes.
- **Boss**: the run ends in a boss encounter.
- **Run lifecycle**: save state, death = run over (rogue-lite), victory on beating the boss.
- Target: **15–20 minute, 8–12 encounter** winnable runs.

## Definition of done (testable checklist)
- [x] **Full-run sim gates pass**: 38.8% win / 0 wedges / 1000 runs, encounters median 11, moves median
      57, byte-deterministic, trivial-policy 0%. (evidence: feature-run-lifecycle.md log, 2026-07-15)
- [x] **All engine unit gates green**: 415 tests / 51 suites; coverage ≥80%; purity clean. (2026-07-15)
- [x] **Run UI complete and bundling**: all screens live, 39 view-model tests, iOS export clean.
      (evidence: feature-run-ui.md log, 2026-07-15)
- [ ] Cam can **complete a real 15–20 minute run start to finish** on-device, and death, victory, and
      mid-run save/resume all behave. (Human gate.)
- [x] Stage 1 and Stage 2 sim baselines still reproduce — byte-identical, manager-verified. (2026-07-15)

## Notes
- Local device storage only (async-storage vs MMKV is an open question — decide when first needed here).
- Meta-progression BETWEEN runs is Stage 4, not here — Stage 3 is a single complete run.
- Do NOT write feature files yet; this sketch exists to hold the shape of the stage without over-committing
  detail that would go stale before Stage 2 lands. Truth hierarchy: reality > handoff > stage files > docs.
