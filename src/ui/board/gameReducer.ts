/**
 * The naked-board game state machine — a pure reducer (no React import), so it is
 * Jest-testable in isolation and drives the `useReducer` in `BoardScreen`.
 *
 * Phases:
 *   idle       — a stable board is shown; input is accepted (pick up a tile).
 *   dragging   — a tile is held; steps commit as the finger crosses cells; the
 *                move timer starts on the FIRST committed step.
 *   resolving  — the move has ended; the wave animation is playing; input is LOCKED
 *                until `settle` returns the board to idle.
 *
 * Move RNG: the board is seeded with `seed` (createBoard consumes that stream
 * internally); the independent MOVE rng is `createRng(seed + 1)` and is threaded
 * across moves via each resolution's returned `rngState` — never reused stale.
 */
import { createBoard, createRng } from '../../engine/board';
import type { Board, Direction, MoveResolution, Position, RngState } from '../../engine/board';
import {
  appendStep,
  beginPath,
  canAppendStep,
  displayBoard,
  hasSteps,
  type DragPath,
} from './pathBuilder';
import { idleTimer, resetTimer, startTimer, type TimerState } from './timer';
import { MOVE_TIMER_MS } from './constants';

export type GamePhase = 'idle' | 'dragging' | 'resolving';

export interface GameState {
  readonly seed: number;
  /** Committed base board (before the current drag's swaps). */
  readonly board: Board;
  /** Board with the current drag's swaps applied — equals `board` when idle. */
  readonly display: Board;
  /** Move RNG, threaded across moves. */
  readonly rng: RngState;
  readonly phase: GamePhase;
  readonly drag: DragPath | null;
  readonly timer: TimerState;
  /** Total combos of the most recently resolved move; persists on screen. `null` before any move. */
  readonly lastTotalCombos: number | null;
  /** Monotonic counter bumped whenever a fresh drag is picked up (helps the view reset per-drag animation). */
  readonly dragNonce: number;
}

export type GameAction =
  | { readonly type: 'newBoard'; readonly seed: number }
  | { readonly type: 'pickUp'; readonly cell: Position }
  | { readonly type: 'commit'; readonly dir: Direction }
  | { readonly type: 'startTimer' }
  | { readonly type: 'beginResolve' }
  | { readonly type: 'settle'; readonly resolution: MoveResolution }
  | { readonly type: 'cancelDrag' };

/** Build the initial state for a given seed. */
export function initGameState(seed: number): GameState {
  const board = createBoard(seed);
  return {
    seed,
    board,
    display: board,
    rng: createRng(seed + 1),
    phase: 'idle',
    drag: null,
    timer: idleTimer(MOVE_TIMER_MS),
    lastTotalCombos: null,
    dragNonce: 0,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'newBoard':
      return initGameState(action.seed);

    case 'pickUp': {
      // Only from a stable board. Ignore stray touches mid-drag / mid-resolve.
      if (state.phase !== 'idle') {
        return state;
      }
      const drag = beginPath(action.cell);
      return {
        ...state,
        phase: 'dragging',
        drag,
        display: state.board,
        timer: idleTimer(state.timer.durationMs),
        dragNonce: state.dragNonce + 1,
      };
    }

    case 'commit': {
      if (state.phase !== 'dragging' || !state.drag) {
        return state;
      }
      if (!canAppendStep(state.board, state.drag, action.dir)) {
        return state; // off-grid or over the length cap — no-op, keep dragging
      }
      const wasFirstStep = !hasSteps(state.drag);
      const nextDrag = appendStep(state.drag, action.dir);
      return {
        ...state,
        drag: nextDrag,
        display: displayBoard(state.board, nextDrag),
        // The timer starts on the first committed step and never restarts after.
        timer: wasFirstStep ? startTimer(state.timer) : state.timer,
      };
    }

    case 'startTimer':
      // Explicit start (idempotent) — used if the view needs to force it.
      if (state.phase !== 'dragging') {
        return state;
      }
      return { ...state, timer: startTimer(state.timer) };

    case 'beginResolve': {
      // Lock input while the wave animation plays. Requires a real (non-empty) drag.
      if (state.phase !== 'dragging' || !state.drag || !hasSteps(state.drag)) {
        return state;
      }
      return { ...state, phase: 'resolving' };
    }

    case 'settle': {
      const res = action.resolution;
      return {
        ...state,
        board: res.finalBoard,
        display: res.finalBoard,
        rng: res.rngState,
        phase: 'idle',
        drag: null,
        timer: resetTimer(state.timer),
        lastTotalCombos: res.totalCombos,
      };
    }

    case 'cancelDrag':
      // Released without committing any step (a tap) — no move happens.
      return {
        ...state,
        phase: 'idle',
        drag: null,
        display: state.board,
        timer: resetTimer(state.timer),
      };

    default:
      return state;
  }
}
