/**
 * The biome registry (Stage-6 content): id, display name, theme line, the four exclusive enemy
 * ids, the boss id, and the palette DIRECTION text. Palette HEX values are set at art time — the
 * Stage-6 revision covered mechanics/distinctiveness, not art direction — so this stores the
 * verbatim direction strings from content-biomes.md's palette table to drive the eventual swatch
 * choice. `dungeon` is the default Act-1 biome (base enemies + Bone Colossus); the four others are
 * the Act-2 biomes. Content is TRANSCRIBED from content-biomes.md / spec-systems.md §1.
 *
 * PURE ENGINE: no React / React Native imports; deterministic; never mutates input.
 */
import type { BiomeEnemyId, BiomeId, BossId, EnemyId } from '../combat';
import { BIOME_ENEMY_STATS, ENEMY_STATS } from '../combat';
import { BOSS_REGISTRY } from './biomeBosses';

/** One biome's content record. `paletteDirection` is design DIRECTION text, not a hex set. */
export interface Biome {
  readonly id: BiomeId;
  readonly name: string;
  /** A one-line theme statement (from the biome's content-biomes.md theme text). */
  readonly theme: string;
  /** The biome's exclusive enemy kit (the base three for `dungeon`; four biome enemies otherwise). */
  readonly enemyIds: readonly (EnemyId | BiomeEnemyId)[];
  readonly bossId: BossId;
  /** Verbatim palette DIRECTION from content-biomes.md (hexes chosen at art time). */
  readonly paletteDirection: string;
}

/**
 * All five biomes. The four Act-2 palette directions are verbatim from content-biomes.md's palette
 * table; `dungeon` has no Stage-6 art-direction entry (it is the base game's biome), so its palette
 * direction is a factual note, not spec-derived text.
 */
export const BIOMES: Record<BiomeId, Biome> = {
  dungeon: {
    id: 'dungeon',
    name: 'The Dungeon',
    theme: 'The default Act-1 dungeon: slimes, skeletons, and bats guarding the Bone Colossus.',
    enemyIds: ['slime', 'skeleton', 'bat'],
    bossId: 'bone-colossus',
    paletteDirection: 'Base dungeon palette (carried from the base game — no Stage-6 art direction).',
  },
  'glacial-crypt': {
    id: 'glacial-crypt',
    name: 'The Glacial Crypt',
    theme:
      'A dead kingdom entombed in blue ice; shatter the frost barriers to reach the guardians, four answer colors so no single build coasts.',
    enemyIds: ['permafrost-warden', 'frostbite-wisp', 'hoarfrost-cantor', 'icebound-revenant'],
    bossId: 'rimeheart',
    paletteDirection:
      'Blue ice / brittle rime; a dead kingdom entombed in blue. Guardians answer in four colors (Blue shatter, Yellow light, Red warmth, Green thaw).',
  },
  emberworks: {
    id: 'emberworks',
    name: 'The Emberworks',
    theme:
      'A never-cooling foundry of living slag where every fight runs hotter than the last; no single color runs the biome on autopilot.',
    enemyIds: ['slagback-brute', 'cinder-imp', 'forge-tender', 'furnace-wisp'],
    bossId: 'forgeheart',
    paletteDirection: 'Never-cooling foundry — living slag, molten red/orange, ash-grey wraps.',
  },
  rotwood: {
    id: 'rotwood',
    name: 'The Rotwood',
    theme:
      'A DoT + regeneration biome where Green is a trap color and one spore/rot verb powers the whole kit.',
    enemyIds: ['mirebark-hulk', 'rotgrub-swarm', 'mendcap-colony', 'deathcap-herald'],
    bossId: 'the-rotmother',
    paletteDirection: 'Rot green + waterlogged deadwood; DoT/regen biome, Green is the trap color.',
  },
  'sunken-catacombs': {
    id: 'sunken-catacombs',
    name: 'The Sunken Catacombs',
    theme:
      'A drowned crypt of black tidewater where Blue is the trap color and the dead curse your healing.',
    enemyIds: ['drowned-warden', 'grasping-drowned', 'lantern-medusa', 'corpsefire-wisp'],
    bossId: 'drowned-sovereign',
    paletteDirection: 'Black tidewater / drowned crypt; Blue is the trap color, lantern-pale light.',
  },
};

/** All biome ids in canonical order (dungeon first, then the four Act-2 biomes). */
export const BIOME_IDS: readonly BiomeId[] = [
  'dungeon',
  'glacial-crypt',
  'emberworks',
  'rotwood',
  'sunken-catacombs',
];

/** The four Act-2 biomes (dungeon excluded), in canonical order. */
export const ACT2_BIOME_IDS: readonly BiomeId[] = [
  'glacial-crypt',
  'emberworks',
  'rotwood',
  'sunken-catacombs',
];

/** Fetch a biome by id. Throws on an unknown id — boundary validation. */
export function getBiome(id: BiomeId): Biome {
  const biome = BIOMES[id];
  if (biome === undefined) {
    throw new Error(`getBiome: unknown biome id '${id}'`);
  }
  return biome;
}

/**
 * Assert the biome registry is internally consistent with the enemy/boss registries: every biome
 * lists exactly four enemies (three for `dungeon`), each enemy id resolves to a real stat block
 * tagged with THIS biome, and the boss id matches the biome's boss (also tagged with this biome).
 * Throws with a precise message on the first inconsistency. Mirrors `assertRosterWellFormed`.
 */
export function assertBiomesWellFormed(): void {
  for (const id of BIOME_IDS) {
    const biome = BIOMES[id];
    if (biome === undefined) throw new Error(`assertBiomesWellFormed: missing biome '${id}'`);
    if (biome.id !== id) throw new Error(`assertBiomesWellFormed: '${id}' has mismatched id '${biome.id}'`);

    const expectedCount = id === 'dungeon' ? 3 : 4;
    if (biome.enemyIds.length !== expectedCount) {
      throw new Error(`assertBiomesWellFormed: '${id}' has ${biome.enemyIds.length} enemies, expected ${expectedCount}`);
    }

    for (const enemyId of biome.enemyIds) {
      const stats =
        id === 'dungeon'
          ? ENEMY_STATS[enemyId as EnemyId]
          : BIOME_ENEMY_STATS[enemyId as BiomeEnemyId];
      if (stats === undefined) throw new Error(`assertBiomesWellFormed: '${id}' enemy '${enemyId}' has no stat block`);
      if (stats.biome !== id) {
        throw new Error(`assertBiomesWellFormed: '${id}' enemy '${enemyId}' is tagged biome '${stats.biome}'`);
      }
    }

    const boss = BOSS_REGISTRY[id];
    if (boss === undefined) throw new Error(`assertBiomesWellFormed: '${id}' has no boss in BOSS_REGISTRY`);
    if (boss.id !== biome.bossId) {
      throw new Error(`assertBiomesWellFormed: '${id}' bossId '${biome.bossId}' != registry boss '${boss.id}'`);
    }
    if (boss.biome !== id) {
      throw new Error(`assertBiomesWellFormed: boss '${boss.id}' tagged biome '${boss.biome}', expected '${id}'`);
    }
  }
}
