/**
 * Dev-mode helper tests (Stage-6 wave 2, spec §8): `devUnlockAllMeta` unlocks/discovers EVERYTHING
 * and `devMetaReset` wipes back to fresh — both PURE (no port, no mutation), which is what keeps the
 * sim/purity evidence dev-free by construction (nothing here persists to the normal meta key).
 */
import { RELIC_IDS, UNLOCKED_BY_DEFAULT_IDS } from './relics';
import { BOSSES } from './biomeBosses';
import { ACT2_BIOME_IDS } from './biomes';
import { VARIANT_IDS } from './variants';
import { INITIAL_META_STATE, selectableStarts } from './meta';
import { GOD_OF_WAR_ID } from './variants';
import { devMetaReset, devUnlockAllMeta, ALL_ENEMY_IDS } from './devMode';
import { startBossRush } from './bossRush';

describe('devUnlockAllMeta — unlock/discover everything (§8)', () => {
  const dev = devUnlockAllMeta();

  it('unlocks every relic, biome, enemy, and boss, and flips Boss Rush + God of War', () => {
    expect(dev.unlockedRelicIds).toEqual([...RELIC_IDS]); // all 88
    expect(dev.unlockedBiomeIds).toEqual([...ACT2_BIOME_IDS]);
    expect(dev.discoveredEnemyIds).toEqual([...ALL_ENEMY_IDS]);
    expect(dev.discoveredBossIds).toEqual(BOSSES.map((b) => b.id));
    expect(dev.bossRushUnlocked).toBe(true);
    expect(dev.godOfWarUnlocked).toBe(true);
    expect(dev.unlockedVariantIds).toEqual([...VARIANT_IDS]);
  });

  it('makes every start (vanilla + all variants + God of War) selectable', () => {
    const starts = selectableStarts(dev);
    expect(starts).toEqual([null, ...VARIANT_IDS, GOD_OF_WAR_ID]);
  });

  it('unblocks Boss Rush (gate no longer throws)', () => {
    expect(() => startBossRush(1, dev)).not.toThrow();
  });

  it('is PURE — never mutates the base profile (INITIAL stays fresh)', () => {
    const snapshot = JSON.stringify(INITIAL_META_STATE);
    devUnlockAllMeta(INITIAL_META_STATE);
    expect(JSON.stringify(INITIAL_META_STATE)).toBe(snapshot); // untouched
    // The dev profile is a NEW object, distinct from the fresh one.
    expect(dev).not.toBe(INITIAL_META_STATE);
    expect(dev.unlockedRelicIds).not.toEqual(INITIAL_META_STATE.unlockedRelicIds);
  });

  it('preserves the passed profile score (a content toggle, not a progress cheat)', () => {
    const withScore = devUnlockAllMeta({ ...INITIAL_META_STATE, score: 123 });
    expect(withScore.score).toBe(123);
  });
});

describe('ALL_ENEMY_IDS — every enemy across the five biomes', () => {
  it('is the 3 dungeon enemies plus 4 per Act-2 biome (19 total, no dupes)', () => {
    expect(ALL_ENEMY_IDS).toHaveLength(3 + 4 * 4);
    expect(new Set(ALL_ENEMY_IDS).size).toBe(ALL_ENEMY_IDS.length);
  });
});

describe('devMetaReset — full meta wipe (§8)', () => {
  it('returns the fresh initial profile (base 12 unlocked, nothing discovered)', () => {
    expect(devMetaReset()).toEqual(INITIAL_META_STATE);
    expect(devMetaReset().unlockedRelicIds).toEqual([...UNLOCKED_BY_DEFAULT_IDS]);
    expect(devMetaReset().bossRushUnlocked).toBe(false);
  });
});
