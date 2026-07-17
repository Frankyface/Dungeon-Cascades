/**
 * Difficulty-scaled enemy instances for the run layer. Fights and elites reuse the three
 * base enemies (combat registry) but scale their HP and intent-script values by the floor
 * difficulty curve; elites additionally multiply both. The scaled enemy is plain `Enemy`
 * data, fed to combat through the `CombatState.enemy` override seam — combat itself is never
 * edited for scaling.
 *
 * ELITE / DIFFICULTY FORMULA (docs/decisions.md "enemy-stat scalar per floor depth"):
 *   diff    = difficultyAt(floor) = 1 + 0.15·floor            (mapConfig)
 *   hpMult  = diff · (elite ? ELITE_HP_MULT : 1)
 *   atkMult = (1 + (diff − 1)·ATTACK_DIFFICULTY_DAMPEN) · (elite ? ELITE_ATTACK_MULT : 1)
 *   maxHp'  = round(base.maxHp · hpMult)
 *   value'  = round(actionValue · atkMult)   for attack/heal actions; charge (0) stays 0
 * HP scales at the full floor rate, attack at a dampened rate (deep fights get tankier faster
 * than deadlier). Every constant lives in runConfig.ts (sim-tunable).
 *
 * PURE ENGINE: no React / React Native imports; deterministic; never mutates input.
 */
import { nextInt } from '../board';
import type { RngState } from '../board';
import { getBiomeEnemy, getEnemy } from '../combat';
import type { BiomeEnemyId, BiomeId, Enemy, EnemyAction, EnemyId } from '../combat';
import { difficultyAt } from './mapGen';
import type { MapConfig } from './mapConfig';
import { getBiome } from './biomes';
import { ATTACK_DIFFICULTY_DAMPEN, ELITE_ATTACK_MULT, ELITE_HP_MULT, ENCOUNTER_POOL, HP_DIFFICULTY_DAMPEN } from './runConfig';

/**
 * Scale one intent action's value by `atkMult`. NON-scaling verbs (returned untouched):
 * - `charge` — value is 0 (deals nothing),
 * - `curse` — value is a TURN COUNT; scaling would inflate its heal-denial duration at deep floors
 *   (content-biomes.md, Sunken Catacombs boss-scaling guard),
 * - `spore` — value is a STACK COUNT; "stacks are stacks" — scaling would inflate the DoT length,
 *   and content-biomes.md gives no fight-scaler rule to the contrary.
 * `attack` / `heal` / `frostArmor` / `armor` are AMOUNTS and scale like `attack`.
 */
function scaleAction(action: EnemyAction, atkMult: number): EnemyAction {
  if (action.type === 'charge' || action.type === 'curse' || action.type === 'spore') return action;
  return { type: action.type, value: Math.round(action.value * atkMult) };
}

/**
 * Scale a base enemy for a fight at difficulty `diff` (= difficultyAt(floor)). `isElite`
 * applies the elite multipliers on top. Returns a new `Enemy`; never mutates the input.
 */
export function scaleEnemy(base: Enemy, diff: number, isElite: boolean): Enemy {
  const hpMult = (1 + (diff - 1) * HP_DIFFICULTY_DAMPEN) * (isElite ? ELITE_HP_MULT : 1);
  const atkMult = (1 + (diff - 1) * ATTACK_DIFFICULTY_DAMPEN) * (isElite ? ELITE_ATTACK_MULT : 1);
  return {
    id: base.id,
    maxHp: Math.round(base.maxHp * hpMult),
    affinity: base.affinity,
    script: base.script.map((a) => scaleAction(a, atkMult)),
  };
}

/** The difficulty-scaled enemy for a fight/elite at `floor` drawing base id `enemyId`. */
export function scaledEnemyFor(
  enemyId: EnemyId,
  floor: number,
  isElite: boolean,
  config?: MapConfig,
): Enemy {
  const diff = config === undefined ? difficultyAt(floor) : difficultyAt(floor, config);
  return scaleEnemy(getEnemy(enemyId), diff, isElite);
}

/** Seeded uniform pick of a base enemy from the encounter pool. Deterministic; threads RNG. */
export function selectEnemy(rngState: RngState): { enemyId: EnemyId; rngState: RngState } {
  const pick = nextInt(rngState, ENCOUNTER_POOL.length);
  return { enemyId: ENCOUNTER_POOL[pick.value], rngState: pick.state };
}

/**
 * Seeded uniform pick of a biome-exclusive enemy from an Act-2 biome's four-enemy kit. Deterministic;
 * threads RNG. The picked id is a `BiomeEnemyId` (the biome kits never list base ids for Act-2 biomes).
 */
export function selectBiomeEnemy(
  rngState: RngState,
  biomeId: BiomeId,
): { enemyId: BiomeEnemyId; rngState: RngState } {
  const ids = getBiome(biomeId).enemyIds;
  const pick = nextInt(rngState, ids.length);
  return { enemyId: ids[pick.value] as BiomeEnemyId, rngState: pick.state };
}

/**
 * The difficulty-scaled enemy for an Act-2 fight/elite at (global) `floor` drawing biome enemy
 * `enemyId`. Reuses the SAME `scaleEnemy` machinery as base enemies (so the curse/spore no-scale
 * guards apply), and re-attaches the biome tag the scaled shape otherwise drops (for UI/compendium).
 */
export function scaledBiomeEnemyFor(
  enemyId: BiomeEnemyId,
  floor: number,
  isElite: boolean,
  config?: MapConfig,
): Enemy {
  const base = getBiomeEnemy(enemyId);
  const diff = config === undefined ? difficultyAt(floor) : difficultyAt(floor, config);
  const scaled = scaleEnemy(base, diff, isElite);
  return base.biome === undefined ? scaled : { ...scaled, biome: base.biome };
}
