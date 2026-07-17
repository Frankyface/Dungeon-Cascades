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
import type { BiomeId, CombatState } from '../combat';
import type { MapState, RunMap } from './mapTypes';
import type { ShopState } from './shop';
import type { RestState } from './rest';
import { currentNode, legalNextNodes } from './mapNav';
import { getEvent } from './events';
import { buyShopItem } from './shop';

/**
 * Terminal-or-active status of a run. `defeat` also covers abandonment. `sacrificed` (Stage-6 wave 2,
 * spec §2c) is the Altar's terminal: the run ends immediately in exchange for a permanent relic
 * unlock — it counts as a DEFEAT for score banking (no victory bonus) but is tracked distinctly so
 * the UI can play the sacrifice ceremony rather than a death screen.
 */
export type RunStatus = 'active' | 'victory' | 'defeat' | 'sacrificed';

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
  | { readonly kind: 'altar'; readonly rngState: RngState } // the sacrifice-for-unlock choice (§2c)
  | { readonly kind: 'awaiting_move' } // node resolved: must move to a next node
  | { readonly kind: 'act_transition' } // Act-1 boss beaten: must advanceAct into Act 2
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
   * Which ACT the run is in (Stage-6 wave 1c): `1` = the default dungeon (13-floor map, Bone
   * Colossus); `2` = the seeded Act-2 biome's 13-floor map (`act2BiomeId`), ending at that biome's
   * boss. A fresh run always starts at act 1; `advanceAct` flips it to 2 after the Act-1 boss.
   */
  readonly act: 1 | 2;
  /**
   * The run's Act-2 biome — seeded-random among the four Act-2 biomes, a pure function of the run
   * seed (so it is known and deterministic from `startRun`, and survives save/load unchanged). It
   * drives Act 2's encounter pool and boss; it is inert while `act === 1`.
   */
  readonly act2BiomeId: BiomeId;
  /**
   * OPTIONAL starting-variant id (Stage 4). Present ONLY on a run started from a variant; a
   * vanilla run OMITS this field entirely, so `startRun(seed)` is byte-identical to before
   * variants existed. Purely a UI/telemetry tag (the variant's effects are already baked into
   * the initial state at start) — the flow state machine never reads it.
   */
  readonly variantId?: string;
  /**
   * Cumulative won encounters banked from ALREADY-COMPLETED acts (Stage-6 wave 2, decisions.md
   * 2026-07-17 R2 "cumulative cross-act run scoring"). `advanceAct` folds the finished act's won
   * fights/elites PLUS its beaten boss into this counter before it discards that act's map, so a
   * 2-act run's banked meta score credits BOTH acts (the current act's traversal is read live from
   * `mapState`; this carries the prior acts'). ABSENT on a fresh/Act-1 run (⇒ 0), so a single-act
   * run's score is byte-identical to before R2, and the vanilla `startRun` stays unchanged.
   */
  readonly priorActsEncountersWon?: number;
  /**
   * The distinct NON-boss enemy ids fought so far this run, appended at each fight/elite combat
   * entry (Stage-6 wave 2). Accumulates ACROSS acts — unlike `mapState.visited`, which is reset to
   * the Act-2 map at the transition — so the unlock derivation (`deriveUnlocks`) can mark every
   * fought enemy discovered even on a run that cleared Act 1 and lost its Act-1 path. Boss discovery
   * is KILL-gated (derived from the run outcome), so boss ids are intentionally NOT recorded here.
   * ABSENT until the first combat, so a fresh `startRun` stays byte-identical.
   */
  readonly foughtEnemyIds?: readonly string[];
  /**
   * The run's SNAPSHOT of the meta-unlocked relic pool (Stage-6 wave 2, spec §2), taken at
   * `startRun`. Drafts, shops, and event relic-grants filter to this set, so LOCKED relics never
   * appear in a run. It is a fixed SNAPSHOT on purpose: a relic unlocked MID-RUN (via the Altar,
   * whose sacrifice ends the run anyway) does NOT retroactively enter the current run's pools — the
   * next run's snapshot picks it up. ABSENT ⇒ the pools default to the base 12
   * (`UNLOCKED_BY_DEFAULT_IDS`), so a snapshot-less `startRun(seed)` is byte-identical to before.
   */
  readonly unlockedRelicIds?: readonly string[];
  /**
   * DEV-RUN stamp (spec §8): `true` on a run staged from the dev screen (a seed/variant/biome/jump
   * override). It is the belt-and-braces guard against dev progress leaking into the NORMAL profile:
   * banking REFUSES to accrue a dev-stamped run onto the normal ledger regardless of the dev-mode
   * toggle (see `bankRunRouted`). ABSENT on every ordinary run, so a normal `startRun` is byte-identical.
   */
  readonly isDevRun?: boolean;
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
  | { readonly type: 'sacrifice' } // altar: end the run NOW for a permanent relic unlock (§2c)
  | { readonly type: 'altar_leave' } // altar: skip it (a no-op node)
  | { readonly type: 'transition' } // the single forced action of the act_transition phase
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
    case 'altar':
      // Both are always legal — sacrificing ends the run, leaving skips it — so an altar never wedges.
      return [{ type: 'sacrifice' }, { type: 'altar_leave' }];
    case 'awaiting_move':
      return legalNextNodes(state.map, state.mapState).map((nodeId) => ({ type: 'move', nodeId }));
    case 'act_transition':
      return [{ type: 'transition' }]; // one forced action: advance into Act 2 (never a wedge)
    case 'ended':
      return [];
  }
}

/** The player's current map node. */
export function currentRunNode(state: RunState): ReturnType<typeof currentNode> {
  return currentNode(state.map, state.mapState);
}
