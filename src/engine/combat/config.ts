/**
 * Combat configuration — ALL tunable constants of the Stage-2 combat layer in one
 * module, so balancing is a single-file change.
 *
 * The values are the docs/decisions.md 2026-07-15 "Combat recalibration" numbers
 * (which superseded the original "Combat math defaults" after first sim contact). The
 * combat-sim feature is the tuning instrument, bounded by that decision: ATTACK_BASE
 * 2–5, HEAL_BASE 1–3, GROUP_SIZE_BONUS / CASCADE_BONUS / PLAYER_MAX_HP unchanged,
 * enemy HP 40–300, enemy attack 4–20, enemy self-heal 4–12. Final values + the band
 * report live in the feature's Verification Log. The combat ENGINE reads these values;
 * it never hardcodes them, so a sim sweep only edits this file.
 *
 * PURE ENGINE: no React / React Native imports; no wall-clock or ambient
 * randomness. See CLAUDE.md.
 */
import type { AffinityTable, BiomeId, EnemyAction, EnemyId } from './types';

// ── Combat math scalars (decisions.md defaults) ──────────────────────────────

/** Base damage of a minimum (3-tile) damage group before size/affinity/cascade. */
export const ATTACK_BASE = 3;

/** Base heal of a minimum (3-tile) heal group before size/cascade. */
export const HEAL_BASE = 2;

/** Per-extra-tile bonus: a group's amount scales by `1 + this × (size − 3)`. */
export const GROUP_SIZE_BONUS = 0.25;

/** Per-extra-combo bonus: the move scales by `1 + this × (totalCombos − 1)`. */
export const CASCADE_BONUS = 0.25;

/** The player's starting / maximum HP. */
export const PLAYER_MAX_HP = 60;

/**
 * The combat math constants bundled as a serializable config object. Threading a
 * single object (rather than reading module constants) lets the sim run a fight
 * under a tuned config without mutating globals — mirrors the board engine's
 * "constants live in one place" convention.
 */
export interface CombatConfig {
  readonly attackBase: number;
  readonly healBase: number;
  readonly groupSizeBonus: number;
  readonly cascadeBonus: number;
  readonly playerMaxHp: number;
}

/** The default combat config (docs/decisions.md 2026-07-15). */
export const DEFAULT_COMBAT_CONFIG: CombatConfig = {
  attackBase: ATTACK_BASE,
  healBase: HEAL_BASE,
  groupSizeBonus: GROUP_SIZE_BONUS,
  cascadeBonus: CASCADE_BONUS,
  playerMaxHp: PLAYER_MAX_HP,
};

// ── Affinity tiers (documented multipliers) ──────────────────────────────────

/** Weak: takes double damage from this color. */
export const AFFINITY_WEAK = 2.0;
/** Normal: unmodified (the implicit default for any color absent from a table). */
export const AFFINITY_NORMAL = 1.0;
/** Resist: takes half damage from this color. */
export const AFFINITY_RESIST = 0.5;
/** Immune: takes no damage from this color (supported; unused by Stage-2 enemies). */
export const AFFINITY_IMMUNE = 0.0;

// ── Enemy stat data (tunable numbers for the three Stage-2 enemies) ───────────

/**
 * The tunable stat block for one enemy: max HP, its affinity spread (colors absent
 * are `normal`), and its cyclic intent script. `enemies.ts` composes these into the
 * typed `Enemy` registry and the intent/affinity helpers — this table is the single
 * tuning surface the sim edits.
 */
export interface EnemyStats {
  readonly maxHp: number;
  readonly affinity: AffinityTable;
  readonly script: readonly EnemyAction[];
  /** The biome this enemy belongs to (the three base enemies are the default `dungeon`). */
  readonly biome: BiomeId;
}

/**
 * The three Stage-2 enemies (feature-enemy-encounters.md shapes, recalibrated per the
 * docs/decisions.md 2026-07-15 "Combat recalibration" entry — HP scaled up to match
 * the retuned ATTACK_BASE 3 damage curve; affinity spreads and script SHAPES unchanged):
 * - Slime:    intro HP, weak R, no resists;  attack 8 every turn.
 * - Skeleton: mid HP, resist R, weak B;      attack 8 → charge → attack 16, cyclic.
 * - Bat:      mid HP, weak G, resist B;       attack 6 ↔ self-heal 8, alternating.
 */
export const ENEMY_STATS: Record<EnemyId, EnemyStats> = {
  slime: {
    maxHp: 80,
    affinity: { R: AFFINITY_WEAK },
    script: [{ type: 'attack', value: 8 }],
    biome: 'dungeon',
  },
  skeleton: {
    maxHp: 120,
    affinity: { R: AFFINITY_RESIST, B: AFFINITY_WEAK },
    script: [
      { type: 'attack', value: 8 },
      { type: 'charge', value: 0 },
      { type: 'attack', value: 16 },
    ],
    biome: 'dungeon',
  },
  bat: {
    maxHp: 90,
    affinity: { G: AFFINITY_WEAK, B: AFFINITY_RESIST },
    script: [
      { type: 'attack', value: 6 },
      { type: 'heal', value: 8 },
    ],
    biome: 'dungeon',
  },
};
