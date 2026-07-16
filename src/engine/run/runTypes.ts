/**
 * Serializable data model for a whole RUN — the single save unit that stitches map + combat
 * + relics + economy into one persistent object.
 *
 * A run is a phase state machine: the player is always in exactly one `RunPhase` (at a node,
 * mid-fight, drafting, in a shop/event/rest, choosing the next node, or finished). Every
 * shape here is plain JSON-safe data (no classes/methods) so a RunState round-trips losslessly
 * through storage and resumes identically. All fields are `readonly` — the flow functions
 * return new RunStates, never mutating.
 *
 * PURE ENGINE: no React / React Native imports; no ambient time or randomness (seeded PRNG
 * threaded through combat / event RNG). See CLAUDE.md.
 */
import type { RngState } from '../board';
import type { CombatState } from '../combat';
import type { MapState, RunMap } from './mapTypes';
import type { ShopState } from './shop';
import type { RestState } from './rest';
import { currentNode, legalNextNodes } from './mapNav';
import { getEvent } from './events';
import { buyShopItem } from './shop';

/** Terminal-or-active status of a run. `defeat` also covers abandonment. */
export type RunStatus = 'active' | 'victory' | 'defeat';

/** Which kind of encounter a combat phase is (decides the win reward path). */
export type EncounterKind = 'fight' | 'elite' | 'boss';

/**
 * What the player is currently doing. A discriminated union — the ONLY place the current
 * encounter (CombatState), the pending draft/shop/event/rest live. Exactly one is active.
 */
export type RunPhase =
  | { readonly kind: 'awaiting_node' } // at the current (unresolved) node: must enterNode
  | {
      readonly kind: 'combat';
      readonly encounter: CombatState;
      readonly encounterKind: EncounterKind;
      readonly bossPhase: number; // boss only; 0 for fight/elite
    }
  | { readonly kind: 'draft'; readonly options: readonly string[] } // post-win pick-1-of-3
  | { readonly kind: 'shop'; readonly shop: ShopState }
  | { readonly kind: 'event'; readonly eventId: string; readonly rngState: RngState }
  | { readonly kind: 'rest'; readonly rest: RestState }
  | { readonly kind: 'awaiting_move' } // node resolved: must move to a next node
  | { readonly kind: 'ended' }; // terminal (see status)

/** The one serializable run object: map + position, HP, gold, relics, current phase, status. */
export interface RunState {
  /** Schema tag for forward-compatible save/load. */
  readonly version: 1;
  /** The run seed — every sub-stream derives from this (fully reproducible). */
  readonly seed: number;
  readonly map: RunMap;
  readonly mapState: MapState;
  readonly playerHp: number;
  readonly playerMaxHp: number;
  readonly gold: number;
  readonly relicIds: readonly string[];
  /** Count of nodes fully resolved (telemetry; seeds are keyed by node coordinate, not this). */
  readonly nodesCompleted: number;
  readonly phase: RunPhase;
  readonly status: RunStatus;
  /**
   * OPTIONAL starting-variant id (Stage 4). Present ONLY on a run started from a variant; a
   * vanilla run OMITS this field entirely, so `startRun(seed)` is byte-identical to before
   * variants existed. Purely a UI/telemetry tag (the variant's effects are already baked into
   * the initial state at start) — the flow state machine never reads it.
   */
  readonly variantId?: string;
}

/** Whether the run has finished (victory or defeat). Terminal states reject all actions. */
export function isTerminal(state: RunState): boolean {
  return state.status !== 'active';
}

/** Guard: every flow/node action requires an ACTIVE run (terminal states reject all actions). */
export function assertRunActive(state: RunState): void {
  if (isTerminal(state)) {
    throw new Error(`run action rejected: run is already ${state.status} (terminal)`);
  }
}

/** Guard: the run must currently be in `expected` phase. */
export function assertRunPhase(state: RunState, expected: RunPhase['kind']): void {
  if (state.phase.kind !== expected) {
    throw new Error(`run action rejected: expected phase '${expected}', got '${state.phase.kind}'`);
  }
}

/** A structured legal-action descriptor (drives the no-wedge guarantee + sim policies). */
export type RunAction =
  | { readonly type: 'enter' }
  | { readonly type: 'play_turn' }
  | { readonly type: 'draft_pick'; readonly relicId: string }
  | { readonly type: 'draft_skip' }
  | { readonly type: 'shop_buy'; readonly index: number }
  | { readonly type: 'shop_leave' }
  | { readonly type: 'event_choice'; readonly index: number }
  | { readonly type: 'rest' }
  | { readonly type: 'rest_leave' }
  | { readonly type: 'move'; readonly nodeId: string };

/**
 * Every legal action from the current state. The invariant the no-wedge property test pins:
 * a non-terminal run ALWAYS has ≥1 legal action (economy nodes always allow leave/skip; a
 * combat board always has a legal drag; awaiting_move always has ≥1 next node except the boss,
 * whose combat ends the run). Only the terminal `ended` phase has an empty action set.
 */
export function legalActions(state: RunState): readonly RunAction[] {
  const phase = state.phase;
  switch (phase.kind) {
    case 'awaiting_node':
      return [{ type: 'enter' }];
    case 'combat':
      // A 6×5 board always admits at least one legal 1-step drag, so combat never wedges.
      return [{ type: 'play_turn' }];
    case 'draft': {
      const picks: RunAction[] = phase.options.map((relicId) => ({ type: 'draft_pick', relicId }));
      picks.push({ type: 'draft_skip' }); // skipping a draft is always legal
      return picks;
    }
    case 'shop': {
      const actions: RunAction[] = [];
      for (let i = 0; i < phase.shop.items.length; i++) {
        if (buyShopItem(phase.shop, i, state.gold).ok) actions.push({ type: 'shop_buy', index: i });
      }
      actions.push({ type: 'shop_leave' }); // leaving is always legal
      return actions;
    }
    case 'event':
      return getEvent(phase.eventId).choices.map((_c, index) => ({ type: 'event_choice', index }));
    case 'rest':
      return phase.rest.rested ? [{ type: 'rest_leave' }] : [{ type: 'rest' }, { type: 'rest_leave' }];
    case 'awaiting_move':
      return legalNextNodes(state.map, state.mapState).map((nodeId) => ({ type: 'move', nodeId }));
    case 'ended':
      return [];
  }
}

/** The player's current map node. */
export function currentRunNode(state: RunState): ReturnType<typeof currentNode> {
  return currentNode(state.map, state.mapState);
}
