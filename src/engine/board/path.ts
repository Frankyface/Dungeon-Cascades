/**
 * Drag-path primitives shared by bots, the UI, and move resolution: single-step
 * geometry, neighbor enumeration, path validation, and swap-sequence application.
 *
 * Move semantics (Puzzle & Dragons-style): pick up the tile at `start`; for each
 * step the held tile swaps with the neighbor in that direction, so it carries
 * along the drag while every tile it passes shifts one cell back.
 */
import { DIRECTIONS, MAX_PATH_STEPS } from './config';
import { inBounds, indexOf } from './board';
import type { Board, Direction, Path, PathValidation, Position, Swap, TileColor } from './types';

const DIRECTION_SET: ReadonlySet<string> = new Set<string>(DIRECTIONS);

/** Apply one step to a position (result may be off-grid). */
export function step(pos: Position, dir: Direction): Position {
  switch (dir) {
    case 'up':
      return { col: pos.col, row: pos.row - 1 };
    case 'down':
      return { col: pos.col, row: pos.row + 1 };
    case 'left':
      return { col: pos.col - 1, row: pos.row };
    case 'right':
      return { col: pos.col + 1, row: pos.row };
    default:
      // Unknown direction — return the position unchanged; validation rejects it.
      return pos;
  }
}

/** In-bounds orthogonal neighbors of a position. */
export function neighbors(board: Board, pos: Position): Position[] {
  const result: Position[] = [];
  for (const dir of DIRECTIONS) {
    const next = step(pos, dir);
    if (inBounds(board, next)) {
      result.push(next);
    }
  }
  return result;
}

/** Would stepping `dir` from `from` stay on the grid? */
export function isValidStep(board: Board, from: Position, dir: Direction): boolean {
  return inBounds(board, step(from, dir));
}

/**
 * Validate a path against a board: in-bounds start, non-zero length, within the
 * max-length guard, only known orthogonal directions, and every intermediate
 * position on the grid.
 */
export function validatePath(board: Board, path: Path): PathValidation {
  if (!inBounds(board, path.start)) {
    return { ok: false, reason: 'start out of bounds' };
  }
  if (path.steps.length === 0) {
    return { ok: false, reason: 'path has no steps' };
  }
  if (path.steps.length > MAX_PATH_STEPS) {
    return { ok: false, reason: `path exceeds max length (${MAX_PATH_STEPS})` };
  }
  let current = path.start;
  for (const dir of path.steps) {
    if (!DIRECTION_SET.has(dir)) {
      return { ok: false, reason: `invalid direction '${dir}'` };
    }
    const next = step(current, dir);
    if (!inBounds(board, next)) {
      return { ok: false, reason: 'step leaves the grid' };
    }
    current = next;
  }
  return { ok: true };
}

/**
 * Apply a (valid) path to a board, returning the post-swap board and the ordered
 * list of swaps for UI replay. Assumes the path is valid — call {@link validatePath}
 * first (resolveMove does). Does not mutate the input board.
 */
export function applyPath(board: Board, path: Path): { board: Board; swaps: Swap[] } {
  const tiles: TileColor[] = board.tiles.slice();
  const working: Board = { cols: board.cols, rows: board.rows, tiles };
  const swaps: Swap[] = [];
  let current = path.start;
  for (const dir of path.steps) {
    const next = step(current, dir);
    const i = indexOf(working, current);
    const j = indexOf(working, next);
    const tmp = tiles[i];
    tiles[i] = tiles[j];
    tiles[j] = tmp;
    swaps.push({ a: current, b: next });
    current = next;
  }
  return { board: working, swaps };
}
