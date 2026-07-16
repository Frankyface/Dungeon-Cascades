/**
 * Difficulty-scaling fixtures. `difficultyAt(f) = 1 + 0.15·f`. BOTH HP and attack scale at
 * dampened rates off the floor curve; elites multiply both. All hand-computed from runConfig
 * (HP_DIFFICULTY_DAMPEN 0.2, ATTACK_DIFFICULTY_DAMPEN 0.15, ELITE_HP_MULT 1.3, ELITE_ATTACK_MULT 1.2).
 */
import { createRng } from '../board';
import { getEnemy } from '../combat';
import { ENCOUNTER_POOL } from './runConfig';
import { scaleEnemy, scaledEnemyFor, selectEnemy } from './enemyScaling';

describe('scaleEnemy — floor + elite scaling', () => {
  it('is identity for a normal fight at floor 0 (difficulty 1.0)', () => {
    const slime = getEnemy('slime'); // maxHp 80, script [{attack 8}]
    const scaled = scaleEnemy(slime, 1.0, false);
    expect(scaled.maxHp).toBe(80);
    expect(scaled.script[0]).toEqual({ type: 'attack', value: 8 });
  });

  it('scales an elite at floor 0: HP ×1.3, attack ×1.2', () => {
    const scaled = scaleEnemy(getEnemy('slime'), 1.0, true);
    expect(scaled.maxHp).toBe(104); // round(80 × 1.3)
    expect(scaled.script[0]).toEqual({ type: 'attack', value: 10 }); // round(8 × 1.2 = 9.6)
  });

  it('scales a normal fight at floor 4 (difficulty 1.6): dampened HP ×1.12, attack ×1.09', () => {
    const scaled = scaleEnemy(getEnemy('slime'), 1.6, false);
    // hpMult = 1 + (1.6 − 1)×0.2 = 1.12 ⇒ round(80 × 1.12 = 89.6) = 90
    expect(scaled.maxHp).toBe(90);
    // atkMult = 1 + (1.6 − 1)×0.15 = 1.09 ⇒ round(8 × 1.09 = 8.72) = 9
    expect(scaled.script[0]).toEqual({ type: 'attack', value: 9 });
  });

  it('leaves charge (value 0) at 0 and scales multi-action scripts (skeleton, floor 2)', () => {
    // difficulty 1.3 ⇒ hpMult = 1 + 0.3×0.2 = 1.06, atkMult = 1 + 0.3×0.15 = 1.045
    const scaled = scaleEnemy(getEnemy('skeleton'), 1.3, false); // script [8, charge, 16]
    expect(scaled.maxHp).toBe(127); // round(120 × 1.06 = 127.2)
    expect(scaled.script[0]).toEqual({ type: 'attack', value: 8 }); // round(8 × 1.045 = 8.36)
    expect(scaled.script[1]).toEqual({ type: 'charge', value: 0 }); // untouched
    expect(scaled.script[2]).toEqual({ type: 'attack', value: 17 }); // round(16 × 1.045 = 16.72)
  });

  it('preserves the enemy id and affinity table', () => {
    const scaled = scaleEnemy(getEnemy('bat'), 1.9, true);
    expect(scaled.id).toBe('bat');
    expect(scaled.affinity).toEqual(getEnemy('bat').affinity);
  });
});

describe('scaledEnemyFor — resolve base id + floor + elite', () => {
  it('scales the named base enemy by the dampened floor difficulty', () => {
    const scaled = scaledEnemyFor('slime', 4, false); // difficultyAt(4)=1.6 ⇒ hpMult 1.12
    expect(scaled.maxHp).toBe(90);
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
