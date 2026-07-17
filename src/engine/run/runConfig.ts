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
import { DEFAULT_FLOOR_PLAN } from './mapConfig';

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

/**
 * Fraction of the floor difficulty increment that enemy HP scales by.
 * STAGE-6 BALANCE RETUNE (spec §9): 0.2 → 0.12 (−40%, within the ±50% tuning bound). The floor
 * curve is GLOBAL (Act 2 = global floors 13–25), so this dampener bites hardest deep in Act 2 —
 * lowering it deflates the Act-2 biome tanks (base HP up to 260) enough that a skilled two-act run
 * is winnable, while Act 1 (floors 0–12) is only lightly eased. Hand-recomputed fixtures: see
 * enemyScaling.test.ts / combatIntegration.test.ts (recalibration precedent, decisions.md).
 */
export const HP_DIFFICULTY_DAMPEN = 0.12;

/**
 * Fraction of the floor difficulty increment that enemy ATTACK scales by.
 * STAGE-6 BALANCE RETUNE: 0.15 → 0.10 (−33%). This dampener also scales enemy SELF-HEAL and boss
 * attacks, so lowering it both softens the deep-Act-2 attack ramp AND weakens the Rotwood/Sunken
 * healers (a biome-fairness lever that happens to help the grindiest biomes most). Hand-recomputed.
 */
export const ATTACK_DIFFICULTY_DAMPEN = 0.10;

/** Elite HP multiplier (on top of the dampened floor scalar). STAGE-6: 1.3 → 1.15 (−12%, ±30% bound). */
export const ELITE_HP_MULT = 1.15;

/** Elite attack multiplier (on top of the dampened floor scalar). STAGE-6: 1.2 → 1.1 (−8%). */
export const ELITE_ATTACK_MULT = 1.1;

// ── Boss (the terminal node) ──────────────────────────────────────────────────────────

/** The boss's base HP before the ramp scalar (feature: "~120 HP ramp-scaled"). */
export const BOSS_BASE_HP = 120;

/**
 * Fraction of the boss-floor difficulty increment the boss HP ramps by (dampened, beatable).
 * STAGE-6 BALANCE RETUNE: 0.3 → 0.22 (−27%, within ±50%). Deflates BOTH bosses' scaled HP — most
 * of all the Act-2 biome boss at global floor 25 (base 150) — so the terminal fight is a climax,
 * not a wall. Act-1 Bone Colossus (base 120, floor 12) is only lightly eased. Hand-recomputed pins.
 */
export const BOSS_HP_DAMPEN = 0.22;

/**
 * The boss's nominal combat id. The boss reuses 'skeleton' as its engine identity (it is the
 * bone colossus — thematically apt, see feature Open Question) with its real scaled multi-phase
 * stats supplied via the `CombatState.enemy` override; the id is never consulted while the
 * override is present.
 */
export const BOSS_NOMINAL_ENEMY_ID: EnemyId = 'skeleton';

/** Human-readable boss name (UI/telemetry; the pure engine does not depend on it). */
export const BOSS_NAME = 'Bone Colossus';

// ── Two acts (Stage-6 wave 1c) ──────────────────────────────────────────────────────────
//
// A run is now TWO acts: Act 1 is the default dungeon (13-floor map, Bone Colossus); Act 2 is a
// second 13-floor map in a seeded Act-2 biome, whose difficulty CONTINUES the curve. An Act-2 node
// at local floor `f` scales as GLOBAL floor `f + ACT_FLOOR_SPAN` (spec-systems.md §1: "floors 13–25
// equivalent scaling"), so `difficultyAt` and every per-node seed key use the global floor.

/** Floors per act (the default map's floor count). Act 2's global-floor offset is one full span. */
export const ACT_FLOOR_SPAN = DEFAULT_FLOOR_PLAN.length; // 13 (floors 0–12; boss at 12)

/** The global-floor offset added to an Act-`act` local floor: Act 1 → 0, Act 2 → 13 (floors 13–25). */
export function actFloorOffset(act: number): number {
  return (Math.max(1, act) - 1) * ACT_FLOOR_SPAN;
}

/**
 * Act-transition heal: on beating the Act-1 boss the player heals this FRACTION of max HP (rounded,
 * capped at max), mirroring the rest-node "heal BY a fraction of max" convention. Sim-tunable.
 * STAGE-6 BALANCE RETUNE: 0.5 → 0.75 (within the 0.3–0.8 bound). An Act-2-ONLY lever (never touches
 * Act 1) — a bigger heal into the harder second act lets the run arrive at the biome map with a real
 * HP buffer, lifting the two-act win rate without easing Act-1 jeopardy.
 */
export const ACT_TRANSITION_HEAL_FRACTION = 0.75;

/**
 * The nominal narrow `CombatState.enemyId` for an Act-2 biome fight/elite. Biome enemies (a wider
 * `BiomeEnemyId` union) reach combat through the `CombatState.enemy` override — exactly like the
 * boss's `BOSS_NOMINAL_ENEMY_ID` — so the narrow `enemyId` stays one of the three base ids and the
 * UI's 3-key glyph tables never grow. Combat reads the override, never this id; it is a placeholder.
 */
export const ACT2_NOMINAL_ENEMY_ID: EnemyId = 'slime';
