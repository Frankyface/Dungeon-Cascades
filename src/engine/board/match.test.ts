import { boardFromRows } from './board';
import { findMatches } from './match';
import type { ClearedGroup, Position } from './types';

const posKey = (p: Position): string => `${p.col},${p.row}`;
const groupKeys = (g: ClearedGroup): Set<string> => new Set(g.positions.map(posKey));
const keySet = (cells: Position[]): Set<string> => new Set(cells.map(posKey));

describe('findMatches — combo semantics (hand-computed fixtures)', () => {
  it('a simple horizontal 3-match is ONE combo of 3 tiles', () => {
    const board = boardFromRows(['RRRBG', 'GBGBG', 'BGBGB']);
    const groups = findMatches(board);
    expect(groups).toHaveLength(1);
    expect(groups[0].color).toBe('R');
    expect(groupKeys(groups[0])).toEqual(
      keySet([
        { col: 0, row: 0 },
        { col: 1, row: 0 },
        { col: 2, row: 0 },
      ]),
    );
  });

  it('a horizontal 4-match is ONE combo of 4 tiles', () => {
    const board = boardFromRows(['RRRRG', 'GBGBG', 'BGBGB']);
    const groups = findMatches(board);
    expect(groups).toHaveLength(1);
    expect(groups[0].positions).toHaveLength(4);
    expect(groups[0].color).toBe('R');
  });

  it('a vertical 3-match is ONE combo', () => {
    const board = boardFromRows(['RGB', 'RGB', 'RBG', 'GRB']);
    // col0: R,R,R,G -> vertical 3 at rows 0-2.
    const groups = findMatches(board);
    expect(groups).toHaveLength(1);
    expect(groups[0].color).toBe('R');
    expect(groupKeys(groups[0])).toEqual(
      keySet([
        { col: 0, row: 0 },
        { col: 0, row: 1 },
        { col: 0, row: 2 },
      ]),
    );
  });

  it('an L / cross of the SAME color that shares a tile is ONE combo (merged)', () => {
    // col0 rows0-2 = R,R,R (vertical) and row2 cols0-2 = R,R,R (horizontal),
    // sharing (0,2). Merged connected group => 1 combo, 5 distinct cells.
    const board = boardFromRows(['RGBGB', 'RBGBG', 'RRRGB']);
    const groups = findMatches(board);
    expect(groups).toHaveLength(1);
    expect(groups[0].color).toBe('R');
    expect(groupKeys(groups[0])).toEqual(
      keySet([
        { col: 0, row: 0 },
        { col: 0, row: 1 },
        { col: 0, row: 2 },
        { col: 1, row: 2 },
        { col: 2, row: 2 },
      ]),
    );
  });

  it('two disconnected same-color groups are TWO combos', () => {
    // Two red horizontal runs on rows 0 and 2, separated by row 1 -> not connected.
    const board = boardFromRows(['RRRGB', 'GBGBG', 'RRRBG']);
    const groups = findMatches(board);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.color === 'R')).toBe(true);
    expect(groups.every((g) => g.positions.length === 3)).toBe(true);
  });

  it('different-color runs that touch do NOT merge (still two combos)', () => {
    // row0 = R,R,R (red run); col0 continues G,G below -> but a blue run beside it.
    const board = boardFromRows(['RRRP', 'BBBP', 'GYGY']);
    // row0 RRR (red), row1 BBB (blue) — adjacent but different color.
    const groups = findMatches(board);
    expect(groups).toHaveLength(2);
    const colors = groups.map((g) => g.color).sort();
    expect(colors).toEqual(['B', 'R']);
  });

  it('a T-shape of one color is ONE combo', () => {
    // horizontal RRR on row0 cols0-2, plus vertical R down col1 rows0-2 => T.
    const board = boardFromRows(['RRRGB', 'GRGBG', 'BRBGB']);
    const groups = findMatches(board);
    expect(groups).toHaveLength(1);
    expect(groups[0].color).toBe('R');
    expect(groups[0].positions).toHaveLength(5);
  });

  it('reports no combos for a board with no runs', () => {
    const board = boardFromRows(['RGBYR', 'GBYRG', 'BYRGB']);
    expect(findMatches(board)).toHaveLength(0);
  });
});
