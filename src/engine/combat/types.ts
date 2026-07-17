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

/** The three Stage-2 (default-biome / "dungeon") enemies, addressed by a stable serializable id. */
export type EnemyId = 'slime' | 'skeleton' | 'bat';

/**
 * The 16 Stage-6 biome-exclusive enemies (4 per Act-2 biome). Kept in a SEPARATE union
 * from `EnemyId` on purpose: `EnemyId` still drives `CombatState.enemyId`, the encounter
 * pool, and the UI's `Record<EnemyId, …>` glyph/tint tables (which must stay 3-key), while
 * biome enemies reach combat as pre-built `Enemy` data through the `CombatState.enemy`
 * override seam — exactly like the boss. See content-biomes.md.
 */
export type BiomeEnemyId =
  // Glacial Crypt
  | 'permafrost-warden'
  | 'frostbite-wisp'
  | 'hoarfrost-cantor'
  | 'icebound-revenant'
  // Emberworks
  | 'slagback-brute'
  | 'cinder-imp'
  | 'forge-tender'
  | 'furnace-wisp'
  // Rotwood
  | 'mirebark-hulk'
  | 'rotgrub-swarm'
  | 'mendcap-colony'
  | 'deathcap-herald'
  // Sunken Catacombs
  | 'drowned-warden'
  | 'grasping-drowned'
  | 'lantern-medusa'
  | 'corpsefire-wisp';

/** The five bosses (one per biome; Bone Colossus = the default dungeon). */
export type BossId =
  | 'bone-colossus'
  | 'rimeheart'
  | 'forgeheart'
  | 'the-rotmother'
  | 'drowned-sovereign';

/**
 * Any identity an `Enemy` DATA object may carry — base, biome, or a boss phase. This is the
 * type of `Enemy.id` (widened from `EnemyId`). It is DELIBERATELY wider than `EnemyId`: only
 * `Enemy.id` widens; `CombatState.enemyId` stays the narrow `EnemyId`, so no `Record<EnemyId>`
 * table has to grow. No consumer reads `Enemy.id` where an `EnemyId` is required.
 */
export type AnyEnemyId = EnemyId | BiomeEnemyId | BossId;

/** The five biomes (Act 1 = `dungeon`; Act 2 = one of the four Stage-6 biomes). */
export type BiomeId =
  | 'dungeon'
  | 'glacial-crypt'
  | 'emberworks'
  | 'rotwood'
  | 'sunken-catacombs';

/**
 * What an enemy can do on its turn. A deliberately small, EXTENSIBLE union: a new verb is
 * added by extending `type` and adding one handler branch in `applyEnemyAction` — the switch
 * is EXHAUSTIVE, so a new verb is a COMPILE error everywhere it is switched until handled.
 * - `attack`: deal `value` damage to the player.
 * - `charge`: a telegraphed wind-up; `value` is 0 (does nothing this turn, but the
 *   NEXT telegraph is the big hit the player now sees coming).
 * - `heal`:   the enemy heals ITSELF by `value` (capped at its max HP).
 * Stage-6 biome verbs (content-biomes.md — one per biome):
 * - `frostArmor` (Glacial Crypt): raise a persistent shield (`enemyShield`) that absorbs
 *   player damage before HP and does NOT passively regenerate; `value` = shield raised (max).
 * - `armor` (Emberworks): plate for ONE hit — dampen the player's NEXT strike by `value`
 *   (post-affinity), then clear. Stored in `enemyArmor`.
 * - `spore` (Rotwood): add `value` rot stacks to the player (`rotStacks`), a self-decaying DoT.
 * - `curse` (Sunken Catacombs): 0 direct damage — set the player's `curseTurns` to `value`,
 *   halving their move heals while active.
 */
export type EnemyActionType = 'attack' | 'charge' | 'heal' | 'frostArmor' | 'armor' | 'spore' | 'curse';

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
  readonly id: AnyEnemyId;
  readonly maxHp: number;
  readonly affinity: AffinityTable;
  /** Cyclic intent script; the enemy walks it in order and wraps at the end. */
  readonly script: readonly EnemyAction[];
  /** Which biome this enemy belongs to (content tag). Absent on ad-hoc scaled/boss-phase data. */
  readonly biome?: BiomeId;
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
  /**
   * OPTIONAL Stage-3 run-layer enemy override (the flagged seam — mirrors the CombatModifiers
   * seam's optional discipline). When present it SUPERSEDES the registry lookup of `enemyId`
   * for this encounter: the run layer supplies difficulty-scaled fights, elites, and the
   * multi-phase boss (whose affinity table + intent script change per phase) as plain `Enemy`
   * data. When ABSENT (all Stage-2 combat + the combat sim), behavior is byte-identical to the
   * registry-driven engine — `enemyId` alone decides the enemy. Plain data, so it serializes
   * with the rest of CombatState and survives save/load.
   */
  readonly enemy?: Enemy;
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

  // ── Stage-6 biome channels (all OPTIONAL; an ABSENT field ⇒ 0 ⇒ byte-identical to the
  //    Stage-2 engine, so every default-biome / boss fight is unaffected). content-biomes.md. ──

  /**
   * Glacial Crypt (`frostArmor`). A persistent enemy shield that absorbs player damage BEFORE
   * HP and does NOT passively regenerate: player damage subtracts from it first, remainder
   * carries to `enemyHp`. Raised by `frostArmor` (via max); depleted only by being shattered.
   */
  readonly enemyShield?: number;
  /**
   * Emberworks (`armor`). A ONE-SHOT dampener on the player's NEXT strike: set by `armor`,
   * subtracted from the next move's post-affinity damage (floored at 0), then cleared.
   */
  readonly enemyArmor?: number;
  /**
   * Rotwood (`spore`). Rot stacks on the PLAYER: at each player-turn-start they deal
   * `rotStacks` damage on their own channel (bypassing defensive relics), then decay by 1.
   */
  readonly rotStacks?: number;
  /**
   * Sunken Catacombs (`curse`). Turns remaining of heal-halving on the PLAYER: while > 0 the
   * player's move heal is halved; decrements by 1 at the end of each resolved player turn.
   */
  readonly curseTurns?: number;
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
  /** Rounded total damage the move rolled (overkill retained; not floored). RAW — pre-mitigation. */
  readonly damage: number;
  /** Rounded total heal the move rolled (pre-cap; actual gain = HP delta). RAW — pre-curse. */
  readonly heal: number;
  /**
   * The damage that actually reached enemy HP this move, AFTER Emberworks armor + the Glacial shield
   * absorbed their share (`= damage − armorAbsorbed − shieldAbsorbed`; overkill retained). Equals
   * `damage` in any fight with no armor/shield channel active, so the UI can always show "what landed".
   * Stage-6 biome telegraph-parity (review H1): the shown numbers must equal the applied ones.
   */
  readonly effectiveDamage: number;
  /**
   * The heal actually applied this move, AFTER a Sunken-Catacombs curse halved it (`= round(heal/2)`
   * while cursed, else `heal`). Equals `heal` in any fight with no active curse.
   */
  readonly effectiveHeal: number;
  /** HP the Glacial shield absorbed from this move (0 when no shield was up). */
  readonly shieldAbsorbed: number;
  /** HP the Emberworks one-shot armor softened from this move (0 when no armor was up). */
  readonly armorAbsorbed: number;
  /** What the enemy did this turn; `null` when the enemy died and never acted. */
  readonly enemyAction: EnemyAction | null;
  /**
   * Rot (Rotwood) damage dealt to the player at THIS turn's start, on its own channel — the
   * rolled DoT (overkill retained, like `damage`). 0 whenever the player carries no rot, so
   * every non-Rotwood fight reports 0. content-biomes.md.
   */
  readonly rotTick: number;
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
