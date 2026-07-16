# Stage 4 — Meta & Balance

_Status: specced 2026-07-15 (shape decided; feature files written when Stage 3 lands) ·
Folder: `staging/stage-4-meta-and-balance/`_
_Gate note: building ahead of the Stage 1 fun-gate verdict per Cam's directive (see decisions.md); a
pivot/kill verdict stops this work._

## Goal
Make the game **keep** being fun across many runs. The meta-progression SHAPE is decided (decisions.md
2026-07-15, "Meta-progression shape: sim-verified starting variants"): power-neutral **starting variants**
unlocked by **cumulative-score tranches**, purity enforced by a hard sim band. Scale the sim harness into
the project's balance instrument and tune difficulty from its reports.

## Scope (feature files to be written when Stage 3 nears completion)
- **Starting variants (~6 + vanilla)**: sidegrade starting conditions as pure data; selection screen at
  run start; vanilla always available.
- **Purity gate in the sim**: each variant's policy-bot win rate over ≥2000 seeded full runs within
  **±5 percentage points of vanilla** — a variant outside the band cannot ship.
- **Cumulative-score meta state**: score accrues across runs (wins AND losses bank progress), persisted
  via the storage port; tranches unlock variants at score milestones.
- **Balance report at scale**: a sim command producing the full picture (win rates per variant, run-length
  distribution, per-enemy loss attribution, relic pick-vs-win correlation) as a deterministic artifact.
- **Difficulty tuning**: concrete constant changes driven by that report, each recorded with before/after
  evidence.

## Definition of done (testable checklist)
- [~] **Variant purity gate**: all six PASS at N=1000 (worst |Δ| 2.1pp); the spec's ≥2000-game matrix is
      scheduled tonight (command in feature-meta-variants.md log) — that run closes this box.
- [~] **Meta state persists**: storage-port round-trip + once-guarded banking tested; Cam's on-device
      restart check remains.
- [x] **Unlock tranches fire correctly**: idempotent, exactly-once, replay-safe — unit-tested. (2026-07-16)
- [~] **Balance report exists and is deterministic**: built + Jest-pinned + deterministic at pinned scale;
      evidence verdict recorded (NO CHANGE, numbers cited); default-scale double-run tonight.
- [x] **No power creep by construction**: fresh vs maxed profiles produce JSON-identical vanilla starts —
      test asserted. (2026-07-16)
- [x] Stage 1–3 sim baselines still reproduce — byte-identical after Stage 4 + boss fix. (2026-07-16)

## Notes
- This is where the "mostly automated" verification convention pays off most — balance is proven by sims,
  not vibes. The meta design question is now CLOSED (see decisions.md); what remains is data design
  (which six variants) at feature-spec time, informed by Stage 3's sim findings.
- Variant ideas banked from the debate (Ember Start, Merchant's Debt, Blood Pact, Monochrome, Glass
  Cannon, Cartographer) — a starting slate to refine, not a commitment.
