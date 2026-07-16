import { COLS, ROWS } from '../../engine/board';
import { computeBoardLayout, cellCenter, cellTopLeft, pixelToCell } from './layout';

describe('computeBoardLayout', () => {
  it('defaults to the engine grid shape (6x5) and produces square, positive cells', () => {
    const layout = computeBoardLayout(400);
    expect(layout.cols).toBe(COLS);
    expect(layout.rows).toBe(ROWS);
    expect(layout.cellSize).toBeGreaterThan(0);
    expect(layout.pitch).toBe(layout.cellSize + layout.gap);
  });

  it('never exceeds the usable width and stays internally consistent', () => {
    const layout = computeBoardLayout(400);
    // width = 2*padding + cols*cell + (cols-1)*gap
    const expectedWidth =
      2 * layout.padding + layout.cols * layout.cellSize + (layout.cols - 1) * layout.gap;
    const expectedHeight =
      2 * layout.padding + layout.rows * layout.cellSize + (layout.rows - 1) * layout.gap;
    expect(layout.width).toBe(expectedWidth);
    expect(layout.height).toBe(expectedHeight);
    expect(layout.width).toBeLessThanOrEqual(400 * 0.94 + 1);
  });

  it('is deterministic for the same input', () => {
    expect(computeBoardLayout(375)).toEqual(computeBoardLayout(375));
  });

  it('caps the board width on very wide screens', () => {
    const wide = computeBoardLayout(2000);
    expect(wide.width).toBeLessThanOrEqual(520 + 1);
  });
});

describe('cell geometry', () => {
  const layout = computeBoardLayout(375);

  it('cellCenter is the top-left corner plus half a cell', () => {
    const tl = cellTopLeft(layout, 3, 2);
    const c = cellCenter(layout, { col: 3, row: 2 });
    expect(c.x).toBeCloseTo(tl.x + layout.cellSize / 2);
    expect(c.y).toBeCloseTo(tl.y + layout.cellSize / 2);
  });
});

describe('pixelToCell', () => {
  const layout = computeBoardLayout(375);

  it('maps the center pixel of a cell back to that cell', () => {
    for (const pos of [
      { col: 0, row: 0 },
      { col: 5, row: 4 },
      { col: 3, row: 2 },
    ]) {
      const c = cellCenter(layout, pos);
      expect(pixelToCell(layout, c.x, c.y)).toEqual(pos);
    }
  });

  it('returns null for points outside the canvas', () => {
    expect(pixelToCell(layout, -5, 10)).toBeNull();
    expect(pixelToCell(layout, 10, -5)).toBeNull();
    expect(pixelToCell(layout, layout.width + 1, 10)).toBeNull();
    expect(pixelToCell(layout, 10, layout.height + 1)).toBeNull();
  });

  it('clamps points inside the padding to the nearest edge cell', () => {
    // A point in the top-left padding resolves to cell (0,0), not null.
    expect(pixelToCell(layout, 1, 1)).toEqual({ col: 0, row: 0 });
  });
});
