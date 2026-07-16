import { createBoard } from './create';
import { findMatches } from './match';
import { TILE_COLORS, COLS, ROWS, CELL_COUNT } from './config';
import { createRng } from './rng';

describe('createBoard', () => {
  it('produces a full 6x5 board of valid colors', () => {
    const board = createBoard(1);
    expect(board.cols).toBe(COLS);
    expect(board.rows).toBe(ROWS);
    expect(board.tiles).toHaveLength(CELL_COUNT);
    for (const tile of board.tiles) {
      expect(TILE_COLORS).toContain(tile);
    }
  });

  it('never contains a pre-existing match across many seeds', () => {
    for (let seed = 0; seed < 300; seed++) {
      const board = createBoard(seed);
      const matches = findMatches(board);
      expect(matches).toHaveLength(0);
    }
  });

  it('is deterministic per seed', () => {
    for (const seed of [0, 1, 7, 42, 100, 65535]) {
      expect(createBoard(seed)).toEqual(createBoard(seed));
    }
  });

  it('produces different boards for different seeds (sanity)', () => {
    expect(createBoard(1)).not.toEqual(createBoard(2));
  });

  it('accepts an RngState as well as a raw seed', () => {
    const fromSeed = createBoard(123);
    const fromState = createBoard(createRng(123));
    expect(fromState).toEqual(fromSeed);
  });
});
