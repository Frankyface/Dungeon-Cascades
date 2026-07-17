/**
 * Difficulty-scaling fixtures. `difficultyAt(f) = 1 + 0.15·f`. BOTH HP and attack scale at
 * dampened rates off the floor curve; elites multiply both. All hand-computed from runConfig.
 * STAGE-6 BALANCE RETUNE (decisions.md recalibration precedent): recomputed for the eased dampeners
 * HP_DIFFICULTY_DAMPEN 0.2→0.12, ATTACK_DIFFICULTY_DAMPEN 0.15→0.10, ELITE_HP_MULT 1.3→1.15,
 * ELITE_ATTACK_MULT 1.2→1.1 (spec §9 win-rate retune). Every expected value below is re-derived
 * by hand from those new constants (arithmetic shown inline).
 */
import { createRng } from '../board';
import { getBiomeEnemy, getEnemy } from '../combat';
import type { Enemy } from '../combat';
import { ENCOUNTER_POOL } from './runConfig';
import { getBiome } from './biomes';
import { difficultyAt } from './mapGen';
import { scaleEnemy, scaledEnemyFor, selectEnemy, selectBiomeEnemy, scaledBiomeEnemyFor } from './enemyScaling';

describe('scaleEnemy — floor + elite scaling', () => {
  it('is identity for a normal fight at floor 0 (difficulty 1.0)', () => {
    const slime = getEnemy('slime'); // maxHp 80, script [{attack 8}]
    const scaled = scaleEnemy(slime, 1.0, false);
    expect(scaled.maxHp).toBe(80);
    expect(scaled.script[0]).toEqual({ type: 'attack', value: 8 });
  });

  it('scales an elite at floor 0: HP ×1.15, attack ×1.1', () => {
    const scaled = scaleEnemy(getEnemy('slime'), 1.0, true);
    expect(scaled.maxHp).toBe(92); // round(80 × 1.15)
    expect(scaled.script[0]).toEqual({ type: 'attack', value: 9 }); // round(8 × 1.1 = 8.8)
  });

  it('scales a normal fight at floor 4 (difficulty 1.6): dampened HP ×1.072, attack ×1.06', () => {
    const scaled = scaleEnemy(getEnemy('slime'), 1.6, false);
    // hpMult = 1 + (1.6 − 1)×0.12 = 1.072 ⇒ round(80 × 1.072 = 85.76) = 86
    expect(scaled.maxHp).toBe(86);
    // atkMult = 1 + (1.6 − 1)×0.10 = 1.06 ⇒ round(8 × 1.06 = 8.48) = 8
    expect(scaled.script[0]).toEqual({ type: 'attack', value: 8 });
  });

  it('leaves charge (value 0) at 0 and scales multi-action scripts (skeleton, floor 2)', () => {
    // difficulty 1.3 ⇒ hpMult = 1 + 0.3×0.12 = 1.036, atkMult = 1 + 0.3×0.10 = 1.03
    const scaled = scaleEnemy(getEnemy('skeleton'), 1.3, false); // script [8, charge, 16]
    expect(scaled.maxHp).toBe(124); // round(120 × 1.036 = 124.32)
    expect(scaled.script[0]).toEqual({ type: 'attack', value: 8 }); // round(8 × 1.03 = 8.24)
    expect(scaled.script[1]).toEqual({ type: 'charge', value: 0 }); // untouched
    expect(scaled.script[2]).toEqual({ type: 'attack', value: 16 }); // round(16 × 1.03 = 16.48)
  });

  it('preserves the enemy id and affinity table', () => {
    const scaled = scaleEnemy(getEnemy('bat'), 1.9, true);
    expect(scaled.id).toBe('bat');
    expect(scaled.affinity).toEqual(getEnemy('bat').affinity);
  });
});

describe('scaledEnemyFor — resolve base id + floor + elite', () => {
  it('scales the named base enemy by the dampened floor difficulty', () => {
    const scaled = scaledEnemyFor('slime', 4, false); // difficultyAt(4)=1.6 ⇒ hpMult 1.072
    expect(scaled.maxHp).toBe(86);
  });
});

describe('scaleEnemy — Stage-6 biome verb scaling guards (wave 1c)', () => {
  // A synthetic enemy carrying every verb, scaled at floor 25 (diff 4.75 ⇒ atkMult 1.5625).
  const kitchenSink: Enemy = {
    id: 'permafrost-warden',
    maxHp: 100,
    affinity: {},
    script: [
      { type: 'attack', value: 10 }, // amount → scales
      { type: 'heal', value: 8 }, // amount → scales
      { type: 'frostArmor', value: 14 }, // shield amount → scales
      { type: 'armor', value: 12 }, // plate amount → scales
      { type: 'charge', value: 0 }, // wind-up → untouched
      { type: 'curse', value: 2 }, // TURN COUNT → non-scaling
      { type: 'spore', value: 3 }, // STACK COUNT → non-scaling
    ],
  };

  it('scales attack/heal/frostArmor/armor but leaves charge/curse/spore untouched', () => {
    const scaled = scaleEnemy(kitchenSink, 4.75, false); // atkMult = 1 + 3.75×0.10 = 1.375
    expect(scaled.script[0]).toEqual({ type: 'attack', value: 14 }); // round(10 × 1.375 = 13.75)
    expect(scaled.script[1]).toEqual({ type: 'heal', value: 11 }); // round(8 × 1.375 = 11)
    expect(scaled.script[2]).toEqual({ type: 'frostArmor', value: 19 }); // round(14 × 1.375 = 19.25)
    expect(scaled.script[3]).toEqual({ type: 'armor', value: 17 }); // round(12 × 1.375 = 16.5)
    expect(scaled.script[4]).toEqual({ type: 'charge', value: 0 }); // untouched
    expect(scaled.script[5]).toEqual({ type: 'curse', value: 2 }); // TURN COUNT — never scaled
    expect(scaled.script[6]).toEqual({ type: 'spore', value: 3 }); // STACK COUNT — never scaled
  });
});

describe('selectBiomeEnemy / scaledBiomeEnemyFor — Act-2 biome enemies', () => {
  it('selectBiomeEnemy picks one of the biome\'s four exclusive enemies (deterministic)', () => {
    const a = selectBiomeEnemy(createRng(42), 'glacial-crypt');
    const b = selectBiomeEnemy(createRng(42), 'glacial-crypt');
    expect(getBiome('glacial-crypt').enemyIds).toContain(a.enemyId);
    expect(a.enemyId).toBe(b.enemyId);
  });

  it('reaches every enemy in the biome kit across seeds', () => {
    const seen = new Set<string>();
    for (let s = 0; s < 60; s++) seen.add(selectBiomeEnemy(createRng(s), 'rotwood').enemyId);
    for (const id of getBiome('rotwood').enemyIds) expect(seen.has(id)).toBe(true);
  });

  it('scaledBiomeEnemyFor scales the biome enemy and preserves its biome tag', () => {
    const base = getBiomeEnemy('permafrost-warden'); // maxHp 220, biome glacial-crypt
    // difficultyAt(13) = 1 + 0.15×13 = 2.95 ⇒ hpMult = 1 + 1.95×0.12 = 1.234 ⇒ round(220 × 1.234) = 271.
    const scaled = scaledBiomeEnemyFor('permafrost-warden', 13, false);
    expect(scaled.maxHp).toBe(Math.round(base.maxHp * (1 + (difficultyAt(13) - 1) * 0.12)));
    expect(scaled.maxHp).toBe(271);
    expect(scaled.biome).toBe('glacial-crypt');
    // Elite multiplies both on top.
    const elite = scaledBiomeEnemyFor('permafrost-warden', 13, true);
    expect(elite.maxHp).toBeGreaterThan(scaled.maxHp);
  });
});

describe('selectEnemy — seeded pick from the encounter pool', () => {
  it('always picks a pool member and is deterministic for a seed', () => {
    const a = selectEnemy(createRng(42));
    const b = selectEnemy(createRng(42));
    expect(ENCOUNTER_POOL).toContain(a.enemyId);
    expect(a.enemyId).toBe(b.enemyId);
  });

  it('reaches every enemy in the pool across seeds', () => {
    const seen = new Set<string>();
    for (let s = 0; s < 60; s++) seen.add(selectEnemy(createRng(s)).enemyId);
    for (const id of ENCOUNTER_POOL) expect(seen.has(id)).toBe(true);
  });
});
