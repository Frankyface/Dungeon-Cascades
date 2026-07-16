/**
 * Run-lifecycle configuration — ALL tunable constants of the Stage-3 run wrapper (enemy
 * difficulty scaling, elite multipliers, the boss, the encounter pool, starting HP) in one
 * module, so re-balancing jeopardy is a single-file change. Every value is sim-tunable; the
 * run engine reads these — it never hardcodes them.
 *
 * PURE ENGINE: no React / React Native imports; no wall-clock or ambient randomness.
 */
import { PLAYER_MAX_HP } from '../combat';
import type { EnemyId } from '../combat';

/** The three base enemies a fight/elite node draws from (single-enemy fights, v1). */
export const ENCOUNTER_POOL: readonly EnemyId[] = ['slime', 'skeleton', 'bat'];

/** Player starting / max HP (persists across nodes). Mirrors combat's PLAYER_MAX_HP. */
export const RUN_PLAYER_MAX_HP = PLAYER_MAX_HP;

// ── Difficulty scaling (enemy-stat scalar per floor depth; elite formula) ─────────────
//
// For a fight at floor f with difficultyAt(f) = 1 + 0.15·f (mapConfig):
//   hpMult  = (1 + (difficultyAt(f) − 1)·HP_DIFFICULTY_DAMPEN)  · (elite ? ELITE_HP_MULT  : 1)
//   atkMult = (1 + (difficultyAt(f) − 1)·ATTACK_DIFFICULTY_DAMPEN) · (elite ? ELITE_ATTACK_MULT : 1)
// BOTH HP and attack scale at DAMPENED rates off the floor curve. Key balance reason: the
// player has 60 HP, no innate defense, and a full run is ~9 fights with sparse healing, so a
// LONG fight (high enemy HP) is itself lethal (more incoming hits). Un-dampened HP scaling
// ballooned deep/elite enemies to 200–300 HP — unwinnable. These dampeners keep fights short
// enough to survive; the full-run sim (next agent) tunes them to the 25–75 % win band.

/** Fraction of the floor difficulty increment that enemy HP scales by. */
export const HP_DIFFICULTY_DAMPEN = 0.2;

/** Fraction of the floor difficulty increment that enemy ATTACK scales by. */
export const ATTACK_DIFFICULTY_DAMPEN = 0.15;

/** Elite HP multiplier (on top of the dampened floor scalar). */
export const ELITE_HP_MULT = 1.3;

/** Elite attack multiplier (on top of the dampened floor scalar). */
export const ELITE_ATTACK_MULT = 1.2;

// ── Boss (the terminal node) ──────────────────────────────────────────────────────────

/** The boss's base HP before the ramp scalar (feature: "~120 HP ramp-scaled"). */
export const BOSS_BASE_HP = 120;

/** Fraction of the boss-floor difficulty increment the boss HP ramps by (dampened, beatable). */
export const BOSS_HP_DAMPEN = 0.3;

/**
 * The boss's nominal combat id. The boss reuses 'skeleton' as its engine identity (it is the
 * bone colossus — thematically apt, see feature Open Question) with its real scaled multi-phase
 * stats supplied via the `CombatState.enemy` override; the id is never consulted while the
 * override is present.
 */
export const BOSS_NOMINAL_ENEMY_ID: EnemyId = 'skeleton';

/** Human-readable boss name (UI/telemetry; the pure engine does not depend on it). */
export const BOSS_NAME = 'Bone Colossus';
