/**
 * Serializable data model for the combat layer.
 *
 * Mirrors the board engine's discipline: every shape here is plain JSON-safe data
 * (no classes, no methods, no hidden state) so CombatState / TurnResolution can
 * cross the engine/UI boundary, be snapshotted by tests, and be consumed by the
 * headless combat sim. All fields are `readonly` — the engine never mutates; each
 * operation returns a new object.
 *
 * PURE ENGINE: no React / React Native imports; no ambient time or randomness
 * (seeded PRNG only, threaded through the board engine). See CLAUDE.md.
 */
import type { Board, ClearedGroup, MoveResolution, RngState, TileColor } from '../board';

/** The three Stage-2 enemies, addressed by a stable serializable id. */
export type EnemyId = 'slime' | 'skeleton' | 'bat';

/**
 * What an enemy can do on its turn. A deliberately small, EXTENSIBLE union: a
 * Stage-3 verb (block, debuff, summon) is added by extending `type` and adding one
 * handler branch in `applyEnemyAction` — no rework of the state machine.
 * - `attack`: deal `value` damage to the player.
 * - `charge`: a telegraphed wind-up; `value` is 0 (does nothing this turn, but the
 *   NEXT telegraph is the big hit the player now sees coming).
 * - `heal`:   the enemy heals ITSELF by `value` (capped at its max HP).
 */
export type EnemyActionType = 'attack' | 'charge' | 'heal';

/** A single telegraphed enemy action (type + value). This IS what fires. */
export interface EnemyAction {
  readonly type: EnemyActionType;
  readonly value: number;
}

/**
 * Per-enemy affinity table. Maps a damage color to its multiplier; a color absent
 * from the table is `normal` (1.0). Supported multipliers: weak 2.0 / normal 1.0 /
 * resist 0.5 / immune 0.0 (any non-negative number is legal — these are the
 * documented tiers). The heal color (P) never consults this table.
 */
export type AffinityTable = Partial<Record<TileColor, number>>;

/**
 * A fully-defined enemy as pure data: id, max HP, its affinity spread, and its
 * deterministic intent script (a cyclic list of telegraphed actions). Lives in the
 * static registry (see enemies.ts) — NOT serialized into CombatState, which stores
 * only the `enemyId` plus live HP/intent pointers.
 */
export interface Enemy {
  readonly id: EnemyId;
  readonly maxHp: number;
  readonly affinity: AffinityTable;
  /** Cyclic intent script; the enemy walks it in order and wraps at the end. */
  readonly script: readonly EnemyAction[];
}

/** Terminal / running status of an encounter. */
export type EncounterStatus = 'ongoing' | 'won' | 'lost';

/** Which combat verb a tile color resolves to (data-driven effect table). */
export type EffectKind = 'damage' | 'heal';

/**
 * The combat contribution of ONE cleared group, broken out for the UI (floating
 * damage/heal numbers) and for hand-computed fixtures.
 * - `baseAmount`: the pre-cascade, post-affinity amount for this single group.
 * - The authoritative applied numbers are the move-level rounded `damage`/`heal`
 *   on TurnResolution — per-group `baseAmount` is unrounded (see effects.ts for
 *   the single-rounding-site rule).
 */
export interface GroupEffect {
  readonly color: TileColor;
  readonly size: number;
  readonly kind: EffectKind;
  /** Affinity multiplier applied (damage groups); 1 for heal groups (unused). */
  readonly affinity: number;
  /** Pre-cascade, post-affinity contribution of this group (unrounded). */
  readonly baseAmount: number;
}

/**
 * The aggregated combat effect of a whole move (all groups across all waves),
 * before it is applied to HP. Produced by `computeEffects`.
 */
export interface CombatEffects {
  readonly groups: readonly GroupEffect[];
  /** `1 + CASCADE_BONUS × (totalCombos − 1)`; 1 when there are no groups. */
  readonly cascadeMultiplier: number;
  /** Total damage the move deals to the enemy (rounded once, at the aggregate). */
  readonly damage: number;
  /** Total self-heal the move rolls for the player (rounded once; pre-cap). */
  readonly heal: number;
}

/**
 * Serializable encounter state. Plain data end-to-end: `enemyId` (not the Enemy
 * object), live HP for both sides, the intent-script cursor, the currently
 * telegraphed action, run status, and the board + refill RNG so the whole fight is
 * a pure function of (enemyId, seed, path sequence).
 */
export interface CombatState {
  readonly enemyId: EnemyId;
  readonly board: Board;
  /** Refill RNG for `resolveMove`, threaded move-to-move (board convention). */
  readonly rngState: RngState;
  readonly playerHp: number;
  readonly playerMaxHp: number;
  readonly enemyHp: number;
  readonly enemyMaxHp: number;
  /** Cursor into the enemy's cyclic intent script. */
  readonly intentIndex: number;
  /** The action the enemy WILL take next turn — exactly what fires. */
  readonly telegraph: EnemyAction;
  readonly status: EncounterStatus;
  /** Number of player turns resolved so far. */
  readonly turn: number;
}

/**
 * Everything a UI needs to animate one turn, plus the next `state` to feed back
 * into `playTurn`. Fully serializable.
 */
export interface TurnResolution {
  /** The board engine's replayable result (swaps, cascade waves, final board). */
  readonly move: MoveResolution;
  /** Per-group damage/heal breakdown (flattened across all waves). */
  readonly groups: readonly GroupEffect[];
  readonly cascadeMultiplier: number;
  /** Rounded total damage the move rolled (overkill retained; not floored). */
  readonly damage: number;
  /** Rounded total heal the move rolled (pre-cap; actual gain = HP delta). */
  readonly heal: number;
  /** What the enemy did this turn; `null` when the enemy died and never acted. */
  readonly enemyAction: EnemyAction | null;
  readonly playerHpBefore: number;
  readonly playerHpAfter: number;
  readonly enemyHpBefore: number;
  readonly enemyHpAfter: number;
  /** The NEXT telegraphed intent after this turn (unchanged if the fight ended). */
  readonly telegraph: EnemyAction;
  readonly status: EncounterStatus;
  /** The new encounter state to pass into the next `playTurn`. */
  readonly state: CombatState;
}

export type { Board, ClearedGroup, MoveResolution, RngState, TileColor } from '../board';
