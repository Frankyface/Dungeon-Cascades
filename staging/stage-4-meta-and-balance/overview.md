# Stage 4 — Meta & Balance

_Status: not started (sketch only) · Folder: `staging/stage-4-meta-and-balance/`_
_Gated on: Stage 3 complete (a full run is playable). Feature files will be specced when Stage 3 nears
completion._

## Goal
Make the game **keep** being fun across many runs. Add light meta-progression between runs, scale up the
simulation harness to tune difficulty and balance, and use sim-driven balance reports as the evidence. The
guiding principle: meta-unlocks add **VARIETY, not raw power** (skill purity — the game must not become
win-by-grinding).

## Scope (from the brief; to become feature files later)
- **Meta-unlocks** that persist between runs and expand variety (new relics / events / enemies / build
  options) rather than flat power increases.
- **Simulation harness at scale**: hundreds/thousands of seeded full runs by headless bots, producing
  win-rate and balance statistics.
- **Difficulty tuning** driven by those sim reports.

## Definition of done (rough — sharpen when specced)
- [ ] A **balance report generated from simulations** exists (win rates, run-length distribution,
      combo/damage stats at scale) and informs concrete tuning changes.
- [ ] **Meta-unlocks persist between runs** in local storage and demonstrably add variety, not raw power.
- [ ] The at-scale sim harness runs deterministically under seeds (same seeds ⇒ same balance report).

## Notes
- This is where the "mostly automated" verification convention pays off most — balance is proven by sims,
  not vibes.
- Meta-progression purity (variety not power) is an open design question (brief §5 / `docs/decisions.md`)
  to resolve concretely here.
- Do NOT write feature files yet; sketch only.
