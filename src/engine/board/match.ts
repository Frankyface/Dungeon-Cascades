/**
 * Match detection with classic cross/L/T combo semantics.
 *
 * Step 1: mark every cell that belongs to a horizontal OR vertical run of
 *   >= MATCH_MIN same-color tiles.
 * Step 2: group the marked cells into orthogonally-connected, same-color
 *   components. Each component is ONE combo — so a horizontal run and a vertical
 *   run of the same color that share a tile merge into a single group (cross/L/T),
 *   while same-color runs that don't touch stay separate combos.
 */
import { MATCH_MIN } from './config';
import { comparePositions, indexOf, positionOf } from './board';
import type { Board, ClearedGroup, Position, TileColor } from './types';

/** Mark cells that are part of a run of >= MATCH_MIN same color in either axis. */
function markMatchedCells(board: Board): boolean[] {
  const { cols, rows, tiles } = board;
  const matched = new Array<boolean>(tiles.length).fill(false);

  const markRun = (start: number, length: number, stride: number): void => {
    if (length >= MATCH_MIN) {
      for (let k = 0; k < length; k++) {
        matched[start + k * stride] = true;
      }
    }
  };

  // Horizontal runs.
  for (let r = 0; r < rows; r++) {
    let runStart = 0;
    let runLen = 1;
    for (let c = 1; c <= cols; c++) {
      const same = c < cols && tiles[r * cols + c] === tiles[r * cols + c - 1];
      if (same) {
        runLen++;
      } else {
        markRun(r * cols + runStart, runLen, 1);
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
      const same = r < rows && tiles[r * cols + c] === tiles[(r - 1) * cols + c];
      if (same) {
        runLen++;
      } else {
        markRun(runStart * cols + c, runLen, cols);
        runStart = r;
        runLen = 1;
      }
    }
  }

  return matched;
}

/** Find all combos on a board as connected same-color groups of matched cells. */
export function findMatches(board: Board): ClearedGroup[] {
  const matched = markMatchedCells(board);
  const visited = new Array<boolean>(matched.length).fill(false);
  const groups: ClearedGroup[] = [];

  for (let index = 0; index < matched.length; index++) {
    if (!matched[index] || visited[index]) {
      continue;
    }
    const color: TileColor = board.tiles[index];
    const positions: Position[] = [];
    const stack: number[] = [index];
    visited[index] = true;

    while (stack.length > 0) {
      const cell = stack.pop() as number;
      const pos = positionOf(board, cell);
      positions.push(pos);

      // Orthogonal same-color, still-matched neighbors join the component.
      const candidates: Position[] = [
        { col: pos.col, row: pos.row - 1 },
        { col: pos.col, row: pos.row + 1 },
        { col: pos.col - 1, row: pos.row },
        { col: pos.col + 1, row: pos.row },
      ];
      for (const next of candidates) {
        if (next.col < 0 || next.col >= board.cols || next.row < 0 || next.row >= board.rows) {
          continue;
        }
        const nIndex = indexOf(board, next);
        if (matched[nIndex] && !visited[nIndex] && board.tiles[nIndex] === color) {
          visited[nIndex] = true;
          stack.push(nIndex);
        }
      }
    }

    positions.sort(comparePositions);
    groups.push({ color, positions });
  }

  // Canonical group order: by first (smallest) position for stable output.
  groups.sort((g1, g2) => comparePositions(g1.positions[0], g2.positions[0]));
  return groups;
}
