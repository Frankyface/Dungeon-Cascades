/**
 * Board data helpers: coordinate <-> index conversion, bounds checks, tile reads,
 * and (de)serialization to/from a compact row-of-chars representation used by
 * hand-computed fixtures and (later) level design.
 *
 * The board is immutable data; helpers that "change" a board return a new one.
 */
import { TILE_COLORS } from './config';
import type { Board, Position, TileColor } from './types';

const COLOR_SET: ReadonlySet<string> = new Set<string>(TILE_COLORS);

/** Flat row-major index for a position: `row * cols + col`. */
export function indexOf(board: Board, pos: Position): number {
  return pos.row * board.cols + pos.col;
}

/** Inverse of {@link indexOf}. */
export function positionOf(board: Board, index: number): Position {
  return { col: index % board.cols, row: Math.floor(index / board.cols) };
}

/** Is the position on the grid? */
export function inBounds(board: Board, pos: Position): boolean {
  return pos.col >= 0 && pos.col < board.cols && pos.row >= 0 && pos.row < board.rows;
}

/** Read the tile at a position. Caller must ensure the position is in bounds. */
export function tileAt(board: Board, pos: Position): TileColor {
  return board.tiles[indexOf(board, pos)];
}

/** Return a new board with a fresh tiles array (dimensions preserved). */
export function withTiles(board: Board, tiles: readonly TileColor[]): Board {
  return { cols: board.cols, rows: board.rows, tiles };
}

/**
 * Total ordering on positions (row-major). Used to canonicalize the ordering of
 * cleared-group positions, falls, and spawns so output is stable and readable.
 */
export function comparePositions(a: Position, b: Position): number {
  return a.row === b.row ? a.col - b.col : a.row - b.row;
}

/**
 * Build a board from an array of equal-length strings of color codes. Row 0 is
 * the top row; character 0 of each string is the left column. Validates the grid
 * is non-empty, rectangular, and uses only known color codes.
 */
export function boardFromRows(rows: readonly string[]): Board {
  if (rows.length === 0) {
    throw new Error('boardFromRows: at least one row is required');
  }
  const cols = rows[0].length;
  if (cols === 0) {
    throw new Error('boardFromRows: rows must be non-empty');
  }
  const tiles: TileColor[] = [];
  for (const row of rows) {
    if (row.length !== cols) {
      throw new Error(`boardFromRows: ragged grid (expected width ${cols}, got ${row.length})`);
    }
    for (const ch of row) {
      if (!COLOR_SET.has(ch)) {
        throw new Error(`boardFromRows: unknown color code '${ch}'`);
      }
      tiles.push(ch as TileColor);
    }
  }
  return { cols, rows: rows.length, tiles };
}

/** Serialize a board back to an array of color-code strings (row-major). */
export function boardToRows(board: Board): string[] {
  const out: string[] = [];
  for (let r = 0; r < board.rows; r++) {
    out.push(board.tiles.slice(r * board.cols, r * board.cols + board.cols).join(''));
  }
  return out;
}
