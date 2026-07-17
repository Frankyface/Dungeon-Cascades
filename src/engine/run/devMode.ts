/**
 * Dev-mode ENGINE helpers (Stage-6 wave 2, spec-systems.md §8 — engine side only; the UI wave builds
 * the hidden screen). Pure functions over `MetaState`: unlock/discover everything, or reset to fresh.
 *
 * STORAGE CONVENTION (enforced by the UI, guaranteed here by construction): dev meta must NEVER touch
 * the normal `MetaStorePort` key. These helpers are PURE — they take/return a `MetaState`, own no
 * port, and perform no persistence — so the UI stores any dev profile under a SEPARATE, clearly-marked
 * key, and the sim/purity evidence stays dev-free BY CONSTRUCTION (nothing here can leak into normal
 * meta unless a caller deliberately saves it to the real key, which the UI does not).
 *
 * PURE ENGINE: no React / React Native imports; deterministic; never mutates input.
 */
import { RELIC_IDS } from './relics';
import { BIOME_IDS, ACT2_BIOME_IDS, getBiome } from './biomes';
import { BOSSES } from './biomeBosses';
import { VARIANT_IDS } from './variants';
import { INITIAL_META_STATE } from './meta';
import type { MetaState } from './meta';

/** Every enemy id across all five biomes (dungeon's 3 + 4 biomes × 4 = 19), in biome order. */
export const ALL_ENEMY_IDS: readonly string[] = BIOME_IDS.flatMap((id) => getBiome(id).enemyIds.map((e) => String(e)));

/**
 * A fully-unlocked, fully-discovered DEV profile (spec §8 "unlock all content"): every relic, every
 * Act-2 biome, every enemy + boss discovered, Boss Rush + God of War unlocked, and every tranche
 * variant selectable. Preserves the passed profile's `score` (a dev toggle unlocks content, it does
 * not fabricate progress). Pure — returns a NEW state; never mutates `base`.
 */
export function devUnlockAllMeta(base: MetaState = INITIAL_META_STATE): MetaState {
  return {
    ...base,
    unlockedVariantIds: [...VARIANT_IDS],
    unlockedRelicIds: [...RELIC_IDS],
    discoveredEnemyIds: [...ALL_ENEMY_IDS],
    discoveredBossIds: BOSSES.map((b) => b.id),
    unlockedBiomeIds: [...ACT2_BIOME_IDS],
    bossRushUnlocked: true,
    godOfWarUnlocked: true,
    altarUnlockCount: base.altarUnlockCount ?? 0,
  };
}

/** Reset a profile to the fresh initial state (spec §8 "reset meta"). Pure; a full meta wipe. */
export function devMetaReset(): MetaState {
  return INITIAL_META_STATE;
}
