import {
  boardFromRows,
  boardToRows,
  indexOf,
  positionOf,
  inBounds,
  tileAt,
} from './board';

describe('board data helpers', () => {
  const board = boardFromRows(['RGB', 'YPR', 'GBY']);

  it('boardFromRows derives dimensions and stores tiles row-major', () => {
    expect(board.cols).toBe(3);
    expect(board.rows).toBe(3);
    expect(board.tiles).toHaveLength(9);
    // index = row * cols + col
    expect(board.tiles[0]).toBe('R'); // (0,0)
    expect(board.tiles[3]).toBe('Y'); // (0,1)
    expect(board.tiles[8]).toBe('Y'); // (2,2)
  });

  it('boardToRows round-trips boardFromRows', () => {
    expect(boardToRows(board)).toEqual(['RGB', 'YPR', 'GBY']);
  });

  it('indexOf and positionOf are inverses', () => {
    for (let i = 0; i < board.tiles.length; i++) {
      const pos = positionOf(board, i);
      expect(indexOf(board, pos)).toBe(i);
    }
  });

  it('tileAt reads by position', () => {
    expect(tileAt(board, { col: 0, row: 0 })).toBe('R');
    expect(tileAt(board, { col: 2, row: 1 })).toBe('R');
    expect(tileAt(board, { col: 1, row: 2 })).toBe('B');
  });

  it('inBounds distinguishes on-grid from off-grid positions', () => {
    expect(inBounds(board, { col: 0, row: 0 })).toBe(true);
    expect(inBounds(board, { col: 2, row: 2 })).toBe(true);
    expect(inBounds(board, { col: -1, row: 0 })).toBe(false);
    expect(inBounds(board, { col: 0, row: 3 })).toBe(false);
    expect(inBounds(board, { col: 3, row: 0 })).toBe(false);
  });

  it('boardFromRows rejects a ragged grid', () => {
    expect(() => boardFromRows(['RGB', 'RG'])).toThrow();
  });

  it('boardFromRows rejects an unknown color code', () => {
    expect(() => boardFromRows(['RGX'])).toThrow();
  });

  it('boardFromRows rejects an empty grid', () => {
    expect(() => boardFromRows([])).toThrow();
  });
});
