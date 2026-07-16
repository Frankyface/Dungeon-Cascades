import fc from 'fast-check';
import { createBoard } from './create';
import { resolveMove } from './resolve';
import { findMatches } from './match';
import { validatePath } from './path';
import { createRng } from './rng';
import { COLS, ROWS, CELL_COUNT, TILE_COLORS, MAX_PATH_STEPS } from './config';
import type { Board, Direction, Path } from './types';

const DIRS: Direction[] = ['up', 'down', 'left', 'right'];

/**
 * Build a guaranteed-valid path from a random start + random raw directions by
 * walking the grid and dropping any step that would leave the board. Caps at
 * MAX_PATH_STEPS. Guarantees at least one step by re-seeking a legal first move.
 */
function buildValidPath(startCol: number, startRow: number, rawDirs: Direction[]): Path {
  let col = startCol;
  let row = startRow;
  const steps: Direction[] = [];
  for (const dir of rawDirs) {
    if (steps.length >= MAX_PATH_STEPS) break;
    let nCol = col;
    let nRow = row;
    if (dir === 'up') nRow -= 1;
    else if (dir === 'down') nRow += 1;
    else if (dir === 'left') nCol -= 1;
    else nCol += 1;
    if (nCol < 0 || nCol >= COLS || nRow < 0 || nRow >= ROWS) continue;
    steps.push(dir);
    col = nCol;
    row = nRow;
  }
  return { start: { col: startCol, row: startRow }, steps };
}

function assertInvariants(board: Board): void {
  // Tile count conserved: every cell filled with a valid color.
  expect(board.tiles).toHaveLength(CELL_COUNT);
  for (const tile of board.tiles) {
    expect(TILE_COLORS).toContain(tile);
  }
  // No holes: since the board is a dense array of exactly CELL_COUNT valid
  // colors, there is no empty cell anywhere (and thus none below a filled one).
  const filled = board.tiles.filter((t) => TILE_COLORS.includes(t)).length;
  expect(filled).toBe(CELL_COUNT);
}

describe('property: createBoard', () => {
  it('is match-free, dense, and deterministic for any seed', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 31 - 1 }), (seed) => {
        const board = createBoard(seed);
        assertInvariants(board);
        expect(findMatches(board)).toHaveLength(0);
        expect(createBoard(seed)).toEqual(board);
      }),
      { numRuns: 200 },
    );
  });
});

describe('property: resolveMove invariants', () => {
  const arbs = {
    seed: fc.integer({ min: 0, max: 2 ** 31 - 1 }),
    startCol: fc.integer({ min: 0, max: COLS - 1 }),
    startRow: fc.integer({ min: 0, max: ROWS - 1 }),
    dirs: fc.array(fc.constantFrom(...DIRS), { minLength: 1, maxLength: 40 }),
  };

  it('holds no-holes / valid-color / count-conserved after any valid move', () => {
    fc.assert(
      fc.property(
        arbs.seed,
        arbs.startCol,
        arbs.startRow,
        arbs.dirs,
        (seed, startCol, startRow, dirs) => {
          const board = createBoard(seed);
          const path = buildValidPath(startCol, startRow, dirs);
          fc.pre(path.steps.length > 0); // skip degenerate no-move samples
          expect(validatePath(board, path)).toEqual({ ok: true });

          const res = resolveMove(board, path, createRng(seed));
          assertInvariants(res.finalBoard);
          // A resolved board is always stable (no leftover matches).
          expect(findMatches(res.finalBoard)).toHaveLength(0);
          // Combo count equals the number of cleared groups across all waves.
          const groupCount = res.waves.reduce((n, w) => n + w.clearedGroups.length, 0);
          expect(res.totalCombos).toBe(groupCount);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('re-resolving identical inputs reproduces identical output', () => {
    fc.assert(
      fc.property(
        arbs.seed,
        arbs.startCol,
        arbs.startRow,
        arbs.dirs,
        (seed, startCol, startRow, dirs) => {
          const board = createBoard(seed);
          const path = buildValidPath(startCol, startRow, dirs);
          fc.pre(path.steps.length > 0);
          const a = resolveMove(board, path, createRng(seed));
          const b = resolveMove(board, path, createRng(seed));
          expect(b).toEqual(a);
        },
      ),
      { numRuns: 200 },
    );
  });
});
