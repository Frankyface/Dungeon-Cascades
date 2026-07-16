/**
 * Shared bounded drag-path search — the DFS core both greedy bots use.
 *
 * Extracted verbatim from the original greedyBot so the board-greedy and the
 * combat-greedy share ONE exhaustive-search traversal (DRY) and can never drift
 * apart. The only thing that varies between callers is HOW a candidate board is
 * scored: `searchBestPath` takes a `scoreCodes` callback and returns the path that
 * maximizes it.
 *
 * Contract (identical to the original greedyBot, so board-greedy output is
 * byte-for-byte unchanged):
 *   - Exhaustive DFS over every legal drag path up to `maxDepth` steps, from every
 *     start cell.
 *   - Candidate order is canonical: start cells row-major, then DFS pre-order
 *     exploring directions up, down, left, right (the engine's DIRECTIONS order),
 *     shorter paths before longer.
 *   - Ties break "first found": `best` is replaced only on a STRICT improvement, so
 *     the earliest path in canonical order wins.
 *   - The immediate reversal (a step straight back to the previous cell) is pruned —
 *     it restores an already-scored shorter board, so skipping it can never miss a
 *     better move.
 *   - The DFS mutates a single scratch code array in place (one swap on descent,
 *     undone on backtrack), working in flat indices / int row-col, so the hot loop
 *     allocates nothing per node.
 *
 * PURE: consumes no RNG, reads no clock. Same (board, maxDepth, scoreCodes) ⇒ same
 * path, always.
 */
import type { Board, Direction, Path } from '../board';
import { colorCode } from './matchCount';

// Direction codes, ordered to match the engine's DIRECTIONS = up, down, left, right.
const DIR_UP = 0;
const DIR_DOWN = 1;
const DIR_LEFT = 2;
const DIR_RIGHT = 3;
const DIR_NAMES: readonly Direction[] = ['up', 'down', 'left', 'right'];

/** A candidate board scorer: higher is better. Called on the in-place-swapped codes. */
export type ScoreCodes = (codes: Uint8Array, cols: number, rows: number) => number;

/**
 * Return the drag path (up to `maxDepth` steps) that maximizes `scoreCodes` on the
 * board that results from performing the path's swaps. Deterministic; consumes no
 * RNG. See the module doc for the exact traversal + tie-break contract.
 */
export function searchBestPath(board: Board, maxDepth: number, scoreCodes: ScoreCodes): Path {
  const { cols, rows } = board;
  const size = cols * rows;

  // Mutable scratch board of color CODES for in-place DFS (ints → fast compares).
  const codes = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    codes[i] = colorCode(board.tiles[i]);
  }

  // Current path as direction codes, plus the best found so far.
  const pathDirs = new Int8Array(maxDepth);
  let pathLen = 0;
  let bestScore = -Infinity;
  let bestStartIdx = 0;
  const bestDirs = new Int8Array(maxDepth);
  let bestLen = 0;

  const recordIfBetter = (startIdx: number): void => {
    const score = scoreCodes(codes, cols, rows);
    if (score > bestScore) {
      bestScore = score;
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

  return { start: { col: startCol, row: startRow }, steps };
}
