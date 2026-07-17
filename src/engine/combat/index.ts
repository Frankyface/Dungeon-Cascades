/**
 * Public API of the Dungeon Cascades combat engine (Stage 2).
 *
 * Consumers: the headless combat sim and the Skia combat UI. Everything exported
 * here is pure, deterministic, and serializable — no React / React Native imports,
 * no ambient time or randomness (the board engine's seeded refill stream is the
 * only entropy, threaded explicitly). Combat sits ON TOP of the board engine and
 * never modifies it.
 */

// Serializable data model.
export type {
  AffinityTable,
  AnyEnemyId,
  BiomeEnemyId,
  BiomeId,
  BossId,
  CombatEffects,
  CombatState,
  EffectKind,
  Enemy,
  EnemyAction,
  EnemyActionType,
  EnemyId,
  EncounterStatus,
  GroupEffect,
  TurnResolution,
} from './types';

// Tunable constants (the single tuning surface; sim may tune within ±50%).
export {
  ATTACK_BASE,
  HEAL_BASE,
  GROUP_SIZE_BONUS,
  CASCADE_BONUS,
  PLAYER_MAX_HP,
  AFFINITY_WEAK,
  AFFINITY_NORMAL,
  AFFINITY_RESIST,
  AFFINITY_IMMUNE,
  DEFAULT_COMBAT_CONFIG,
  ENEMY_STATS,
} from './config';
export type { CombatConfig, EnemyStats } from './config';

// Data-driven tile-effect table + pure combat math.
export { TILE_EFFECTS, affinityMultiplier, computeEffects } from './effects';

// Optional relic-hook seam (Stage 3 integration; identity when unused).
export type { CombatModifiers } from './modifiers';

// Enemy registry + intent/affinity helpers.
export {
  ENEMY_IDS,
  getEnemy,
  affinityFor,
  scriptStep,
  nextIntentIndex,
  initialTelegraph,
} from './enemies';

// Stage-6 biome-enemy registry (16 enemies; reach combat via the `enemy` override seam).
export { BIOME_ENEMY_IDS, BIOME_ENEMY_STATS, getBiomeEnemy, biomeAffinityFor } from './biomeEnemies';

// Encounter state machine.
export { startEncounter, playTurn } from './encounter';
