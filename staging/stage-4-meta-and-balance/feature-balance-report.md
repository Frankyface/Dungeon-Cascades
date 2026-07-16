# Feature: Balance Report at Scale (the project's tuning instrument)
_Stage: 4 — Meta & Balance · Status: awaiting verification (built + pinned; full-scale double-run tonight)_

## Goal
One deterministic sim command producing the full balance picture, and at least one evidence-driven tuning
action taken from it (or a documented, evidence-backed "no change needed"). This is the "mostly automated"
convention's payoff: balance proven by numbers, not vibes.

## Success Criteria
- [ ] `--mode report` (or equivalent) runs the full matrix in one command: vanilla + every variant
      (policy bot, config N games each) and emits: win rate per variant (with the ±5pp purity verdict),
      deaths by cause/floor, encounters + moves distributions, boss-reached rate, relic draft→win-rate
      correlation (per-relic: win% of runs that drafted it vs base rate), gold earned/spent averages.
- [ ] **Byte-deterministic**: same flags twice ⇒ identical stdout (timing to stderr).
- [ ] **Evidence → action**: from the report, either (a) one concrete tuning change (constants only,
      recalibration-precedent rules: pinned expectations updated with shown reasoning, bands re-verified
      after), or (b) a documented no-change verdict citing the specific numbers that justify it.
- [ ] A Jest regression pins a small fixed-seed report so drift is caught by `npm test`.
- [ ] Stage 1–3 baselines byte-identical after any tuning.

## How We'll Verify
1. Run the report command twice; diff empty; paste the report.
2. If tuning: re-run affected bands + baselines; before→after in the log. If no-change: the cited numbers.
3. `npm test` green; tsc clean; coverage ≥80%.

## Verification Log
### 2026-07-16 — Built, deterministic at pinned scale, verdict recorded; default-scale double-run tonight
- `--mode report` built: full matrix (vanilla first as purity reference + all variants over identical
  seed trees), purity verdicts at ±5pp, deaths by cause/floor, encounter/move distributions, boss-reached,
  per-relic draft→win correlation with pick counts, gold flow. `--games` override supported (default 2000).
  Deterministic stdout (timing → stderr); Jest fixed-seed pin catches drift via `npm test`.
- **Evidence→action verdict: NO CHANGE** — at N=1000 every Stage-3 band sits comfortably in-gate (38.8%
  win vs 25–75; encounters median 11 vs 8–12; moves median 57 vs 30–90; 0 wedges). Watch item recorded:
  floors 1–2 hold 52.2% of deaths (front-loaded difficulty) — re-examine at 2000-run resolution.
  Bot never drafts misers-knuckle (policy-heuristic artifact, not a constants problem).
- REMAINING: the default-scale (2000-game) double-run + diff — command in feature-meta-variants.md,
  scheduled tonight per Cam. Baselines byte-identical after all Stage 4 + boss-fix changes.

## Open Questions
- Report runtime budget: full matrix at 2000 games × 7 configs is ~40–80 min — acceptable for a manual
  tuning instrument; the Jest pin uses a small batch. Flag if it needs a --games override for quick looks.
- Relic correlation sample-size caveats (low-pick relics have noisy win rates — report picks count too).

## Notes & Decisions
- The report is the Stage 5+ regression instrument as well: run it before any future balance-touching
  change and diff the verdicts.
