/**
 * Display glyph + name tables for every fightable entity — the three base enemies, the 16 biome
 * enemies, and the five bosses — so the compendium (and Boss Rush) can render any of them without
 * each screen re-deriving art. Glyphs and biome-enemy names are TRANSCRIBED VERBATIM from
 * content-biomes.md's enemy/boss tables (the base-enemy glyphs mirror the combat screen's
 * `ENEMY_GLYPH`); boss NAMES come straight from the engine's boss registry so they never drift.
 *
 * No React imports; deterministic; a pure lookup.
 */
import { BIOME_ENEMY_IDS, ENEMY_IDS, getBiomeEnemy, getEnemy } from '../../engine/combat';
import type { BiomeEnemyId, BiomeId, BossId, Enemy, EnemyId } from '../../engine/combat';
import { BOSS_REGISTRY } from '../../engine/run';
import { ENEMY_GLYPH, enemyName as baseEnemyName } from '../combat/combatFormat';

/** Glyph per biome-exclusive enemy (content-biomes.md §1–4 enemy tables). */
const BIOME_ENEMY_GLYPH: Readonly<Record<BiomeEnemyId, string>> = {
  // Glacial Crypt
  'permafrost-warden': '🗿',
  'frostbite-wisp': '❄️',
  'hoarfrost-cantor': '🕯️',
  'icebound-revenant': '🧊',
  // Emberworks
  'slagback-brute': '🗿',
  'cinder-imp': '👺',
  'forge-tender': '⚒️',
  'furnace-wisp': '🔥',
  // Rotwood
  'mirebark-hulk': '🪵',
  'rotgrub-swarm': '🐛',
  'mendcap-colony': '🍄',
  'deathcap-herald': '💀',
  // Sunken Catacombs
  'drowned-warden': '🧟',
  'grasping-drowned': '🦑',
  'lantern-medusa': '🪼',
  'corpsefire-wisp': '🕯️',
};

/** Display name per biome-exclusive enemy (content-biomes.md enemy-table headers, verbatim). */
const BIOME_ENEMY_NAME: Readonly<Record<BiomeEnemyId, string>> = {
  'permafrost-warden': 'Permafrost Warden',
  'frostbite-wisp': 'Frostbite Wisp',
  'hoarfrost-cantor': 'Hoarfrost Cantor',
  'icebound-revenant': 'Icebound Revenant',
  'slagback-brute': 'Slagback Brute',
  'cinder-imp': 'Cinder Imp',
  'forge-tender': 'Forge-Tender',
  'furnace-wisp': 'Furnace Wisp',
  'mirebark-hulk': 'Mirebark Hulk',
  'rotgrub-swarm': 'Rotgrub Swarm',
  'mendcap-colony': 'Mendcap Colony',
  'deathcap-herald': 'Deathcap Herald',
  'drowned-warden': 'Drowned Warden',
  'grasping-drowned': 'Grasping Drowned',
  'lantern-medusa': 'Lantern Medusa',
  'corpsefire-wisp': 'Corpsefire Wisp',
};

/** Glyph per boss (content-biomes.md boss headers; ☠️ for the Bone Colossus, its own foe). */
export const BOSS_GLYPH: Readonly<Record<BossId, string>> = {
  'bone-colossus': '☠️',
  rimeheart: '💠',
  forgeheart: '🌋',
  'the-rotmother': '🌸',
  'drowned-sovereign': '🔱',
};

/** Fast membership set for the base-enemy union (the three dungeon enemies). */
const BASE_ENEMY_SET = new Set<string>(ENEMY_IDS);
/** Fast membership set for the biome-enemy union. */
const BIOME_ENEMY_SET = new Set<string>(BIOME_ENEMY_IDS);

/** Whether an id names one of the three base (dungeon) enemies. */
export function isBaseEnemyId(id: string): id is EnemyId {
  return BASE_ENEMY_SET.has(id);
}

/** Whether an id names one of the 16 biome-exclusive enemies. */
export function isBiomeEnemyId(id: string): id is BiomeEnemyId {
  return BIOME_ENEMY_SET.has(id);
}

/** The display glyph for any enemy id (base or biome). Falls back to a generic monster glyph. */
export function enemyGlyph(id: string): string {
  if (isBaseEnemyId(id)) return ENEMY_GLYPH[id];
  if (isBiomeEnemyId(id)) return BIOME_ENEMY_GLYPH[id];
  return '👾';
}

/** The display name for any enemy id (base or biome). Base names title-case; biome names verbatim. */
export function enemyDisplayName(id: string): string {
  if (isBaseEnemyId(id)) return baseEnemyName(id);
  if (isBiomeEnemyId(id)) return BIOME_ENEMY_NAME[id];
  return id;
}

/** The base `Enemy` stat block for any enemy id (base or biome). Throws on an unknown id. */
export function enemyDef(id: string): Enemy {
  if (isBaseEnemyId(id)) return getEnemy(id);
  if (isBiomeEnemyId(id)) return getBiomeEnemy(id);
  throw new Error(`enemyDef: unknown enemy id '${id}'`);
}

/** The display glyph for a boss id. */
export function bossGlyph(id: BossId): string {
  return BOSS_GLYPH[id] ?? '👑';
}

/** The display name for a boss id (straight from the engine boss registry). */
export function bossName(id: BossId): string {
  const boss = BOSS_REGISTRY[bossBiomeById(id)];
  return boss.name;
}

/** Reverse lookup: the biome a boss id belongs to (the registry is biome-keyed). */
function bossBiomeById(id: BossId): BiomeId {
  for (const biome of Object.keys(BOSS_REGISTRY) as BiomeId[]) {
    if (BOSS_REGISTRY[biome].id === id) return biome;
  }
  throw new Error(`bossName: unknown boss id '${id}'`);
}
