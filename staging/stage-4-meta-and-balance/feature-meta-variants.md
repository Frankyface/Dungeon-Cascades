# Feature: Starting Variants & Meta-Progression (sim-verified sidegrades, cumulative-score unlocks)
_Stage: 4 — Meta & Balance · Status: not started_

## Goal
Implement the decided meta shape (decisions.md 2026-07-15, "Meta-progression shape"): power-neutral
**starting variants** unlocked by **cumulative-score tranches**. Vanilla always available; every variant
is a sidegrade whose purity is machine-enforced by the full-run sim. Engine work in `src/engine/run/`
(variants, meta state) — persistence port mirrors `RunStorePort`.

## Success Criteria
- [ ] **~6 variants as pure data**, each a set of typed run-start modifiers (start relic, gold delta,
      max-HP delta, map reveal, config tweaks — expressible without new engine mechanics). Starting slate
      from the debate (Ember Start, Merchant's Debt, Blood Pact*, Monochrome, Glass Cannon, Cartographer)
      — *any variant needing a new mechanic (e.g. Blood Pact's heal-as-damage) may be REPLACED by a
      modifier-expressible sidegrade; document swaps. `startRun(seed, variantId?)` applies them; vanilla
      = no variant, byte-identical to today.
- [ ] **Purity gate (hard)**: each shipped variant's policy-bot win rate over **≥2000 seeded runs** is
      within **±5 percentage points** of vanilla's (same seeds, same bot). A variant outside the band is
      tuned (its own numbers only) or dropped — never shipped out-of-band. Evidence: per-variant table.
- [ ] **Cumulative score**: per-run score from floors cleared + encounters won + victory bonus (constants
      in config); accrues win or lose. `MetaState` (score, unlocked variant IDs) is serializable, persists
      via a `MetaStorePort` (in-memory impl for tests), and tranche milestones unlock variants exactly
      once, idempotent under replay/reload — unit-tested.
- [ ] **No power creep by construction**: a test asserts a fresh profile and a maxed profile produce
      IDENTICAL vanilla run-start states (same seed ⇒ same RunState).
- [ ] Stage 1–3 sim baselines byte-identical; all suites green; coverage ≥80%; purity greps clean.

## How We'll Verify
1. `npm test` — variant application fixtures, score/tranche/idempotency tests, no-power-creep assertion,
   MetaState round-trip. tsc clean.
2. Sim: `--mode run --bot policy --games 2000 --seed 42` for vanilla and per `--variant <id>`; paste the
   win-rate table; byte-determinism diff on one variant command.
3. Baseline reruns (Stage 1 board, Stage 2 skeleton, Stage 3 vanilla run sim at 1000 → 38.8%).

## Verification Log
(empty until verification actually happens — a feature with an empty log can never be `verified done`)

## Open Questions
- Final six variants and their exact numbers (agent proposes, purity gate disposes).
- Tranche milestone values (score-per-run averages ~how many runs per unlock? target: first unlock within
  2–3 runs, full slate by ~15–20 runs — tune constants to that pacing arithmetic).
- Whether the UI shows locked variants with unlock progress (UI feature decision).

## Notes & Decisions
- Purity band, trigger model, and v2 revisit path are locked in decisions.md — do not re-litigate here.
