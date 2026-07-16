import { createRng, findMatches, boardFromRows } from '../../engine/board';
import type { Board, MoveResolution } from '../../engine/board';
import { gameReducer, initGameState, type GameState } from './gameReducer';

function fresh(seed = 42): GameState {
  return initGameState(seed);
}

describe('initGameState', () => {
  it('creates a match-free board, idle phase, and an independent move RNG', () => {
    const s = fresh(42);
    expect(s.phase).toBe('idle');
    expect(s.drag).toBeNull();
    expect(s.display).toEqual(s.board);
    expect(findMatches(s.board)).toHaveLength(0);
    // Move RNG is seed+1, distinct from the board's internal stream.
    expect(s.rng).toEqual(createRng(43));
    expect(s.timer.status).toBe('idle');
    expect(s.lastTotalCombos).toBeNull();
  });
});

describe('pick up', () => {
  it('idle -> dragging and bumps the drag nonce', () => {
    const s = fresh();
    const next = gameReducer(s, { type: 'pickUp', cell: { col: 2, row: 2 } });
    expect(next.phase).toBe('dragging');
    expect(next.drag).toEqual({ start: { col: 2, row: 2 }, steps: [] });
    expect(next.dragNonce).toBe(s.dragNonce + 1);
    expect(next.timer.status).toBe('idle');
  });

  it('is ignored when not idle (no pick-up mid-drag)', () => {
    const s = gameReducer(fresh(), { type: 'pickUp', cell: { col: 2, row: 2 } });
    const again = gameReducer(s, { type: 'pickUp', cell: { col: 0, row: 0 } });
    expect(again.drag).toEqual(s.drag);
  });
});

describe('commit', () => {
  it('appends a valid step, mirrors the board, and starts the timer on the first step', () => {
    let s = gameReducer(fresh(), { type: 'pickUp', cell: { col: 2, row: 2 } });
    s = gameReducer(s, { type: 'commit', dir: 'up' });
    expect(s.drag?.steps).toEqual(['up']);
    expect(s.timer.status).toBe('running');
    // display now differs from the base board (a swap happened).
    expect(s.display).not.toEqual(s.board);
  });

  it('does not restart the timer on later steps', () => {
    let s = gameReducer(fresh(), { type: 'pickUp', cell: { col: 2, row: 2 } });
    s = gameReducer(s, { type: 'commit', dir: 'up' });
    const runningTimer = s.timer;
    s = gameReducer(s, { type: 'commit', dir: 'right' });
    expect(s.timer).toBe(runningTimer); // same object -> never re-started
    expect(s.drag?.steps).toEqual(['up', 'right']);
  });

  it('ignores an off-grid step (held tile cannot leave the board)', () => {
    let s = gameReducer(fresh(), { type: 'pickUp', cell: { col: 0, row: 0 } });
    const before = s;
    s = gameReducer(s, { type: 'commit', dir: 'up' }); // off the top edge
    expect(s.drag?.steps).toEqual([]);
    expect(s.timer.status).toBe('idle');
    expect(s.display).toEqual(before.display);
  });

  it('backtracking restores the displayed board', () => {
    let s = gameReducer(fresh(), { type: 'pickUp', cell: { col: 2, row: 2 } });
    s = gameReducer(s, { type: 'commit', dir: 'right' });
    s = gameReducer(s, { type: 'commit', dir: 'left' });
    expect(s.display).toEqual(s.board);
    expect(s.drag?.steps).toEqual(['right', 'left']);
  });
});

describe('resolve lifecycle', () => {
  it('beginResolve requires a non-empty drag and locks input', () => {
    let s = gameReducer(fresh(), { type: 'pickUp', cell: { col: 2, row: 2 } });
    // No steps yet -> beginResolve is a no-op.
    expect(gameReducer(s, { type: 'beginResolve' }).phase).toBe('dragging');
    s = gameReducer(s, { type: 'commit', dir: 'up' });
    s = gameReducer(s, { type: 'beginResolve' });
    expect(s.phase).toBe('resolving');
  });

  it('beginResolve resets the move timer so the bar reads full through resolving (not drained)', () => {
    let s = gameReducer(fresh(), { type: 'pickUp', cell: { col: 2, row: 2 } });
    s = gameReducer(s, { type: 'commit', dir: 'up' }); // starts the timer
    expect(s.timer.status).toBe('running');
    s = gameReducer(s, { type: 'beginResolve' });
    expect(s.phase).toBe('resolving');
    expect(s.timer.status).toBe('idle'); // reset — not left running/drained during the cascade
  });

  it('cancelDrag is ignored when not dragging (guards the timer-expiry/release race mid-resolve)', () => {
    let s = gameReducer(fresh(), { type: 'pickUp', cell: { col: 2, row: 2 } });
    s = gameReducer(s, { type: 'commit', dir: 'up' });
    s = gameReducer(s, { type: 'beginResolve' });
    expect(s.phase).toBe('resolving');
    const after = gameReducer(s, { type: 'cancelDrag' });
    expect(after.phase).toBe('resolving'); // NOT reset to idle — the held tile survives to settle
    expect(after).toBe(s); // strict no-op: same reference
  });

  it('settle commits the final board, threads the RNG, and records combos', () => {
    let s = gameReducer(fresh(), { type: 'pickUp', cell: { col: 2, row: 2 } });
    s = gameReducer(s, { type: 'commit', dir: 'up' });
    s = gameReducer(s, { type: 'beginResolve' });

    const finalBoard: Board = boardFromRows(['RGBYRG', 'GBYRGB', 'BYRGBY', 'YRGBYR', 'RGBYRG']);
    const resolution: MoveResolution = {
      swaps: [],
      waves: [],
      finalBoard,
      totalCombos: 3,
      rngState: createRng(999),
    };
    s = gameReducer(s, { type: 'settle', resolution });

    expect(s.phase).toBe('idle');
    expect(s.board).toEqual(finalBoard);
    expect(s.display).toEqual(finalBoard);
    expect(s.rng).toEqual(createRng(999));
    expect(s.lastTotalCombos).toBe(3);
    expect(s.drag).toBeNull();
    expect(s.timer.status).toBe('idle');
  });

  it('cancelDrag returns to idle with the base board and no move', () => {
    let s = gameReducer(fresh(), { type: 'pickUp', cell: { col: 2, row: 2 } });
    const baseBoard = s.board;
    s = gameReducer(s, { type: 'cancelDrag' });
    expect(s.phase).toBe('idle');
    expect(s.drag).toBeNull();
    expect(s.display).toEqual(baseBoard);
  });
});
