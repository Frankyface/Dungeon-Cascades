# Feature: Sim Bots + Stats CLI (headless balance & determinism harness)
_Stage: 1 — Naked Board · Status: verified done_

## Goal
Headless bot players (`src/engine/sim/`) that drive the board engine with no UI, plus a command-line
stats harness. Two bots ship in Stage 1: a **random-path** bot (picks a legal drag path at random) and a
**greedy** bot (picks the path maximizing immediate combos). Running N seeded games and reporting the
stats is the automated evidence for both **determinism** and a **balance baseline** for the naked board.

## Success Criteria
- [x] A CLI runs **N seeded games** with a chosen bot and prints a **stats report**: average **combos per
      move**, the **cascade-depth distribution**, and **resolution time** (per move and/or per game).
- [x] Both the **random-path** and **greedy** bots run against the engine and complete **1000 headless
      seeded games without error**.
- [x] **Determinism check**: running the harness twice with the **same set of seeds** (and same bot)
      produces **identical stats** — byte-for-byte identical reports.
- [x] The report distinguishes the two bots so their combos/move can be compared (greedy should score at
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
### 2026-07-15 — Manager session executed the full How We'll Verify procedure — PASS
- `npm run sim -- --games 1000 --bot greedy --seed 42 --moves 20` → exit 0. **20,000 moves, 68,618 total combos, avg 3.4309 combos/move**; cascade depth 52.0% one wave, 30.8% two, tail to 12 waves.
- Same command with `--bot random` → exit 0. **7,053 total combos, avg 0.3527 combos/move**; 79.1% of random moves make no match.
- Determinism: the greedy command run twice, stdout to two files, `diff` → **byte-identical** (timing goes to stderr by design so stdout stays deterministic).
- `npm test` → 16 suites / 100 tests green, includes the fixed-seed regression suite (greedy 868 / random 100 total combos on the 25×10 fixture, exact avg assertions, greedy ≥ random check, and a 300-run fast-check parity test that the sim's fast match counter equals `findMatches().length`).
- `npx tsc --noEmit` → exit 0. React-import guard on `src/engine/` → clean (one grep hit is a prose comment in `seeds.ts`, not code).
- **Headline balance signal for the fun gate: greedy 3.43 vs random 0.35 avg combos/move — a ~9.7× skill gap.** Skill clearly dominates luck on the naked board.
- Built by an Opus subagent; all commands above independently re-run by the manager session before this status change.

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
- 2026-07-15 implementation micro-decisions (agent-built, manager-accepted): three independent seeded streams per game (board / refill / bot decisions) derived via an invertible fold on the engine's mulberry32; randomBot = uniform path length 1–8 random orthogonal walk (honest null model); greedyBot = exhaustive DFS to depth 4 from every start, scored on FIRST-WAVE match groups only (refill-independent — cascades are bonus, per the refill-RNG decision), canonical first-found tie-break; report stdout is byte-deterministic, wall-time goes to stderr; `tsx` added as the CLI runner (`npm run sim`). Greedy 1000-game run costs ~100s wall (DFS-bound); `greedyMaxDepth` is a one-constant knob if iteration speed matters.
- Locked context (`docs/decisions.md`, 2026-07-15): verification is "mostly automated" — the sim harness
  for balance/correctness at scale is a first-class evidence source, alongside TDD unit tests and Cam's
  on-device feel checks.
- Bots depend only on the engine's public API (plain-data board state, legal-path enumeration). If the
  engine is truly deterministic, identical seeds MUST yield identical stats — that is the whole point.
