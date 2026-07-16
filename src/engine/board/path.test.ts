import { boardFromRows } from './board';
import {
  step,
  neighbors,
  isValidStep,
  validatePath,
  applyPath,
} from './path';
import { MAX_PATH_STEPS } from './config';
import type { Direction, Path } from './types';

const board = boardFromRows([
  'RGBYR',
  'GBYRG',
  'BYRGB',
  'YRGBY',
]);

describe('path primitives', () => {
  it('step moves one cell in the given direction (may leave the grid)', () => {
    expect(step({ col: 2, row: 2 }, 'up')).toEqual({ col: 2, row: 1 });
    expect(step({ col: 2, row: 2 }, 'down')).toEqual({ col: 2, row: 3 });
    expect(step({ col: 2, row: 2 }, 'left')).toEqual({ col: 1, row: 2 });
    expect(step({ col: 2, row: 2 }, 'right')).toEqual({ col: 3, row: 2 });
    expect(step({ col: 0, row: 0 }, 'up')).toEqual({ col: 0, row: -1 });
  });

  it('neighbors enumerates only in-bounds orthogonal cells', () => {
    // Corner (0,0): right + down.
    expect(neighbors(board, { col: 0, row: 0 })).toHaveLength(2);
    // Top edge (2,0): left, right, down.
    expect(neighbors(board, { col: 2, row: 0 })).toHaveLength(3);
    // Interior (2,2): all four.
    expect(neighbors(board, { col: 2, row: 2 })).toHaveLength(4);
  });

  it('isValidStep is false when the step leaves the grid', () => {
    expect(isValidStep(board, { col: 0, row: 0 }, 'up')).toBe(false);
    expect(isValidStep(board, { col: 0, row: 0 }, 'left')).toBe(false);
    expect(isValidStep(board, { col: 0, row: 0 }, 'right')).toBe(true);
    expect(isValidStep(board, { col: 0, row: 0 }, 'down')).toBe(true);
  });
});

describe('validatePath', () => {
  it('accepts a valid in-bounds orthogonal path', () => {
    const path: Path = { start: { col: 2, row: 2 }, steps: ['up', 'left', 'down', 'right'] };
    expect(validatePath(board, path)).toEqual({ ok: true });
  });

  it('rejects an out-of-bounds start', () => {
    const path: Path = { start: { col: 9, row: 9 }, steps: ['up'] };
    const result = validatePath(board, path);
    expect(result.ok).toBe(false);
  });

  it('rejects a step that leaves the grid', () => {
    const path: Path = { start: { col: 0, row: 0 }, steps: ['up'] };
    const result = validatePath(board, path);
    expect(result.ok).toBe(false);
  });

  it('rejects a zero-length path', () => {
    const path: Path = { start: { col: 0, row: 0 }, steps: [] };
    const result = validatePath(board, path);
    expect(result.ok).toBe(false);
  });

  it('rejects a path longer than MAX_PATH_STEPS', () => {
    const steps: Direction[] = [];
    for (let i = 0; i < MAX_PATH_STEPS + 1; i++) {
      steps.push(i % 2 === 0 ? 'right' : 'left');
    }
    const path: Path = { start: { col: 0, row: 0 }, steps };
    const result = validatePath(board, path);
    expect(result.ok).toBe(false);
  });

  it('rejects a non-orthogonal / unknown direction', () => {
    const path = {
      start: { col: 2, row: 2 },
      steps: ['up-left' as unknown as Direction],
    };
    const result = validatePath(board, path);
    expect(result.ok).toBe(false);
  });
});

describe('applyPath (swap sequence)', () => {
  it('swaps the held tile with each tile it passes and records the sequence', () => {
    const small = boardFromRows(['RG', 'BY']);
    // Pick up (0,0)=R, drag right then down.
    const path: Path = { start: { col: 0, row: 0 }, steps: ['right', 'down'] };
    const { board: result, swaps } = applyPath(small, path);

    expect(swaps).toEqual([
      { a: { col: 0, row: 0 }, b: { col: 1, row: 0 } },
      { a: { col: 1, row: 0 }, b: { col: 1, row: 1 } },
    ]);
    // R started at (0,0); after right+down it lands at (1,1).
    expect(boardToRowsForTest(result)).toEqual(['GY', 'BR']);
  });

  it('does not mutate the input board', () => {
    const small = boardFromRows(['RG', 'BY']);
    const snapshot = boardToRowsForTest(small);
    applyPath(small, { start: { col: 0, row: 0 }, steps: ['right'] });
    expect(boardToRowsForTest(small)).toEqual(snapshot);
  });
});

// Local helper to avoid a second import cycle in assertions.
function boardToRowsForTest(b: { cols: number; rows: number; tiles: readonly string[] }): string[] {
  const out: string[] = [];
  for (let r = 0; r < b.rows; r++) {
    out.push(b.tiles.slice(r * b.cols, r * b.cols + b.cols).join(''));
  }
  return out;
}
