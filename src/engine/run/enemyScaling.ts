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
import { getEnemy } from '../combat';
import type { Enemy, EnemyAction, EnemyId } from '../combat';
import { difficultyAt } from './mapGen';
import type { MapConfig } from './mapConfig';
import { ATTACK_DIFFICULTY_DAMPEN, ELITE_ATTACK_MULT, ELITE_HP_MULT, ENCOUNTER_POOL, HP_DIFFICULTY_DAMPEN } from './runConfig';

/** Scale one intent action's value by `atkMult` (charge stays 0 — it deals nothing). */
function scaleAction(action: EnemyAction, atkMult: number): EnemyAction {
  if (action.type === 'charge') return action;
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
