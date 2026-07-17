/**
 * Biome-enemy registry-FIDELITY tests: every enemy asserts its EXACT content-biomes.md numbers
 * (HP, affinity, script). These tests ARE the spec transcription check — a wrong number here is a
 * failing test. Plus feasibility-bounds assertions: regular enemy attacks ≤ 20, HP ∈ [40, 300],
 * heals ∈ [4, 12], affinity tiers ∈ {0, 0.5, 1, 2}. (Boss ≤ 28 exemption is checked in the run layer.)
 */
import { AFFINITY_IMMUNE, AFFINITY_RESIST, AFFINITY_WEAK } from './config';
import {
  BIOME_ENEMY_IDS,
  BIOME_ENEMY_STATS,
  biomeAffinityFor,
  getBiomeEnemy,
} from './biomeEnemies';
import type { BiomeEnemyId } from './types';

describe('biome-enemy registry — 16 enemies, 4 per Act-2 biome', () => {
  it('exposes exactly the 16 biome enemies', () => {
    expect(BIOME_ENEMY_IDS).toHaveLength(16);
    expect(new Set(BIOME_ENEMY_IDS).size).toBe(16); // no duplicates
  });

  it('has exactly 4 enemies tagged to each of the four Act-2 biomes', () => {
    const byBiome = new Map<string, number>();
    for (const id of BIOME_ENEMY_IDS) {
      const b = BIOME_ENEMY_STATS[id].biome;
      byBiome.set(b, (byBiome.get(b) ?? 0) + 1);
    }
    expect(byBiome.get('glacial-crypt')).toBe(4);
    expect(byBiome.get('emberworks')).toBe(4);
    expect(byBiome.get('rotwood')).toBe(4);
    expect(byBiome.get('sunken-catacombs')).toBe(4);
  });

  it('getBiomeEnemy throws on an unknown id (boundary validation)', () => {
    expect(() => getBiomeEnemy('dragon' as BiomeEnemyId)).toThrow();
  });
});

// Each row is the VERBATIM spec: [id, hp, affinity, script]. A mismatch fails the transcription.
const SPEC: ReadonlyArray<
  readonly [BiomeEnemyId, number, Record<string, number>, ReadonlyArray<{ type: string; value: number }>]
> = [
  // Glacial Crypt
  ['permafrost-warden', 220, { R: AFFINITY_RESIST, B: AFFINITY_WEAK }, [
    { type: 'attack', value: 10 }, { type: 'attack', value: 10 }, { type: 'frostArmor', value: 14 },
  ]],
  ['frostbite-wisp', 45, { B: AFFINITY_RESIST, Y: AFFINITY_WEAK }, [
    { type: 'frostArmor', value: 5 }, { type: 'attack', value: 6 }, { type: 'attack', value: 8 },
  ]],
  ['hoarfrost-cantor', 140, { R: AFFINITY_WEAK, Y: AFFINITY_RESIST }, [
    { type: 'attack', value: 6 }, { type: 'attack', value: 6 }, { type: 'heal', value: 12 },
  ]],
  ['icebound-revenant', 80, { G: AFFINITY_WEAK, B: AFFINITY_RESIST }, [
    { type: 'frostArmor', value: 14 }, { type: 'charge', value: 0 }, { type: 'attack', value: 18 },
  ]],
  // Emberworks
  // Slagback R IMMUNE→RESIST, HP 260→140, armor 12→8 (fairness amendment 2026-07-17).
  ['slagback-brute', 140, { R: AFFINITY_RESIST, B: AFFINITY_WEAK, Y: AFFINITY_RESIST }, [
    { type: 'attack', value: 8 }, { type: 'armor', value: 8 }, { type: 'attack', value: 8 },
  ]],
  ['cinder-imp', 55, { R: AFFINITY_RESIST, Y: AFFINITY_WEAK }, [
    { type: 'attack', value: 5 }, { type: 'attack', value: 8 },
  ]],
  // Forge-Tender HP 130→90, heal 12→6 (fairness amendment 2026-07-17).
  ['forge-tender', 90, { R: AFFINITY_RESIST, G: AFFINITY_WEAK }, [
    { type: 'attack', value: 6 }, { type: 'heal', value: 6 }, { type: 'attack', value: 10 },
  ]],
  // Furnace-Wisp escalation capped 4→8→12→16→20 ⇒ 4→8→12 (fairness amendment 2026-07-17).
  ['furnace-wisp', 70, { R: AFFINITY_RESIST, B: AFFINITY_WEAK, Y: AFFINITY_RESIST }, [
    { type: 'attack', value: 4 }, { type: 'attack', value: 8 }, { type: 'attack', value: 12 },
  ]],
  // Rotwood
  // Mirebark-Hulk HP 260→160, self-heal 8→5 (fairness amendment 2026-07-17).
  ['mirebark-hulk', 160, { R: AFFINITY_WEAK, G: AFFINITY_RESIST }, [
    { type: 'attack', value: 12 }, { type: 'attack', value: 12 }, { type: 'heal', value: 5 },
  ]],
  ['rotgrub-swarm', 55, { B: AFFINITY_RESIST, Y: AFFINITY_WEAK }, [
    { type: 'attack', value: 5 }, { type: 'attack', value: 5 }, { type: 'spore', value: 2 },
  ]],
  // Mendcap-Colony HP 140→120, heal cycle 12+10 (22)→6+6 (12) (fairness amendment 2026-07-17).
  ['mendcap-colony', 120, { G: AFFINITY_RESIST, B: AFFINITY_WEAK }, [
    { type: 'heal', value: 6 }, { type: 'attack', value: 6 }, { type: 'heal', value: 6 }, { type: 'attack', value: 6 },
  ]],
  ['deathcap-herald', 45, { G: AFFINITY_WEAK, Y: AFFINITY_RESIST }, [
    { type: 'charge', value: 0 }, { type: 'attack', value: 20 }, { type: 'spore', value: 3 },
  ]],
  // Sunken Catacombs
  ['drowned-warden', 260, { B: AFFINITY_RESIST, Y: AFFINITY_WEAK }, [
    { type: 'attack', value: 7 }, { type: 'attack', value: 7 }, { type: 'heal', value: 8 },
  ]],
  ['grasping-drowned', 65, { R: AFFINITY_WEAK }, [
    { type: 'attack', value: 6 }, { type: 'attack', value: 11 },
  ]],
  ['lantern-medusa', 120, { G: AFFINITY_WEAK, B: AFFINITY_RESIST }, [
    { type: 'attack', value: 6 }, { type: 'heal', value: 10 }, { type: 'curse', value: 2 },
  ]],
  ['corpsefire-wisp', 45, { B: AFFINITY_IMMUNE, Y: AFFINITY_WEAK }, [
    { type: 'attack', value: 13 },
  ]],
];

describe('biome-enemy fidelity — exact spec numbers per enemy', () => {
  for (const [id, hp, affinity, script] of SPEC) {
    it(`${id}: HP ${hp}, exact affinity + script`, () => {
      const e = getBiomeEnemy(id);
      expect(e.id).toBe(id);
      expect(e.maxHp).toBe(hp);
      expect(e.affinity).toEqual(affinity);
      expect(e.script).toEqual(script);
    });
  }

  it('SPEC covers every id in the registry (no enemy left un-asserted)', () => {
    expect(SPEC.map((r) => r[0]).sort()).toEqual([...BIOME_ENEMY_IDS].sort());
  });

  it('affinity lookups default unlisted colors to normal 1.0 (e.g. Slagback R resist, G normal)', () => {
    const slag = getBiomeEnemy('slagback-brute');
    expect(biomeAffinityFor(slag, 'R')).toBe(0.5); // resist (amended from immune 0.0, 2026-07-17)
    expect(biomeAffinityFor(slag, 'B')).toBe(2.0); // weak
    expect(biomeAffinityFor(slag, 'G')).toBe(1.0); // normal (unlisted)
  });

  it('Corpsefire Wisp still exercises the IMMUNE tier (Blue does nothing)', () => {
    const corpse = getBiomeEnemy('corpsefire-wisp');
    expect(biomeAffinityFor(corpse, 'B')).toBe(0.0); // immune — the remaining IMMUNE user post-amendment
    expect(biomeAffinityFor(corpse, 'Y')).toBe(2.0); // weak
  });
});

describe('feasibility bounds — regular enemies stay inside the engine constraints', () => {
  const TIERS = new Set([0, 0.5, 1, 2]);

  it('every biome enemy: HP ∈ [40, 300], every affinity ∈ {0, 0.5, 1, 2}', () => {
    for (const id of BIOME_ENEMY_IDS) {
      const s = BIOME_ENEMY_STATS[id];
      expect(s.maxHp).toBeGreaterThanOrEqual(40);
      expect(s.maxHp).toBeLessThanOrEqual(300);
      for (const mult of Object.values(s.affinity)) {
        expect(TIERS.has(mult as number)).toBe(true);
      }
    }
  });

  it('every regular-enemy attack ≤ 20 (bosses get the ≤28 exemption, not enemies)', () => {
    for (const id of BIOME_ENEMY_IDS) {
      for (const a of BIOME_ENEMY_STATS[id].script) {
        if (a.type === 'attack') expect(a.value).toBeLessThanOrEqual(20);
      }
    }
  });

  it('every self-heal ∈ [4, 12]; charge is exactly 0', () => {
    for (const id of BIOME_ENEMY_IDS) {
      for (const a of BIOME_ENEMY_STATS[id].script) {
        if (a.type === 'heal') {
          expect(a.value).toBeGreaterThanOrEqual(4);
          expect(a.value).toBeLessThanOrEqual(12);
        }
        if (a.type === 'charge') expect(a.value).toBe(0);
      }
    }
  });
});
