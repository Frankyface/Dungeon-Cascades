/**
 * The three Stage-2 enemies as pure data, plus the intent/affinity helpers the
 * encounter state machine consumes.
 *
 * The tunable NUMBERS (HP, affinity spreads, intent-script values) live in
 * config.ts's `ENEMY_STATS` table — the single tuning surface. This module composes
 * them into the typed `Enemy` registry and exposes pure lookups: affinity
 * resolution and the deterministic cyclic intent walk. Enemies carry NO unseeded
 * randomness — with static affinity tables every enemy behavior is fully
 * deterministic (feature-enemy-encounters.md).
 *
 * PURE ENGINE: no React / React Native imports; deterministic; never mutates input.
 */
import { affinityMultiplier } from './effects';
import { ENEMY_STATS } from './config';
import type { Enemy, EnemyAction, EnemyId, TileColor } from './types';

/** All enemy ids (stable order for iteration / registries). */
export const ENEMY_IDS: readonly EnemyId[] = ['slime', 'skeleton', 'bat'];

/** The typed enemy registry, built from the tunable `ENEMY_STATS` table. */
const REGISTRY: Record<EnemyId, Enemy> = {
  slime: { id: 'slime', ...ENEMY_STATS.slime },
  skeleton: { id: 'skeleton', ...ENEMY_STATS.skeleton },
  bat: { id: 'bat', ...ENEMY_STATS.bat },
};

/**
 * Fetch an enemy definition by id. Throws on an unknown id — boundary validation so
 * a bad id fails fast rather than producing a silently-broken encounter.
 */
export function getEnemy(id: EnemyId): Enemy {
  const enemy = REGISTRY[id];
  if (enemy === undefined) {
    throw new Error(`getEnemy: unknown enemy id '${id}'`);
  }
  return enemy;
}

/** This enemy's affinity multiplier against a damage color (normal 1.0 if unlisted). */
export function affinityFor(enemy: Enemy, color: TileColor): number {
  return affinityMultiplier(enemy.affinity, color);
}

/** The action at a script index, wrapping cyclically (scripts loop forever). */
export function scriptStep(enemy: Enemy, index: number): EnemyAction {
  return enemy.script[index % enemy.script.length];
}

/** The next cyclic script index after `index`. */
export function nextIntentIndex(enemy: Enemy, index: number): number {
  return (index + 1) % enemy.script.length;
}

/** The first telegraphed action of a fresh encounter (script entry 0). */
export function initialTelegraph(enemy: Enemy): EnemyAction {
  return scriptStep(enemy, 0);
}
