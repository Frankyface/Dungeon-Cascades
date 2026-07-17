/**
 * Locked-derivation fidelity: the discovery-driven compendium must render the RIGHT locked/unlocked
 * split for a given profile, count correctly per section, and — when discovered — produce entries
 * byte-identical to the always-visible base compendium builders. Covers a fresh profile (mostly
 * locked), a partial profile, and a fully-unlocked dev profile.
 */
import {
  ALL_ENEMY_IDS,
  BIOME_IDS,
  BOSSES,
  INITIAL_META_STATE,
  RELIC_IDS,
  UNLOCKED_BY_DEFAULT_IDS,
  devUnlockAllMeta,
  getBiome,
} from '../../engine/run';
import type { MetaState } from '../../engine/run';
import {
  LOCKED_GLYPH,
  LOCKED_NAME,
  bossFloorFor,
  compendiumBossSection,
  compendiumEnemySection,
  compendiumRelicSection,
} from './compendiumDiscovery';
import { compendiumBossFor, compendiumEnemyDetail } from './compendiumModel';

describe('compendiumRelicSection', () => {
  it('unlocks exactly the base 12 on a fresh profile; the rest are silhouettes', () => {
    const { slots, count } = compendiumRelicSection(INITIAL_META_STATE);
    expect(slots).toHaveLength(RELIC_IDS.length);
    expect(count.discovered).toBe(UNLOCKED_BY_DEFAULT_IDS.length);
    expect(count.total).toBe(RELIC_IDS.length);
    expect(count.label).toBe(`${UNLOCKED_BY_DEFAULT_IDS.length}/${RELIC_IDS.length}`);

    const base = slots.find((s) => s.id === UNLOCKED_BY_DEFAULT_IDS[0])!;
    expect(base.locked).toBe(false);
    expect(base.card).not.toBeNull();

    const locked = slots.find((s) => s.locked)!;
    expect(locked.card).toBeNull();
  });

  it('unlocks everything for a fully-unlocked profile', () => {
    const { count } = compendiumRelicSection(devUnlockAllMeta());
    expect(count.discovered).toBe(RELIC_IDS.length);
    expect(count.label).toBe(`${RELIC_IDS.length}/${RELIC_IDS.length}`);
  });
});

describe('compendiumEnemySection — biome-grouped, locked-aware', () => {
  it('is all locked on a fresh profile, grouped by biome (dungeon first)', () => {
    const { groups, count } = compendiumEnemySection(INITIAL_META_STATE);
    expect(groups.map((g) => g.biomeId)).toEqual([...BIOME_IDS]);
    expect(groups[0].biomeId).toBe('dungeon');
    expect(count.discovered).toBe(0);
    expect(count.total).toBe(ALL_ENEMY_IDS.length);

    for (const group of groups) {
      expect(group.slots).toHaveLength(getBiome(group.biomeId).enemyIds.length);
      for (const slot of group.slots) {
        expect(slot.discovered).toBe(false);
        expect(slot.glyph).toBe(LOCKED_GLYPH);
        expect(slot.name).toBe(LOCKED_NAME);
        expect(slot.detail).toBeNull();
      }
    }
  });

  it('reveals only the discovered enemies, with detail identical to the base builder', () => {
    const meta: MetaState = { ...INITIAL_META_STATE, discoveredEnemyIds: ['slime', 'permafrost-warden'] };
    const { groups, count } = compendiumEnemySection(meta);
    expect(count.discovered).toBe(2);

    const all = groups.flatMap((g) => g.slots);
    const slime = all.find((s) => s.id === 'slime')!;
    expect(slime.discovered).toBe(true);
    expect(slime.name).toBe('Slime');
    expect(slime.detail).toEqual(compendiumEnemyDetail('slime'));

    const warden = all.find((s) => s.id === 'permafrost-warden')!;
    expect(warden.detail).toEqual(compendiumEnemyDetail('permafrost-warden'));

    const bat = all.find((s) => s.id === 'bat')!;
    expect(bat.discovered).toBe(false);
    expect(bat.detail).toBeNull();
  });

  it('reveals every enemy for a fully-unlocked profile', () => {
    const { count } = compendiumEnemySection(devUnlockAllMeta());
    expect(count.discovered).toBe(ALL_ENEMY_IDS.length);
  });
});

describe('compendiumBossSection — one per biome, locked-aware', () => {
  it('is all locked on a fresh profile (0/5), one slot per biome', () => {
    const { slots, count } = compendiumBossSection(INITIAL_META_STATE);
    expect(slots).toHaveLength(BOSSES.length);
    expect(count).toEqual({ discovered: 0, total: BOSSES.length, label: `0/${BOSSES.length}` });
    for (const slot of slots) {
      expect(slot.name).toBe(LOCKED_NAME);
      expect(slot.glyph).toBe(LOCKED_GLYPH);
      expect(slot.detail).toBeNull();
    }
  });

  it('reveals a discovered boss with phased detail identical to the base builder', () => {
    const meta: MetaState = { ...INITIAL_META_STATE, discoveredBossIds: ['bone-colossus'] };
    const { slots, count } = compendiumBossSection(meta);
    expect(count.discovered).toBe(1);
    const colossus = slots.find((s) => s.bossId === 'bone-colossus')!;
    expect(colossus.discovered).toBe(true);
    expect(colossus.name).toBe('Bone Colossus');
    const boss = BOSSES.find((b) => b.id === 'bone-colossus')!;
    expect(colossus.detail).toEqual(compendiumBossFor(boss, bossFloorFor('dungeon')));
  });

  it('scales the dungeon boss at Act-1 floor 12 and biome bosses at Act-2 floor 25', () => {
    expect(bossFloorFor('dungeon')).toBe(12);
    expect(bossFloorFor('rotwood')).toBe(25);
  });

  it('reveals every boss for a fully-unlocked profile', () => {
    const { count } = compendiumBossSection(devUnlockAllMeta());
    expect(count.discovered).toBe(BOSSES.length);
  });
});
