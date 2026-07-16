# Feature: Tile Taxonomy (what tile colors mean)
_Stage: 2 — Combat · Status: not started_

## Goal
Own and settle the central Stage 2 design decision: **what each tile color maps to** in combat. The board
so far is abstract colors; combat needs those colors to mean actions. The proposed default (P&D-ish) is
**Attack/sword, Block/shield, Mana-or-Skill, Heal/heart, Gold/coin**, but this is the open question this
feature exists to resolve, record, and then implement as engine tile types.

## Success Criteria
- [ ] A **tile taxonomy is decided** — the concrete set of tile colors and what each does in combat — and
      **recorded as a dated entry in `docs/decisions.md`** (chose / because / rejected / revisit if).
- [ ] The engine (board tile definitions + `src/engine/combat/`) **implements the chosen tile types**:
      matching a group of a given color produces that color's combat effect (e.g. sword tiles feed
      attack, shield tiles feed block), driven by combo count.
- [ ] The number of distinct tile colors is consistent with a board that still produces satisfying
      cascades (too many colors makes matches rare; too few makes them trivial) — cross-checked against
      the Stage 1 sim-bot combos/move baseline.

## How We'll Verify
(Rougher than Stage 1 — sharpen when Stage 1 nears its fun gate.)
1. Confirm a dated taxonomy decision exists in `docs/decisions.md`.
2. Unit tests (Jest, `npm test`): matching each tile type yields the intended combat effect, and effects
   scale with combo count as specified.
3. Re-run the sim harness with the chosen color count and confirm combos/move stays in the healthy band
   established in Stage 1.

## Verification Log
(empty until verification actually happens — a feature with an empty log can never be `verified done`)

## Open Questions
- **The taxonomy itself** — proposed default is Attack/sword, Block/shield, Mana-or-Skill, Heal/heart,
  Gold/coin, but the exact set (and whether gold/economy tiles belong in combat vs only in the run layer)
  is unresolved. This feature owns the decision.
- **How many colors** balances match frequency against strategic depth — tie to the Stage 1 board-size
  and combos/move findings.
- Whether some tile effects become **build/relic-modifiable** (deferred to the Stage 3+ run layer) — note
  but don't design here.

## Notes & Decisions
- The brief lists this as THE open design decision for Stage 2; do NOT silently pick a taxonomy — surface
  options and record the chosen one with reasoning in `docs/decisions.md`.
- Keep tile→action mapping in the pure engine so sim bots can play combat headlessly in later stages.
