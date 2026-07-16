# Feature: Sim Bots + Stats CLI (headless balance & determinism harness)
_Stage: 1 — Naked Board · Status: not started_

## Goal
Headless bot players (`src/engine/sim/`) that drive the board engine with no UI, plus a command-line
stats harness. Two bots ship in Stage 1: a **random-path** bot (picks a legal drag path at random) and a
**greedy** bot (picks the path maximizing immediate combos). Running N seeded games and reporting the
stats is the automated evidence for both **determinism** and a **balance baseline** for the naked board.

## Success Criteria
- [ ] A CLI runs **N seeded games** with a chosen bot and prints a **stats report**: average **combos per
      move**, the **cascade-depth distribution**, and **resolution time** (per move and/or per game).
- [ ] Both the **random-path** and **greedy** bots run against the engine and complete **1000 headless
      seeded games without error**.
- [ ] **Determinism check**: running the harness twice with the **same set of seeds** (and same bot)
      produces **identical stats** — byte-for-byte identical reports.
- [ ] The report distinguishes the two bots so their combos/move can be compared (greedy should score at
      least as well as random on average — a sanity signal, not a hard gate).

## How We'll Verify
1. Run the harness, e.g. `npx ts-node src/engine/sim/cli.ts --games 1000 --bot greedy --seed 42`
   (exact flags finalized when built). **Expected:** completes with exit code 0 and prints a report with
   avg combos/move, a cascade-depth histogram, and timing.
2. Run again with `--bot random` over the same seed range. **Expected:** completes 1000 games, exit 0,
   prints its own report.
3. Determinism: run the exact same command twice, write each report to a file, and diff them
   (`git diff --no-index a.txt b.txt` or `diff`). **Expected:** no difference.
4. A Jest test wraps a small fixed-seed run and asserts the summary numbers equal recorded expected
   values, so `npm test` catches regressions in bot or engine behavior.

## Verification Log
(empty until verification actually happens — a feature with an empty log can never be `verified done`)

## Open Questions
- Exact **report format/shape** (plain text table vs JSON vs both) and whether it writes to stdout, a
  file, or `docs/` — decide when building.
- What **combos/move band** signals a healthy, skill-expressive board (too low = matches feel rare; too
  high = the board resolves itself) — informs, but does not replace, the human fun gate.
- Greedy bot's exact objective: immediate combos only vs a shallow lookahead — start with immediate,
  revisit if it's a poor skill proxy.
- Board size / refill RNG choices (from the engine feature) will shift the numbers — re-baseline after
  those settle.

## Notes & Decisions
- Locked context (`docs/decisions.md`, 2026-07-15): verification is "mostly automated" — the sim harness
  for balance/correctness at scale is a first-class evidence source, alongside TDD unit tests and Cam's
  on-device feel checks.
- Bots depend only on the engine's public API (plain-data board state, legal-path enumeration). If the
  engine is truly deterministic, identical seeds MUST yield identical stats — that is the whole point.
