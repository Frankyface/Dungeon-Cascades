/**
 * greedyBot — maximizes the immediate combos of a single move (the board-only bot).
 *
 * Strategy (bounded + fully deterministic, no RNG consumed):
 *   Exhaustive depth-first search over every legal drag path up to
 *   `greedyMaxDepth` steps (default 4), from every start cell. Each candidate is
 *   scored by its IMMEDIATE combos — the number of match groups on the board right
 *   after the drag's swaps, before gravity/refill (via {@link countMatchGroupsCodes}).
 *   The highest-scoring path wins. The traversal + tie-break live in the shared
 *   {@link searchBestPath} core; this bot only supplies the "count combos" scorer.
 *
 * Why immediate (first-wave) combos, not full totalCombos-with-cascades:
 *   - Per docs/decisions.md (refill RNG verdict), engineered combos are computed
 *     from the visible board at release; cascade skyfall is bonus, not skill. So
 *     first-wave combos is the right SKILL proxy to optimize.
 *   - It is refill-independent, so greedy needs no move/refill RNG and stays a pure
 *     function of (board, config) — exhaustive search consumes no decision RNG, so
 *     the bot's rngState is returned unchanged.
 *   The harness still MEASURES realized totalCombos (with real cascades) for every
 *   played move; that — not this heuristic — is the reported metric.
 */
import { countMatchGroupsCodes } from './matchCount';
import { searchBestPath } from './pathSearch';
import type { Bot } from './types';

export const greedyBot: Bot = (board, rngState, config) => {
  const path = searchBestPath(board, config.greedyMaxDepth, countMatchGroupsCodes);
  return { path, rngState };
};
