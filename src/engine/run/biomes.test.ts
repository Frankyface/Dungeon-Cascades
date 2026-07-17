/**
 * Biome-registry fidelity: the five biomes carry their exact content-biomes.md / spec-systems.md
 * data (name, enemy kit, boss id, verbatim palette DIRECTION text), and the registry is internally
 * consistent with the enemy + boss registries (`assertBiomesWellFormed`).
 */
import { ACT2_BIOME_IDS, BIOMES, BIOME_IDS, assertBiomesWellFormed, getBiome } from './biomes';
import type { BiomeId } from '../combat';

describe('biome registry — 5 biomes (dungeon + 4 Act-2)', () => {
  it('exposes exactly the five biomes; dungeon is the default and there are four Act-2 biomes', () => {
    expect(BIOME_IDS).toHaveLength(5);
    expect(BIOME_IDS[0]).toBe('dungeon');
    expect([...ACT2_BIOME_IDS].sort()).toEqual(['emberworks', 'glacial-crypt', 'rotwood', 'sunken-catacombs']);
  });

  it('is internally consistent with the enemy + boss registries', () => {
    expect(() => assertBiomesWellFormed()).not.toThrow();
  });

  it('getBiome throws on an unknown id', () => {
    expect(() => getBiome('nowhere' as BiomeId)).toThrow();
  });
});

describe('biome fidelity — enemy kits, boss ids, and verbatim palette directions', () => {
  const EXPECTED: ReadonlyArray<
    readonly [BiomeId, string, readonly string[], string, string]
  > = [
    ['glacial-crypt', 'The Glacial Crypt',
      ['permafrost-warden', 'frostbite-wisp', 'hoarfrost-cantor', 'icebound-revenant'],
      'rimeheart',
      'Blue ice / brittle rime; a dead kingdom entombed in blue. Guardians answer in four colors (Blue shatter, Yellow light, Red warmth, Green thaw).'],
    ['emberworks', 'The Emberworks',
      ['slagback-brute', 'cinder-imp', 'forge-tender', 'furnace-wisp'],
      'forgeheart',
      'Never-cooling foundry — living slag, molten red/orange, ash-grey wraps.'],
    ['rotwood', 'The Rotwood',
      ['mirebark-hulk', 'rotgrub-swarm', 'mendcap-colony', 'deathcap-herald'],
      'the-rotmother',
      'Rot green + waterlogged deadwood; DoT/regen biome, Green is the trap color.'],
    ['sunken-catacombs', 'The Sunken Catacombs',
      ['drowned-warden', 'grasping-drowned', 'lantern-medusa', 'corpsefire-wisp'],
      'drowned-sovereign',
      'Black tidewater / drowned crypt; Blue is the trap color, lantern-pale light.'],
  ];

  for (const [id, name, enemyIds, bossId, palette] of EXPECTED) {
    it(`${id}: name, 4-enemy kit, boss id, and exact palette direction`, () => {
      const b = getBiome(id);
      expect(b.name).toBe(name);
      expect(b.enemyIds).toEqual(enemyIds);
      expect(b.bossId).toBe(bossId);
      expect(b.paletteDirection).toBe(palette);
    });
  }

  it('the dungeon biome holds the three base enemies + Bone Colossus', () => {
    const d = BIOMES.dungeon;
    expect(d.enemyIds).toEqual(['slime', 'skeleton', 'bat']);
    expect(d.bossId).toBe('bone-colossus');
  });
});
