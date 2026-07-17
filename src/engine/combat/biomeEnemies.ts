/**
 * The 16 Stage-6 biome-exclusive enemies as pure data — the same ENEMY_STATS shape as the
 * three base enemies, one 4-enemy kit per Act-2 biome (content-biomes.md, post-audit revision).
 *
 * These reach combat through the `CombatState.enemy` override seam (like the boss), NOT through
 * `CombatState.enemyId`: `EnemyId` stays the narrow three-enemy union so the UI's per-enemy
 * glyph/tint tables stay 3-key. Numbers here are TRANSCRIBED VERBATIM from content-biomes.md
 * (the fidelity tests in biomeEnemies.test.ts are the transcription check) — never invented or
 * adjusted. Affinity tables omit any color at normal (×1.0), matching the base-enemy convention;
 * an absent color resolves to normal via `affinityMultiplier`.
 *
 * PURE ENGINE: no React / React Native imports; deterministic; never mutates input.
 */
import { AFFINITY_IMMUNE, AFFINITY_RESIST, AFFINITY_WEAK } from './config';
import type { EnemyStats } from './config';
import { affinityMultiplier } from './effects';
import type { BiomeEnemyId, Enemy, TileColor } from './types';

/** All biome-enemy ids in a stable, biome-grouped order (Glacial → Ember → Rot → Sunken). */
export const BIOME_ENEMY_IDS: readonly BiomeEnemyId[] = [
  'permafrost-warden',
  'frostbite-wisp',
  'hoarfrost-cantor',
  'icebound-revenant',
  'slagback-brute',
  'cinder-imp',
  'forge-tender',
  'furnace-wisp',
  'mirebark-hulk',
  'rotgrub-swarm',
  'mendcap-colony',
  'deathcap-herald',
  'drowned-warden',
  'grasping-drowned',
  'lantern-medusa',
  'corpsefire-wisp',
];

/**
 * The tunable stat block for every biome enemy (content-biomes.md §1–4). One entry per id; the
 * `biome` tag places it in its Act-2 kit. `charge` carries value 0 by convention.
 */
export const BIOME_ENEMY_STATS: Record<BiomeEnemyId, EnemyStats> = {
  // ── 1. The Glacial Crypt (Blue-shatter shield-break puzzle) ────────────────────────────
  'permafrost-warden': {
    maxHp: 220,
    affinity: { R: AFFINITY_RESIST, B: AFFINITY_WEAK },
    script: [
      { type: 'attack', value: 10 },
      { type: 'attack', value: 10 },
      { type: 'frostArmor', value: 14 },
    ],
    biome: 'glacial-crypt',
  },
  'frostbite-wisp': {
    maxHp: 45,
    affinity: { B: AFFINITY_RESIST, Y: AFFINITY_WEAK },
    script: [
      { type: 'frostArmor', value: 5 },
      { type: 'attack', value: 6 },
      { type: 'attack', value: 8 },
    ],
    biome: 'glacial-crypt',
  },
  'hoarfrost-cantor': {
    maxHp: 140,
    affinity: { R: AFFINITY_WEAK, Y: AFFINITY_RESIST },
    script: [
      { type: 'attack', value: 6 },
      { type: 'attack', value: 6 },
      { type: 'heal', value: 12 },
    ],
    biome: 'glacial-crypt',
  },
  'icebound-revenant': {
    maxHp: 80,
    affinity: { G: AFFINITY_WEAK, B: AFFINITY_RESIST },
    script: [
      { type: 'frostArmor', value: 14 },
      { type: 'charge', value: 0 },
      { type: 'attack', value: 18 },
    ],
    biome: 'glacial-crypt',
  },

  // ── 2. The Emberworks (Blue-quench + armor plating) ────────────────────────────────────
  'slagback-brute': {
    maxHp: 260,
    affinity: { R: AFFINITY_IMMUNE, B: AFFINITY_WEAK, Y: AFFINITY_RESIST },
    script: [
      { type: 'attack', value: 8 },
      { type: 'armor', value: 12 },
      { type: 'attack', value: 8 },
    ],
    biome: 'emberworks',
  },
  'cinder-imp': {
    maxHp: 55,
    affinity: { R: AFFINITY_RESIST, Y: AFFINITY_WEAK },
    script: [
      { type: 'attack', value: 5 },
      { type: 'attack', value: 8 },
    ],
    biome: 'emberworks',
  },
  'forge-tender': {
    maxHp: 130,
    affinity: { R: AFFINITY_RESIST, G: AFFINITY_WEAK },
    script: [
      { type: 'attack', value: 6 },
      { type: 'heal', value: 12 },
      { type: 'attack', value: 10 },
    ],
    biome: 'emberworks',
  },
  'furnace-wisp': {
    maxHp: 70,
    affinity: { R: AFFINITY_RESIST, B: AFFINITY_WEAK, Y: AFFINITY_RESIST },
    script: [
      { type: 'attack', value: 4 },
      { type: 'attack', value: 8 },
      { type: 'attack', value: 12 },
      { type: 'attack', value: 16 },
      { type: 'attack', value: 20 },
    ],
    biome: 'emberworks',
  },

  // ── 3. The Rotwood (Green-trap DoT + regen) ────────────────────────────────────────────
  'mirebark-hulk': {
    maxHp: 260,
    affinity: { R: AFFINITY_WEAK, G: AFFINITY_RESIST },
    script: [
      { type: 'attack', value: 12 },
      { type: 'attack', value: 12 },
      { type: 'heal', value: 8 },
    ],
    biome: 'rotwood',
  },
  'rotgrub-swarm': {
    maxHp: 55,
    affinity: { B: AFFINITY_RESIST, Y: AFFINITY_WEAK },
    script: [
      { type: 'attack', value: 5 },
      { type: 'attack', value: 5 },
      { type: 'spore', value: 2 },
    ],
    biome: 'rotwood',
  },
  'mendcap-colony': {
    maxHp: 140,
    affinity: { G: AFFINITY_RESIST, B: AFFINITY_WEAK },
    script: [
      { type: 'heal', value: 12 },
      { type: 'attack', value: 6 },
      { type: 'heal', value: 10 },
      { type: 'attack', value: 6 },
    ],
    biome: 'rotwood',
  },
  'deathcap-herald': {
    maxHp: 45,
    affinity: { G: AFFINITY_WEAK, Y: AFFINITY_RESIST },
    script: [
      { type: 'charge', value: 0 },
      { type: 'attack', value: 20 },
      { type: 'spore', value: 3 },
    ],
    biome: 'rotwood',
  },

  // ── 4. The Sunken Catacombs (Blue-trap curse + heal-denial) ────────────────────────────
  'drowned-warden': {
    maxHp: 260,
    affinity: { B: AFFINITY_RESIST, Y: AFFINITY_WEAK },
    script: [
      { type: 'attack', value: 7 },
      { type: 'attack', value: 7 },
      { type: 'heal', value: 8 },
    ],
    biome: 'sunken-catacombs',
  },
  'grasping-drowned': {
    maxHp: 65,
    affinity: { R: AFFINITY_WEAK },
    script: [
      { type: 'attack', value: 6 },
      { type: 'attack', value: 11 },
    ],
    biome: 'sunken-catacombs',
  },
  'lantern-medusa': {
    maxHp: 120,
    affinity: { G: AFFINITY_WEAK, B: AFFINITY_RESIST },
    script: [
      { type: 'attack', value: 6 },
      { type: 'heal', value: 10 },
      { type: 'curse', value: 2 },
    ],
    biome: 'sunken-catacombs',
  },
  'corpsefire-wisp': {
    maxHp: 45,
    affinity: { B: AFFINITY_IMMUNE, Y: AFFINITY_WEAK },
    script: [{ type: 'attack', value: 13 }],
    biome: 'sunken-catacombs',
  },
};

/** The typed biome-enemy registry, built from the tunable `BIOME_ENEMY_STATS` table. */
const BIOME_REGISTRY: Record<BiomeEnemyId, Enemy> = Object.fromEntries(
  BIOME_ENEMY_IDS.map((id) => [id, { id, ...BIOME_ENEMY_STATS[id] }]),
) as Record<BiomeEnemyId, Enemy>;

/**
 * Fetch a biome enemy definition by id. Throws on an unknown id — boundary validation so a bad
 * id fails fast rather than producing a silently-broken encounter (mirrors `getEnemy`).
 */
export function getBiomeEnemy(id: BiomeEnemyId): Enemy {
  const enemy = BIOME_REGISTRY[id];
  if (enemy === undefined) {
    throw new Error(`getBiomeEnemy: unknown biome enemy id '${id}'`);
  }
  return enemy;
}

/** This biome enemy's affinity multiplier against a damage color (normal 1.0 if unlisted). */
export function biomeAffinityFor(enemy: Enemy, color: TileColor): number {
  return affinityMultiplier(enemy.affinity, color);
}
