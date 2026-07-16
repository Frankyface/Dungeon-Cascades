/**
 * greedyBot — maximizes the immediate combos of a single move.
 *
 * Strategy (bounded + fully deterministic, no RNG consumed):
 *   Exhaustive depth-first search over every legal drag path up to
 *   `greedyMaxDepth` steps (default 4), from every start cell. Each candidate is
 *   scored by its IMMEDIATE combos — the number of match groups on the board right
 *   after the drag's swaps, before gravity/refill (via {@link countMatchGroups}).
 *   The highest-scoring path wins.
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
 *
 * Determinism / tie-break:
 *   Candidates are enumerated in a canonical order — start cells row-major, then DFS
 *   pre-order exploring directions as up, down, left, right (the DIRECTIONS order),
 *   shorter paths before longer. Ties are broken "first found": best is replaced only
 *   on a STRICT improvement, so the earliest path in canonical order wins.
 *
 * Search efficiency:
 *   The DFS mutates a single scratch tiles array in place — one swap on descent,
 *   undone on backtrack — and works entirely in flat indices / int row-col, so the
 *   hot loop allocates nothing per node (no Position/step objects). It also skips the
 *   direction that immediately returns to the previous cell: an instant reversal
 *   restores the board to an already-scored shorter path, so pruning it can never
 *   miss a better move.
 */
import type { Direction } from '../board';
import { colorCode, countMatchGroupsCodes } from './matchCount';
import type { Bot } from './types';

// Direction codes, ordered to match the engine's DIRECTIONS = up, down, left, right.
const DIR_UP = 0;
const DIR_DOWN = 1;
const DIR_LEFT = 2;
const DIR_RIGHT = 3;
const DIR_NAMES: readonly Direction[] = ['up', 'down', 'left', 'right'];

export const greedyBot: Bot = (board, rngState, config) => {
  const { cols, rows } = board;
  const size = cols * rows;
  const maxDepth = config.greedyMaxDepth;

  // Mutable scratch board of color CODES for in-place DFS (ints → fast compares; never
  // leaks; only the chosen path is returned).
  const codes = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    codes[i] = colorCode(board.tiles[i]);
  }

  // Current path as direction codes, plus the best found so far.
  const pathDirs = new Int8Array(maxDepth);
  let pathLen = 0;
  let bestCombos = -1;
  let bestStartIdx = 0;
  const bestDirs = new Int8Array(maxDepth);
  let bestLen = 0;

  const recordIfBetter = (startIdx: number): void => {
    const combos = countMatchGroupsCodes(codes, cols, rows);
    if (combos > bestCombos) {
      bestCombos = combos;
      bestStartIdx = startIdx;
      bestLen = pathLen;
      for (let k = 0; k < pathLen; k++) {
        bestDirs[k] = pathDirs[k];
      }
    }
  };

  const dfs = (
    startIdx: number,
    heldIdx: number,
    heldRow: number,
    heldCol: number,
    prevIdx: number,
    depth: number,
  ): void => {
    if (depth >= 1) {
      recordIfBetter(startIdx);
    }
    if (depth >= maxDepth) {
      return;
    }
    // Explore neighbors in up, down, left, right order.
    for (let dir = DIR_UP; dir <= DIR_RIGHT; dir++) {
      let nextIdx: number;
      let nextRow: number;
      let nextCol: number;
      if (dir === DIR_UP) {
        if (heldRow === 0) continue;
        nextRow = heldRow - 1;
        nextCol = heldCol;
        nextIdx = heldIdx - cols;
      } else if (dir === DIR_DOWN) {
        if (heldRow === rows - 1) continue;
        nextRow = heldRow + 1;
        nextCol = heldCol;
        nextIdx = heldIdx + cols;
      } else if (dir === DIR_LEFT) {
        if (heldCol === 0) continue;
        nextRow = heldRow;
        nextCol = heldCol - 1;
        nextIdx = heldIdx - 1;
      } else {
        if (heldCol === cols - 1) continue;
        nextRow = heldRow;
        nextCol = heldCol + 1;
        nextIdx = heldIdx + 1;
      }
      if (nextIdx === prevIdx) {
        continue; // skip immediate reversal (restores an already-scored board)
      }
      // Apply the drag swap in place.
      const tmp = codes[heldIdx];
      codes[heldIdx] = codes[nextIdx];
      codes[nextIdx] = tmp;
      pathDirs[pathLen++] = dir;

      dfs(startIdx, nextIdx, nextRow, nextCol, heldIdx, depth + 1);

      // Undo.
      pathLen--;
      codes[nextIdx] = codes[heldIdx];
      codes[heldIdx] = tmp;
    }
  };

  for (let idx = 0; idx < size; idx++) {
    const row = (idx - (idx % cols)) / cols;
    const col = idx % cols;
    dfs(idx, idx, row, col, -1, 0);
  }

  // Reconstruct the chosen path (allocates once).
  const startRow = (bestStartIdx - (bestStartIdx % cols)) / cols;
  const startCol = bestStartIdx % cols;
  const steps: Direction[] = [];
  for (let k = 0; k < bestLen; k++) {
    steps.push(DIR_NAMES[bestDirs[k]]);
  }

  return { path: { start: { col: startCol, row: startRow }, steps }, rngState };
};
