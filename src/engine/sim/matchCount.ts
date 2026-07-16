/**
 * Fast match-GROUP counter used inside greedyBot's inner search loop.
 *
 * `findMatches` (engine) returns full ClearedGroup objects — allocating arrays of
 * Positions and sorting them — which is far more than greedy needs. Greedy visits
 * thousands of candidate boards per move and only needs ONE number: how many
 * combos (connected same-color match groups) the board currently has. This module
 * returns exactly that, working on a flat Uint8Array of color CODES (ints, not the
 * engine's single-char color strings) with module-level scratch buffers reset each
 * call — so the hot loop does integer compares and zero per-call allocation.
 *
 * Semantics match `findMatches` EXACTLY:
 *   1. mark every cell in a horizontal or vertical run of >= MATCH_MIN same color;
 *   2. count orthogonally-connected same-color components of marked cells.
 * A cross/L/T (a horizontal and vertical run sharing a cell) is ONE group, matching
 * the engine. A regression test asserts `countMatchGroups === findMatches(...).length`
 * over many random boards so the two can never silently drift apart.
 *
 * Purity note: the scratch buffers are internal working memory, fully reset on every
 * call — each function is a pure mapping from tiles/codes to a count. No external
 * observable state, no time, no randomness.
 */
import { MATCH_MIN, TILE_COLORS } from '../board';
import type { Board, TileColor } from '../board';

/** color code (index into TILE_COLORS) for each color string. */
const CODE_OF: Readonly<Record<string, number>> = Object.fromEntries(
  TILE_COLORS.map((color, index) => [color, index]),
);

/** Map a color string to its integer code. Exported so callers (greedy) can build code arrays. */
export function colorCode(color: TileColor): number {
  return CODE_OF[color];
}

// Reusable scratch, grown on demand and reset (fill) each call.
let matched: Uint8Array = new Uint8Array(0);
let visited: Uint8Array = new Uint8Array(0);
let stack: Int32Array = new Int32Array(0);
let codeBuf: Uint8Array = new Uint8Array(0);

function ensureCapacity(size: number): void {
  if (matched.length < size) {
    matched = new Uint8Array(size);
    visited = new Uint8Array(size);
    stack = new Int32Array(size);
  }
}

/**
 * Count the combos on a flat Uint8Array of color codes. This is the hot-path core
 * greedy calls directly on its in-place-swapped code board.
 */
export function countMatchGroupsCodes(codes: Uint8Array, cols: number, rows: number): number {
  const size = cols * rows;
  ensureCapacity(size);
  matched.fill(0, 0, size);

  // Horizontal runs.
  for (let r = 0; r < rows; r++) {
    let runStart = 0;
    let runLen = 1;
    for (let c = 1; c <= cols; c++) {
      const same = c < cols && codes[r * cols + c] === codes[r * cols + c - 1];
      if (same) {
        runLen++;
      } else {
        if (runLen >= MATCH_MIN) {
          for (let k = 0; k < runLen; k++) {
            matched[r * cols + runStart + k] = 1;
          }
        }
        runStart = c;
        runLen = 1;
      }
    }
  }

  // Vertical runs.
  for (let c = 0; c < cols; c++) {
    let runStart = 0;
    let runLen = 1;
    for (let r = 1; r <= rows; r++) {
      const same = r < rows && codes[r * cols + c] === codes[(r - 1) * cols + c];
      if (same) {
        runLen++;
      } else {
        if (runLen >= MATCH_MIN) {
          for (let k = 0; k < runLen; k++) {
            matched[(runStart + k) * cols + c] = 1;
          }
        }
        runStart = r;
        runLen = 1;
      }
    }
  }

  // Count connected same-color components of marked cells (iterative flood fill).
  visited.fill(0, 0, size);
  let groups = 0;
  for (let index = 0; index < size; index++) {
    if (matched[index] === 0 || visited[index] === 1) {
      continue;
    }
    groups++;
    const color = codes[index];
    let top = 0;
    stack[top++] = index;
    visited[index] = 1;
    while (top > 0) {
      const cell = stack[--top];
      const col = cell % cols;
      const row = (cell - col) / cols;
      if (row > 0) {
        const n = cell - cols;
        if (matched[n] === 1 && visited[n] === 0 && codes[n] === color) {
          visited[n] = 1;
          stack[top++] = n;
        }
      }
      if (row < rows - 1) {
        const n = cell + cols;
        if (matched[n] === 1 && visited[n] === 0 && codes[n] === color) {
          visited[n] = 1;
          stack[top++] = n;
        }
      }
      if (col > 0) {
        const n = cell - 1;
        if (matched[n] === 1 && visited[n] === 0 && codes[n] === color) {
          visited[n] = 1;
          stack[top++] = n;
        }
      }
      if (col < cols - 1) {
        const n = cell + 1;
        if (matched[n] === 1 && visited[n] === 0 && codes[n] === color) {
          visited[n] = 1;
          stack[top++] = n;
        }
      }
    }
  }

  return groups;
}

/**
 * Count the combos on a Board (color-string tiles). Convenience wrapper — converts
 * to codes once, then delegates to {@link countMatchGroupsCodes} so both share one
 * implementation and can never diverge. Equivalent to `findMatches(board).length`.
 */
export function countMatchGroups(board: Board): number {
  const { cols, rows, tiles } = board;
  const size = cols * rows;
  if (codeBuf.length < size) {
    codeBuf = new Uint8Array(size);
  }
  for (let i = 0; i < size; i++) {
    codeBuf[i] = CODE_OF[tiles[i]];
  }
  return countMatchGroupsCodes(codeBuf, cols, rows);
}
