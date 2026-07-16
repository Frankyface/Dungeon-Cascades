/**
 * Pure board geometry: turn an available pixel width into a concrete grid layout,
 * and convert between grid cells and canvas pixels. No React, no side effects —
 * every function is deterministic and Jest-testable.
 *
 * The coordinate origin (0,0) is the TOP-LEFT of the Skia canvas. Cell (col,row)
 * with row 0 = TOP matches the engine's convention.
 */
import { COLS, ROWS } from '../../engine/board';
import type { Position } from '../../engine/board';
import { LAYOUT } from './constants';

/** A resolved, immutable layout for one board size. */
export interface BoardLayout {
  readonly cols: number;
  readonly rows: number;
  readonly cellSize: number;
  readonly gap: number;
  readonly padding: number;
  /** Distance between the top-left corners of adjacent cells (`cellSize + gap`). */
  readonly pitch: number;
  /** Canvas width / height in pixels (grid + padding). */
  readonly width: number;
  readonly height: number;
  /** Tile corner radius in pixels. */
  readonly radius: number;
}

/** A pixel point on the canvas. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Compute a board layout that fits `availableWidth` (typically the screen width).
 * Cells are square; the cell size is derived so the grid + padding never exceeds
 * the usable width. Defaults to the engine's configured COLS x ROWS.
 */
export function computeBoardLayout(
  availableWidth: number,
  cols: number = COLS,
  rows: number = ROWS,
): BoardLayout {
  const usableWidth = Math.min(availableWidth * LAYOUT.screenFraction, LAYOUT.maxWidth);
  const innerWidth = usableWidth - 2 * LAYOUT.padding - (cols - 1) * LAYOUT.gap;
  // Guard against absurd inputs so we never produce a negative / zero cell size.
  const cellSize = Math.max(1, Math.floor(innerWidth / cols));
  const width = 2 * LAYOUT.padding + cols * cellSize + (cols - 1) * LAYOUT.gap;
  const height = 2 * LAYOUT.padding + rows * cellSize + (rows - 1) * LAYOUT.gap;
  return {
    cols,
    rows,
    cellSize,
    gap: LAYOUT.gap,
    padding: LAYOUT.padding,
    pitch: cellSize + LAYOUT.gap,
    width,
    height,
    radius: Math.round(cellSize * LAYOUT.radiusRatio),
  };
}

/** Top-left pixel corner of a cell. */
export function cellTopLeft(layout: BoardLayout, col: number, row: number): Point {
  return {
    x: layout.padding + col * layout.pitch,
    y: layout.padding + row * layout.pitch,
  };
}

/** Center pixel of a cell — the anchor used for hysteresis and the held tile. */
export function cellCenter(layout: BoardLayout, pos: Position): Point {
  const half = layout.cellSize / 2;
  return {
    x: layout.padding + pos.col * layout.pitch + half,
    y: layout.padding + pos.row * layout.pitch + half,
  };
}

/**
 * Map a canvas pixel to the cell under it, or `null` if the point is outside the
 * canvas. Points inside the inter-tile gap resolve to the nearest cell (the pitch
 * bucket), which is the forgiving behaviour we want for a finger-sized target.
 */
export function pixelToCell(layout: BoardLayout, x: number, y: number): Position | null {
  if (x < 0 || y < 0 || x >= layout.width || y >= layout.height) {
    return null;
  }
  const col = clamp(Math.floor((x - layout.padding) / layout.pitch), 0, layout.cols - 1);
  const row = clamp(Math.floor((y - layout.padding) / layout.pitch), 0, layout.rows - 1);
  return { col, row };
}

function clamp(value: number, lo: number, hi: number): number {
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}
