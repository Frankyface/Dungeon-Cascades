import {
  applyPath,
  boardFromRows,
  createRng,
  resolveMove,
} from '../../engine/board';
import type { Path } from '../../engine/board';
import { buildWaveViews, replayWave } from './resolutionModel';

// A hand-built board with NO initial matches. Moving the R at (col 0,row 1) up
// swaps it into (0,0), completing R,R,R across the top row.
const board = boardFromRows([
  'GRR',
  'RGB',
  'BYP',
]);

const matchPath: Path = { start: { col: 0, row: 1 }, steps: ['up'] };
// A move that creates no match (swap P<->Y on the bottom row).
const noMatchPath: Path = { start: { col: 2, row: 2 }, steps: ['left'] };

describe('buildWaveViews (faithful replay of the engine resolution)', () => {
  it('the drag really does create a combo (guards the fixture)', () => {
    const resolution = resolveMove(board, matchPath, createRng(123));
    expect(resolution.totalCombos).toBeGreaterThanOrEqual(1);
    expect(resolution.waves.length).toBeGreaterThanOrEqual(1);
  });

  it('reconstructs board snapshots that end exactly at the engine finalBoard', () => {
    const resolution = resolveMove(board, matchPath, createRng(123));
    const postSwap = applyPath(board, matchPath).board;
    const views = buildWaveViews(postSwap, resolution);

    expect(views).toHaveLength(resolution.waves.length);
    // First wave starts from what is already on screen (the post-swap board).
    expect(views[0].boardBefore).toEqual(postSwap);
    // The last reconstructed snapshot must equal the engine's own final board.
    expect(views[views.length - 1].boardAfter).toEqual(resolution.finalBoard);
  });

  it('carries a running combo count that ends at totalCombos', () => {
    const resolution = resolveMove(board, matchPath, createRng(123));
    const postSwap = applyPath(board, matchPath).board;
    const views = buildWaveViews(postSwap, resolution);
    expect(views[views.length - 1].cumulativeCombos).toBe(resolution.totalCombos);
    // Cumulative combos are monotonically non-decreasing.
    for (let i = 1; i < views.length; i++) {
      expect(views[i].cumulativeCombos).toBeGreaterThanOrEqual(views[i - 1].cumulativeCombos);
    }
  });

  it('emits only downward drops (falls and spawns enter from above)', () => {
    const resolution = resolveMove(board, matchPath, createRng(123));
    const postSwap = applyPath(board, matchPath).board;
    const views = buildWaveViews(postSwap, resolution);
    for (const view of views) {
      for (const drop of view.drops) {
        expect(drop.dyCells).toBeLessThan(0);
        expect(drop.cell).toBeGreaterThanOrEqual(0);
        expect(drop.cell).toBeLessThan(board.cols * board.rows);
      }
    }
  });

  it('returns an empty timeline for a move that clears nothing', () => {
    const resolution = resolveMove(board, noMatchPath, createRng(123));
    expect(resolution.totalCombos).toBe(0);
    const postSwap = applyPath(board, noMatchPath).board;
    expect(buildWaveViews(postSwap, resolution)).toEqual([]);
  });
});

describe('replayWave', () => {
  it('applied across every wave equals composing the engine output', () => {
    const resolution = resolveMove(board, matchPath, createRng(7));
    const postSwap = applyPath(board, matchPath).board;
    let snapshot = postSwap;
    for (const wave of resolution.waves) {
      snapshot = replayWave(snapshot, wave);
    }
    expect(snapshot).toEqual(resolution.finalBoard);
  });
});
