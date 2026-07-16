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
- [ ] **Variant purity gate passes**: every shipped variant within ±5pp of vanilla win rate over ≥2000
      seeded runs; the run command + numbers logged in the owning feature's Verification Log.
- [ ] **Meta state persists**: cumulative score and unlocked variants survive app restart (storage-port
      round-trip test + Cam's on-device restart check); resetting meta is possible.
- [ ] **Unlock tranches fire correctly**: score milestones unlock variants exactly once, idempotent under
      replay/reload — unit-tested.
- [ ] **Balance report exists and is deterministic**: same seeds ⇒ byte-identical report; at least one
      concrete tuning change is made from its evidence and re-verified.
- [ ] **No power creep by construction**: a fresh install and a maxed meta profile have identical vanilla
      run conditions — asserted by a test comparing run-start states.
- [ ] Stage 1–3 sim baselines still reproduce.

## Notes
- This is where the "mostly automated" verification convention pays off most — balance is proven by sims,
  not vibes. The meta design question is now CLOSED (see decisions.md); what remains is data design
  (which six variants) at feature-spec time, informed by Stage 3's sim findings.
- Variant ideas banked from the debate (Ember Start, Merchant's Debt, Blood Pact, Monochrome, Glass
  Cannon, Cartographer) — a starting slate to refine, not a commitment.
