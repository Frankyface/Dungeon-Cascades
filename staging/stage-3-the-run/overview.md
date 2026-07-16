# Stage 3 — The Run

_Status: not started (sketch only) · Folder: `staging/stage-3-the-run/`_
_Gated on: Stage 2 complete (combat beatable on-device). Feature files for this stage are intentionally
NOT written yet — they will be specced when Stage 2 nears completion, so they don't rot in the meantime._

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

## Definition of done (rough — sharpen when specced)
- [ ] Cam can **complete a real 15–20 minute run start to finish** on-device: navigate the map through
      8–12 encounters, draft rewards, use shops/events/rest, and reach the boss.
- [ ] **Death ends the run** and **beating the boss is a victory** — both resolve cleanly.
- [ ] Run state **saves** to local device storage so a run persists as expected.
- [ ] Run-layer logic (map generation, drafting, economy, save state) lives in `src/engine/run/`, seeded
      and unit-testable like the rest of the engine.

## Notes
- Local device storage only (async-storage vs MMKV is an open question — decide when first needed here).
- Meta-progression BETWEEN runs is Stage 4, not here — Stage 3 is a single complete run.
- Do NOT write feature files yet; this sketch exists to hold the shape of the stage without over-committing
  detail that would go stale before Stage 2 lands. Truth hierarchy: reality > handoff > stage files > docs.
