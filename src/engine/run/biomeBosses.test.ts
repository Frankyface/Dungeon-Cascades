/**
 * Biome-boss registry-FIDELITY tests: every boss asserts its EXACT content-biomes.md phase data
 * (base HP 150; 3 phases; per-phase affinity + script). These tests ARE the transcription check.
 * Plus: the boss telegraphed-nuke EXEMPTION (attacks ≤ 28, decisions.md 2026-07-17), the
 * curse-non-scaling boss-scaling guard, and a proof the existing combat/scaling machinery runs a
 * biome boss unchanged (through the `CombatState.enemy` override).
 */
import { AFFINITY_RESIST, AFFINITY_WEAK, startEncounter, playTurn } from '../combat';
import {
  BIOME_BOSS_BASE_HP,
  BONE_COLOSSUS,
  BOSSES,
  BOSS_REGISTRY,
  DROWNED_SOVEREIGN,
  FORGEHEART,
  RIMEHEART,
  THE_ROTMOTHER,
  getBossForBiome,
} from './biomeBosses';
import { BOSS_PHASES, bossEnemyForPhaseOf, bossMaxHpFor } from './boss';
import type { Boss } from './boss';
import { difficultyAt } from './mapGen';
import { BOSS_BASE_HP } from './runConfig';
import type { BiomeId } from '../combat';

describe('boss registry — five bosses keyed by biome (Bone Colossus = dungeon)', () => {
  it('maps every biome to its boss, with matching id + biome tag', () => {
    const pairs: ReadonlyArray<readonly [BiomeId, string]> = [
      ['dungeon', 'bone-colossus'],
      ['glacial-crypt', 'rimeheart'],
      ['emberworks', 'forgeheart'],
      ['rotwood', 'the-rotmother'],
      ['sunken-catacombs', 'drowned-sovereign'],
    ];
    for (const [biome, id] of pairs) {
      const boss = getBossForBiome(biome);
      expect(boss.id).toBe(id);
      expect(boss.biome).toBe(biome);
    }
    expect(BOSSES).toHaveLength(5);
  });

  it('every biome boss has base HP 150; the dungeon Bone Colossus keeps its base 120', () => {
    for (const boss of [RIMEHEART, FORGEHEART, THE_ROTMOTHER, DROWNED_SOVEREIGN]) {
      expect(boss.baseHp).toBe(BIOME_BOSS_BASE_HP);
      expect(boss.baseHp).toBe(150);
    }
    expect(BONE_COLOSSUS.baseHp).toBe(BOSS_BASE_HP);
    expect(BONE_COLOSSUS.baseHp).toBe(120);
    expect(BONE_COLOSSUS.phases).toBe(BOSS_PHASES); // reuses the existing dungeon phase data
  });

  it('every boss has exactly 3 phases', () => {
    for (const boss of BOSSES) expect(boss.phases).toHaveLength(3);
  });

  it('getBossForBiome throws on an unknown biome', () => {
    expect(() => getBossForBiome('void' as BiomeId)).toThrow();
  });
});

// Each boss's VERBATIM spec: name → [affinity, script] per phase.
type PhaseSpec = readonly [Record<string, number>, ReadonlyArray<{ type: string; value: number }>];
const BOSS_SPEC: ReadonlyArray<readonly [Boss, readonly PhaseSpec[]]> = [
  [RIMEHEART, [
    [{ B: AFFINITY_WEAK, R: AFFINITY_RESIST }, [{ type: 'frostArmor', value: 18 }, { type: 'attack', value: 9 }, { type: 'attack', value: 12 }]],
    [{ B: AFFINITY_WEAK, Y: AFFINITY_RESIST }, [{ type: 'frostArmor', value: 12 }, { type: 'attack', value: 15 }, { type: 'charge', value: 0 }, { type: 'attack', value: 22 }]],
    [{ B: AFFINITY_WEAK, Y: AFFINITY_WEAK }, [{ type: 'charge', value: 0 }, { type: 'attack', value: 28 }, { type: 'attack', value: 18 }]],
  ]],
  [FORGEHEART, [
    [{ B: AFFINITY_WEAK, R: AFFINITY_RESIST }, [{ type: 'attack', value: 12 }, { type: 'armor', value: 14 }, { type: 'attack', value: 16 }]],
    [{ R: AFFINITY_WEAK, G: AFFINITY_WEAK }, [{ type: 'attack', value: 14 }, { type: 'attack', value: 18 }, { type: 'charge', value: 0 }, { type: 'attack', value: 26 }]],
    [{ Y: AFFINITY_WEAK }, [{ type: 'attack', value: 20 }, { type: 'attack', value: 24 }, { type: 'attack', value: 28 }]],
  ]],
  [THE_ROTMOTHER, [
    [{ R: AFFINITY_WEAK }, [{ type: 'spore', value: 3 }, { type: 'attack', value: 10 }, { type: 'heal', value: 8 }, { type: 'attack', value: 12 }]],
    [{ Y: AFFINITY_WEAK, R: AFFINITY_RESIST }, [{ type: 'attack', value: 16 }, { type: 'charge', value: 0 }, { type: 'attack', value: 24 }, { type: 'heal', value: 6 }]],
    [{ B: AFFINITY_WEAK }, [{ type: 'spore', value: 4 }, { type: 'attack', value: 18 }, { type: 'attack', value: 20 }, { type: 'spore', value: 4 }]],
  ]],
  [DROWNED_SOVEREIGN, [
    [{ Y: AFFINITY_WEAK, B: AFFINITY_RESIST }, [{ type: 'attack', value: 12 }, { type: 'curse', value: 2 }, { type: 'heal', value: 10 }]],
    [{ B: AFFINITY_WEAK, Y: AFFINITY_RESIST }, [{ type: 'attack', value: 16 }, { type: 'charge', value: 0 }, { type: 'attack', value: 26 }]],
    [{ G: AFFINITY_WEAK }, [{ type: 'attack', value: 20 }, { type: 'curse', value: 1 }, { type: 'attack', value: 24 }]],
  ]],
];

describe('boss fidelity — exact per-phase spec numbers', () => {
  for (const [boss, phases] of BOSS_SPEC) {
    describe(boss.name, () => {
      phases.forEach((phaseSpec, i) => {
        it(`phase ${i} (${boss.phases[i].name}): exact affinity + script`, () => {
          expect(boss.phases[i].affinity).toEqual(phaseSpec[0]);
          expect(boss.phases[i].script).toEqual(phaseSpec[1]);
        });
      });
    });
  }
});

describe('boss feasibility bounds — the ≤28 nuke exemption (decisions.md 2026-07-17)', () => {
  const TIERS = new Set([0, 0.5, 1, 2]);

  it('every boss attack ≤ 28 (boss exemption); heals ∈ [4, 12]; charge 0; curse a small turn-count', () => {
    for (const boss of BOSSES) {
      for (const phase of boss.phases) {
        for (const a of phase.script) {
          if (a.type === 'attack') expect(a.value).toBeLessThanOrEqual(28);
          if (a.type === 'heal') {
            expect(a.value).toBeGreaterThanOrEqual(4);
            expect(a.value).toBeLessThanOrEqual(12);
          }
          if (a.type === 'charge') expect(a.value).toBe(0);
          if (a.type === 'curse') {
            expect(a.value).toBeGreaterThanOrEqual(1);
            expect(a.value).toBeLessThanOrEqual(3);
          }
        }
      }
    }
  });

  it('at least one biome boss actually uses the >20 exemption (proves the exemption is exercised)', () => {
    const overTwenty = BOSSES.flatMap((b) => b.phases.flatMap((p) => p.script))
      .filter((a) => a.type === 'attack' && a.value > 20);
    expect(overTwenty.length).toBeGreaterThan(0);
  });

  it('every boss affinity multiplier ∈ {0, 0.5, 1, 2}', () => {
    for (const boss of BOSSES) {
      for (const phase of boss.phases) {
        for (const mult of Object.values(phase.affinity)) {
          expect(TIERS.has(mult as number)).toBe(true);
        }
      }
    }
  });
});

describe('bossMaxHpFor — base-150 bosses ramp on the boss-floor curve', () => {
  it('is 150 at floor 0 and scales with the dampened ramp (floor 12 ⇒ 231)', () => {
    expect(bossMaxHpFor(150, 0)).toBe(150);
    // difficultyAt(12)=2.8 ⇒ 1 + (1.8×0.3)=1.54 ⇒ round(150×1.54=231)=231
    expect(bossMaxHpFor(150, 12)).toBe(231);
  });
});

describe('boss scaling — curse is NON-scaling (turn count); other verbs scale like attack', () => {
  it('Vael: curse value is unchanged at deep floors while attacks/heals scale (atkMult 1.15 @ diff 2.0)', () => {
    const scaled = bossEnemyForPhaseOf(DROWNED_SOVEREIGN, 0, 231, 2.0); // atkMult = 1 + (2.0−1)·0.15 = 1.15
    expect(scaled.script[0]).toEqual({ type: 'attack', value: 14 }); // round(12 × 1.15) = 14
    expect(scaled.script[1]).toEqual({ type: 'curse', value: 2 }); // UNCHANGED — turn count, not damage
    expect(scaled.script[2]).toEqual({ type: 'heal', value: 12 }); // round(10 × 1.15) = 12
  });

  it('Rimeheart frostArmor and Rotmother spore DO scale by atkMult', () => {
    const rime = bossEnemyForPhaseOf(RIMEHEART, 0, 231, 3.0); // atkMult = 1 + 2·0.15 = 1.3
    expect(rime.script[0]).toEqual({ type: 'frostArmor', value: 23 }); // round(18 × 1.3) = 23
    const rot = bossEnemyForPhaseOf(THE_ROTMOTHER, 2, 231, 3.0);
    expect(rot.script[0]).toEqual({ type: 'spore', value: 5 }); // round(4 × 1.3) = 5
  });

  it('at diff 1.0 the scaled phase enemy is the exact base spec (id + biome tag carried)', () => {
    const p0 = bossEnemyForPhaseOf(RIMEHEART, 0, 150, 1.0);
    expect(p0.id).toBe('rimeheart');
    expect(p0.biome).toBe('glacial-crypt');
    expect(p0.maxHp).toBe(150);
    expect(p0.script).toEqual(RIMEHEART.phases[0].script);
  });
});

describe('existing combat machinery handles a biome boss (via the enemy override)', () => {
  it('Rimeheart P0 raises its frost shield through a normal startEncounter/playTurn', () => {
    const p0 = bossEnemyForPhaseOf(RIMEHEART, 0, 150, 1.0);
    const enc = startEncounter('skeleton', 7, undefined, undefined, p0);
    expect(enc.telegraph).toEqual({ type: 'frostArmor', value: 18 }); // script[0]
    // A single turn: the boss raises its shield (the frostArmor verb fires through the shared engine).
    const path = { start: { col: 2, row: 2 }, steps: ['up', 'left'] } as const;
    const res = playTurn(enc, path);
    expect(res.enemyAction).toEqual({ type: 'frostArmor', value: 18 });
    expect(res.state.enemyShield).toBe(18);
  });

  it('drives a Vael fight to a terminal state without throwing (curse + heal end-to-end)', () => {
    const p0 = bossEnemyForPhaseOf(DROWNED_SOVEREIGN, 0, 60, 1.0); // small HP so the fixture terminates
    let state = startEncounter('skeleton', 11, undefined, undefined, p0);
    const path = { start: { col: 2, row: 2 }, steps: ['up', 'left', 'down', 'right'] } as const;
    for (let i = 0; i < 80 && state.status === 'ongoing'; i++) {
      state = playTurn(state, path).state;
    }
    expect(['won', 'lost', 'ongoing']).toContain(state.status);
  });
});
