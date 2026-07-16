import { boardFromRows, boardToRows } from './board';
import { MAX_CASCADE_WAVES } from './config';
import { createBoard } from './create';
import { resolveMove } from './resolve';
import { findMatches } from './match';
import { createRng } from './rng';
import type { Path, RngState, TileColor, TileSource } from './types';

/**
 * A fully deterministic, hand-scriptable tile source used to make cascade
 * fixtures pen-and-paper verifiable. It ignores randomness and instead uses
 * the RngState's `a` field as a draw index into a fixed color list.
 */
function scriptedSource(colors: readonly TileColor[]): TileSource {
  return {
    next(state: RngState) {
      const index = state.a;
      const color = colors[index];
      if (color === undefined) {
        throw new Error(`scriptedSource exhausted at draw ${index}`);
      }
      return { color, state: { a: index + 1 } };
    },
  };
}

describe('resolveMove — determinism', () => {
  it('same seed + same path deep-equals across 1000 resolutions', () => {
    const board = createBoard(2026);
    const path: Path = {
      start: { col: 2, row: 2 },
      steps: ['up', 'left', 'down', 'right', 'down'],
    };

    const first = resolveMove(board, path, createRng(2026));
    const firstJson = JSON.stringify(first);
    let mismatches = 0;
    for (let i = 0; i < 1000; i++) {
      const again = resolveMove(board, path, createRng(2026));
      if (JSON.stringify(again) !== firstJson) {
        mismatches++;
      }
    }
    expect(mismatches).toBe(0);
  });

  it('does not mutate the input board', () => {
    const board = createBoard(5);
    const snapshot = boardToRows(board);
    resolveMove(
      board,
      { start: { col: 1, row: 1 }, steps: ['up', 'right'] },
      createRng(5),
    );
    expect(boardToRows(board)).toEqual(snapshot);
  });
});

describe('resolveMove — hand-computed fixtures', () => {
  it('a no-match move yields 0 combos and finalBoard === post-swap board', () => {
    const board = boardFromRows(['RGB', 'GBR', 'BRG']);
    const path: Path = { start: { col: 1, row: 0 }, steps: ['left'] };

    const res = resolveMove(board, path, createRng(0));

    expect(res.totalCombos).toBe(0);
    expect(res.waves).toHaveLength(0);
    expect(res.swaps).toEqual([{ a: { col: 1, row: 0 }, b: { col: 0, row: 0 } }]);
    // Post-swap board: R and G at row0 swapped.
    expect(boardToRows(res.finalBoard)).toEqual(['GRB', 'GBR', 'BRG']);
    // RNG untouched because no spawns happened.
    expect(res.rngState).toEqual({ a: 0 });
  });

  it('resolves a 2-wave cascade with a known total of 2 combos', () => {
    // Pre-swap board (no pre-existing match):
    //   Y B P
    //   R R G
    //   G G Y
    //   B R P
    //   P R B
    const board = boardFromRows(['YBP', 'RRG', 'GGY', 'BRP', 'PRB']);
    // Pick up (col2,row1)=G and drag DOWN -> row2 becomes G G G (wave 1).
    const path: Path = { start: { col: 2, row: 1 }, steps: ['down'] };
    // Wave 1 refills 3 top cells (one per column): Y,G,B.
    // Wave 2 refills col1's 3 top cells: Y,G,Y.
    const source = scriptedSource(['Y', 'G', 'B', 'Y', 'G', 'Y']);

    const res = resolveMove(board, path, createRng(0), source);

    expect(res.waves).toHaveLength(2);

    // Wave 1: single horizontal GGG at row 2.
    expect(res.waves[0].clearedGroups).toHaveLength(1);
    expect(res.waves[0].clearedGroups[0].color).toBe('G');
    expect(res.waves[0].clearedGroups[0].positions).toHaveLength(3);

    // Wave 2: single vertical RRR in col1 (rows 2-4) formed by gravity.
    expect(res.waves[1].clearedGroups).toHaveLength(1);
    expect(res.waves[1].clearedGroups[0].color).toBe('R');
    expect(res.waves[1].clearedGroups[0].positions).toHaveLength(3);

    expect(res.totalCombos).toBe(2);
    // Board is stable after resolution.
    expect(findMatches(res.finalBoard)).toHaveLength(0);
    // Six tiles were drawn from the source overall.
    expect(res.rngState).toEqual({ a: 6 });
  });

  it('records falls and spawns for each wave', () => {
    const board = boardFromRows(['YBP', 'RRG', 'GGY', 'BRP', 'PRB']);
    const path: Path = { start: { col: 2, row: 1 }, steps: ['down'] };
    const source = scriptedSource(['Y', 'G', 'B', 'Y', 'G', 'Y']);

    const res = resolveMove(board, path, createRng(0), source);

    // Wave 1 cleared one cell per column -> exactly one spawn per column.
    expect(res.waves[0].spawns).toHaveLength(3);
    // Every spawn lands on the top row.
    for (const spawn of res.waves[0].spawns) {
      expect(spawn.position.row).toBe(0);
    }
    // Wave 2 cleared 3 cells in col1 -> 3 spawns in col1.
    expect(res.waves[1].spawns).toHaveLength(3);
    for (const spawn of res.waves[1].spawns) {
      expect(spawn.position.col).toBe(1);
    }
    // Falls never invert order or leave the grid.
    for (const wave of res.waves) {
      for (const fall of wave.falls) {
        expect(fall.to.row).toBeGreaterThan(fall.from.row);
        expect(fall.from.col).toBe(fall.to.col);
      }
    }
  });
});

describe('resolveMove — cascade wave cap (defensive)', () => {
  it('exports a generous cap far above any real cascade', () => {
    expect(MAX_CASCADE_WAVES).toBeGreaterThanOrEqual(100);
  });

  it('throws a descriptive error when a pathological source cascades forever', () => {
    // A broken TileSource that only ever emits R: every refill re-matches, so the
    // cascade never stabilizes. The cap must convert that infinite loop into a throw.
    const alwaysRed: TileSource = {
      next(state: RngState) {
        return { color: 'R', state };
      },
    };
    // Known-matching fixture (same board/path as the 2-wave cascade test above).
    const board = boardFromRows(['YBP', 'RRG', 'GGY', 'BRP', 'PRB']);
    const path: Path = { start: { col: 2, row: 1 }, steps: ['down'] };

    expect(() => resolveMove(board, path, createRng(0), alwaysRed)).toThrow(
      /MAX_CASCADE_WAVES.*TileSource/s,
    );
  });
});

describe('resolveMove — input validation', () => {
  it('throws on an invalid (out-of-bounds) path', () => {
    const board = boardFromRows(['RGB', 'GBR', 'BRG']);
    const badPath: Path = { start: { col: 0, row: 0 }, steps: ['up'] };
    expect(() => resolveMove(board, badPath, createRng(0))).toThrow();
  });

  it('throws on a zero-length path', () => {
    const board = boardFromRows(['RGB', 'GBR', 'BRG']);
    expect(() =>
      resolveMove(board, { start: { col: 0, row: 0 }, steps: [] }, createRng(0)),
    ).toThrow();
  });
});
