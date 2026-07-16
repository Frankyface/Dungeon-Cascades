/**
 * The run-session wiring the UI provider drives: a pure map from a UI action to the engine
 * flow function that applies it, plus the save/resume helpers. Keeping this pure (over the
 * engine API + an injected `RunStorePort`) means the whole save/resume round-trip is testable
 * with the in-memory store — no async-storage, no React. The `.tsx` provider is then a thin
 * shell that calls `applyRunAction`, persists with `persistRun`, and re-routes.
 *
 * Combat TURNS are intentionally NOT here — they go through the engine's `playEncounterTurn`
 * inside the encounter screen (it returns an animatable resolution alongside the next state).
 * This module owns every NON-combat transition plus map travel (move + enter in one step).
 */
import {
  abandonRun,
  advanceToNode,
  buyFromShop,
  chooseEventOption,
  enterNode,
  leaveRest,
  leaveShop,
  resolveDraftPick,
  restAtNode,
  saveOnNodeCompletion,
} from '../../engine/run';
import type { RunOptions, RunState, RunStorePort } from '../../engine/run';

/** A UI-level run action (non-combat). `travel` combines a legal move with entering the node. */
export type RunUiAction =
  | { readonly type: 'enter' }
  | { readonly type: 'travel'; readonly nodeId: string }
  | { readonly type: 'draftPick'; readonly relicId: string | null }
  | { readonly type: 'shopBuy'; readonly index: number }
  | { readonly type: 'shopLeave' }
  | { readonly type: 'eventChoice'; readonly index: number }
  | { readonly type: 'rest' }
  | { readonly type: 'restLeave' }
  | { readonly type: 'abandon' };

/**
 * Apply a UI action to the run, delegating to the matching pure engine flow function. Every
 * branch returns a NEW `RunState`; illegal actions throw from the engine's own guards (a UI
 * bug, never expected). `travel` is move-then-enter so tapping a next node lands the player
 * directly in that node's activity.
 */
export function applyRunAction(state: RunState, action: RunUiAction, options: RunOptions = {}): RunState {
  switch (action.type) {
    case 'enter':
      return enterNode(state, options);
    case 'travel':
      return enterNode(advanceToNode(state, action.nodeId), options);
    case 'draftPick':
      return resolveDraftPick(state, action.relicId);
    case 'shopBuy':
      return buyFromShop(state, action.index).state;
    case 'shopLeave':
      return leaveShop(state);
    case 'eventChoice':
      return chooseEventOption(state, action.index);
    case 'rest':
      return restAtNode(state);
    case 'restLeave':
      return leaveRest(state);
    case 'abandon':
      return abandonRun(state);
  }
}

/**
 * Persist the run at a checkpoint: an active run is saved (full serializable state), a
 * terminal run CLEARS the slot (rogue-lite — a finished run does not resume). Thin wrapper
 * over the engine helper so the provider has one persistence call site.
 */
export function persistRun(store: RunStorePort, state: RunState): void {
  saveOnNodeCompletion(store, state);
}

/** Load a saved run (or `null`). The resume entry point. */
export function loadRun(store: RunStorePort): RunState | null {
  return store.load();
}

/** Whether a resumable run is currently saved. */
export function hasSavedRun(store: RunStorePort): boolean {
  return store.load() !== null;
}
