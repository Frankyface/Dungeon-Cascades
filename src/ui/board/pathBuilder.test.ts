import { boardFromRows, boardToRows, MAX_PATH_STEPS } from '../../engine/board';
import type { Direction } from '../../engine/board';
import {
  appendStep,
  beginPath,
  canAppendStep,
  displayBoard,
  hasSteps,
  heldPosition,
  toEnginePath,
} from './pathBuilder';

const board = boardFromRows([
  'RGBYRG',
  'GBYRGB',
  'BYRGBY',
  'YRGBYR',
  'RGBYRG',
]);

describe('pathBuilder basics', () => {
  it('beginPath starts at the picked-up cell with no steps', () => {
    const p = beginPath({ col: 2, row: 2 });
    expect(p).toEqual({ start: { col: 2, row: 2 }, steps: [] });
    expect(hasSteps(p)).toBe(false);
  });

  it('heldPosition follows the committed steps', () => {
    let p = beginPath({ col: 2, row: 2 });
    p = appendStep(p, 'up');
    p = appendStep(p, 'right');
    expect(heldPosition(p)).toEqual({ col: 3, row: 1 });
  });

  it('appendStep is immutable (does not mutate the input path)', () => {
    const p = beginPath({ col: 1, row: 1 });
    const q = appendStep(p, 'down');
    expect(p.steps).toEqual([]);
    expect(q.steps).toEqual(['down']);
  });

  it('toEnginePath produces the engine Path shape', () => {
    const p = appendStep(beginPath({ col: 0, row: 0 }), 'right');
    expect(toEnginePath(p)).toEqual({ start: { col: 0, row: 0 }, steps: ['right'] });
  });
});

describe('canAppendStep (engine bounds + length cap)', () => {
  it('rejects a step that would leave the grid', () => {
    const corner = beginPath({ col: 0, row: 0 });
    expect(canAppendStep(board, corner, 'up')).toBe(false);
    expect(canAppendStep(board, corner, 'left')).toBe(false);
    expect(canAppendStep(board, corner, 'right')).toBe(true);
    expect(canAppendStep(board, corner, 'down')).toBe(true);
  });

  it('rejects appending once the path has hit MAX_PATH_STEPS', () => {
    const steps: Direction[] = [];
    for (let i = 0; i < MAX_PATH_STEPS; i++) {
      steps.push(i % 2 === 0 ? 'right' : 'left');
    }
    const full = { start: { col: 0, row: 2 }, steps };
    expect(canAppendStep(board, full, 'right')).toBe(false);
  });
});

describe('displayBoard mirrors the engine applyPath', () => {
  it('equals the base board before any step commits', () => {
    const p = beginPath({ col: 2, row: 2 });
    expect(displayBoard(board, p)).toEqual(board);
  });

  it('reflects each committed swap', () => {
    const small = boardFromRows(['RG', 'BY']);
    // Pick up (0,0)=R, drag right: R swaps into (1,0).
    const p = appendStep(beginPath({ col: 0, row: 0 }), 'right');
    expect(boardToRows(displayBoard(small, p))).toEqual(['GR', 'BY']);
  });

  it('backtracking a step returns the board to its pre-drag arrangement', () => {
    // Documented decision: a reverse step is appended (not collapsed); swap + inverse
    // swap cancel, so the held tile returns to start and the board is restored.
    const start = { col: 2, row: 2 };
    let p = beginPath(start);
    p = appendStep(p, 'right');
    p = appendStep(p, 'left');
    expect(heldPosition(p)).toEqual(start);
    expect(displayBoard(board, p)).toEqual(board);
    // The path itself still records both steps (it is a real 2-step move).
    expect(p.steps).toEqual(['right', 'left']);
  });
});
