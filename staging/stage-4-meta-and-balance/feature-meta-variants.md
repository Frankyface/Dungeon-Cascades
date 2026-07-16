# Feature: Starting Variants & Meta-Progression (sim-verified sidegrades, cumulative-score unlocks)
_Stage: 4 — Meta & Balance · Status: awaiting verification (built + N=1000 purity evidence; ≥2000 matrix runs tonight; Cam's restart check pending)_

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
### 2026-07-16 — Built and verified except the full-scale purity matrix (manager re-ran gates)
- 6 variants live as pure data (3 debate-slate swaps to stay modifier-expressible — see decisions.md
  "Stage 4 variant slate"). `startRun(seed, variantId?)` — vanilla byte-identical when omitted. Meta:
  score = floors + 2×wins + 10×victory; tranches 50/100/150/210/290/360 (pacing: first unlock ~2–2.5
  runs, full slate ~14.5–18 at measured 24.9 mean score/run); idempotent unlocks; no-power-creep test
  (fresh vs maxed profile ⇒ JSON-identical vanilla starts). UI: /start selection screen (locked cards
  with progress), once-guarded banking at the outcome screen, async-storage meta adapter.
- **Purity table at N=1000, seed 42, policy bot (all PASS at ±5pp):** vanilla 38.8% baseline ·
  cartographer 36.7 (−2.1) · ember-start 39.1 (+0.3) · merchants-purse 39.0 (+0.2) · vitality-pact
  40.3 (+1.5) · ironhide 38.7 (−0.1) · glass-cannon 37.1 (−1.7). Worst |Δ| 2.1pp; sampling noise
  ~±1.9pp at N=1000.
- **REMAINING — the spec's ≥2000-game gate (runs tonight per Cam):**
  `npm run sim -- --mode report --seed 42 > report_A.txt` then same `> report_B.txt`, then
  `diff report_A.txt report_B.txt` (expect empty). report_A's table closes this criterion.
  Twice killed mid-run by host restarts; N=1000 evidence stands meanwhile.
- Suite 59 suites / 517 tests green (now 517 incl. variant UI); tsc clean; engine coverage ≥80% both
  metrics; Stage 1/2/3 baselines byte-identical. Cam's on-device restart-persistence check also remains.

## Open Questions
- Final six variants and their exact numbers (agent proposes, purity gate disposes).
- Tranche milestone values (score-per-run averages ~how many runs per unlock? target: first unlock within
  2–3 runs, full slate by ~15–20 runs — tune constants to that pacing arithmetic).
- Whether the UI shows locked variants with unlock progress (UI feature decision).

## Notes & Decisions
- Purity band, trigger model, and v2 revisit path are locked in decisions.md — do not re-litigate here.
