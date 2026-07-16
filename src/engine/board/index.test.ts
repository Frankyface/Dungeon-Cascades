/**
 * Public API smoke test: exercises the barrel so the documented consumer
 * contract (what sim bots and the Skia UI import) is wired correctly and stays
 * importable from a single entry point.
 */
import {
  COLS,
  ROWS,
  CELL_COUNT,
  TILE_COLORS,
  MAX_PATH_STEPS,
  createBoard,
  createRng,
  resolveMove,
  findMatches,
  validatePath,
  isValidStep,
  neighbors,
  step,
  applyPath,
  collapse,
  boardFromRows,
  boardToRows,
  indexOf,
  positionOf,
  inBounds,
  tileAt,
  withTiles,
  comparePositions,
  uniformTileSource,
  nextFloat,
  nextInt,
  isRngState,
  toRngState,
} from './index';
import type { Board, MoveResolution, Path } from './index';

describe('public API (barrel)', () => {
  it('exposes the config constants', () => {
    expect(COLS).toBe(6);
    expect(ROWS).toBe(5);
    expect(CELL_COUNT).toBe(30);
    expect(TILE_COLORS.length).toBe(5);
    expect(MAX_PATH_STEPS).toBeGreaterThan(0);
  });

  it('runs an end-to-end createBoard -> resolveMove through the public surface', () => {
    const board: Board = createBoard(2026);
    expect(findMatches(board)).toHaveLength(0);

    const path: Path = { start: { col: 2, row: 2 }, steps: ['up', 'left'] };
    expect(validatePath(board, path)).toEqual({ ok: true });

    const res: MoveResolution = resolveMove(board, path, createRng(2026));
    expect(res.finalBoard.tiles).toHaveLength(CELL_COUNT);
    expect(res.totalCombos).toBeGreaterThanOrEqual(0);
  });

  it('re-exports every helper used by bots / UI', () => {
    const board = boardFromRows(['RGB', 'GBR', 'BRG']);
    expect(boardToRows(board)).toEqual(['RGB', 'GBR', 'BRG']);
    expect(indexOf(board, { col: 1, row: 1 })).toBe(4);
    expect(positionOf(board, 4)).toEqual({ col: 1, row: 1 });
    expect(inBounds(board, { col: 0, row: 0 })).toBe(true);
    expect(tileAt(board, { col: 0, row: 0 })).toBe('R');
    expect(withTiles(board, board.tiles).tiles).toBe(board.tiles);
    expect(comparePositions({ col: 0, row: 0 }, { col: 1, row: 0 })).toBeLessThan(0);
    expect(step({ col: 0, row: 0 }, 'right')).toEqual({ col: 1, row: 0 });
    expect(neighbors(board, { col: 0, row: 0 })).toHaveLength(2);
    expect(isValidStep(board, { col: 0, row: 0 }, 'up')).toBe(false);

    const applied = applyPath(board, { start: { col: 0, row: 0 }, steps: ['right'] });
    expect(applied.swaps).toHaveLength(1);

    const collapsed = collapse(board, [{ col: 0, row: 0 }], createRng(1), uniformTileSource);
    expect(collapsed.spawns).toHaveLength(1);

    expect(isRngState(createRng(1))).toBe(true);
    expect(isRngState(1)).toBe(false);
    expect(toRngState(1)).toEqual({ a: 1 });
    expect(nextFloat(createRng(1)).value).toBeGreaterThanOrEqual(0);
    expect(nextInt(createRng(1), 5).value).toBeLessThan(5);
  });
});
