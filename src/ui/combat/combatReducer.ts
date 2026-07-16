/**
 * The combat-screen state machine — a pure reducer (no React import), Jest-testable
 * in isolation, driving the `useReducer` in `CombatScreen`. It mirrors the Stage-1
 * `gameReducer` for the board-drag phases and REUSES the same pure drag/timer
 * helpers, then layers the combat turn phases on top.
 *
 * ZERO combat rules live here: the screen calls the engine's `playTurn` and this
 * reducer only threads the returned `TurnResolution` / next `CombatState` through
 * the phases and locks input in terminal states.
 *
 * Phases (the only legal path):
 *   idle        — a stable board + telegraphed intent; input accepted (pick up).
 *   dragging    — a tile is held; steps commit; the move timer runs.
 *   resolving   — the player's move is animating the board cascade; input LOCKED.
 *   enemyActing — cascade done; HP deltas + the enemy's telegraphed action animate.
 *   won / lost  — terminal; every input is a no-op until `restart`.
 */
import type { Board, Direction, Position } from '../../engine/board';
import { startEncounter } from '../../engine/combat';
import type { CombatState, EnemyId, TurnResolution } from '../../engine/combat';
import {
  appendStep,
  beginPath,
  canAppendStep,
  displayBoard,
  hasSteps,
  type DragPath,
} from '../board/pathBuilder';
import { idleTimer, resetTimer, startTimer, type TimerState } from '../board/timer';
import { MOVE_TIMER_MS } from '../board/constants';

export type CombatPhase = 'idle' | 'dragging' | 'resolving' | 'enemyActing' | 'won' | 'lost';

export interface CombatScreenState {
  readonly enemyId: EnemyId;
  /** The encounter seed, so "Retry (new seed)" can re-roll deterministically. */
  readonly seed: number;
  /** Authoritative engine encounter state (board, RNG, HP, telegraph, status). */
  readonly combat: CombatState;
  /** Board with the current drag's swaps applied — equals `combat.board` when idle. */
  readonly display: Board;
  readonly phase: CombatPhase;
  readonly drag: DragPath | null;
  readonly timer: TimerState;
  /** Bumped whenever a fresh drag is picked up (lets the view reset per-drag anim). */
  readonly dragNonce: number;
  /** The most recently resolved turn, for HP animation + feedback. `null` pre-move. */
  readonly lastResolution: TurnResolution | null;
}

export type CombatScreenAction =
  | { readonly type: 'restart'; readonly seed: number }
  | { readonly type: 'pickUp'; readonly cell: Position }
  | { readonly type: 'commit'; readonly dir: Direction }
  | { readonly type: 'cancelDrag' }
  | { readonly type: 'beginResolve' }
  | { readonly type: 'boardResolved'; readonly resolution: TurnResolution }
  | { readonly type: 'turnSettled' };

/**
 * Build the initial screen state for an encounter (fresh board, full HP). Pass `combat` to
 * seed the reducer from an EXTERNALLY-MANAGED encounter (the run layer's scaled / boss enemy
 * with relic combat-start effects already applied); omit it for a plain standalone fight.
 */
export function initCombatState(
  enemyId: EnemyId,
  seed: number,
  combat: CombatState = startEncounter(enemyId, seed),
): CombatScreenState {
  return {
    enemyId,
    seed,
    combat,
    display: combat.board,
    phase: 'idle',
    drag: null,
    timer: idleTimer(MOVE_TIMER_MS),
    dragNonce: 0,
    lastResolution: null,
  };
}

/** True when the encounter has ended (input is locked). */
function isTerminal(phase: CombatPhase): boolean {
  return phase === 'won' || phase === 'lost';
}

/** Map an engine encounter status to the terminal-or-idle resting phase. */
function restingPhase(status: CombatState['status']): CombatPhase {
  if (status === 'won') return 'won';
  if (status === 'lost') return 'lost';
  return 'idle';
}

export function combatReducer(
  state: CombatScreenState,
  action: CombatScreenAction,
): CombatScreenState {
  switch (action.type) {
    case 'restart':
      return initCombatState(state.enemyId, action.seed);

    case 'pickUp': {
      // Only from a stable, non-terminal board. Ignore stray touches otherwise.
      if (state.phase !== 'idle') {
        return state;
      }
      const drag = beginPath(action.cell);
      return {
        ...state,
        phase: 'dragging',
        drag,
        display: state.combat.board,
        timer: idleTimer(state.timer.durationMs),
        dragNonce: state.dragNonce + 1,
      };
    }

    case 'commit': {
      if (state.phase !== 'dragging' || !state.drag) {
        return state;
      }
      if (!canAppendStep(state.combat.board, state.drag, action.dir)) {
        return state; // off-grid or past the length cap — keep dragging
      }
      const wasFirstStep = !hasSteps(state.drag);
      const nextDrag = appendStep(state.drag, action.dir);
      return {
        ...state,
        drag: nextDrag,
        display: displayBoard(state.combat.board, nextDrag),
        // Timer starts on the first committed step and never restarts after.
        timer: wasFirstStep ? startTimer(state.timer) : state.timer,
      };
    }

    case 'cancelDrag':
      // Released/expired without committing a step (a tap) — no move happens.
      if (state.phase !== 'dragging') {
        return state;
      }
      return {
        ...state,
        phase: 'idle',
        drag: null,
        display: state.combat.board,
        timer: resetTimer(state.timer),
      };

    case 'beginResolve': {
      // Lock input while the move animates. Requires a real (non-empty) drag.
      if (state.phase !== 'dragging' || !state.drag || !hasSteps(state.drag)) {
        return state;
      }
      return { ...state, phase: 'resolving', timer: resetTimer(state.timer) };
    }

    case 'boardResolved': {
      // The board cascade finished animating; hand off to the enemy-action beat.
      // Show the settled post-cascade board; HP deltas animate during enemyActing.
      // `combat` stays PRE-turn here (HP is derived from lastResolution while
      // acting); it advances to the engine's next state on `turnSettled`.
      if (state.phase !== 'resolving') {
        return state;
      }
      return {
        ...state,
        phase: 'enemyActing',
        display: action.resolution.state.board,
        lastResolution: action.resolution,
      };
    }

    case 'turnSettled': {
      // The enemy-action beat finished; commit the engine's next state and rest.
      if (state.phase !== 'enemyActing' || !state.lastResolution) {
        return state;
      }
      const next = state.lastResolution.state;
      return {
        ...state,
        combat: next,
        display: next.board,
        phase: restingPhase(next.status),
        drag: null,
        timer: resetTimer(state.timer),
      };
    }

    default:
      return state;
  }
}

/** Whether the encounter is in a terminal (won/lost) phase. */
export function isEncounterOver(state: CombatScreenState): boolean {
  return isTerminal(state.phase);
}
