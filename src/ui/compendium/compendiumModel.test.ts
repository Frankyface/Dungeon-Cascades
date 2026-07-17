/**
 * Compendium view-model fidelity tests. Every expected number is HAND-COMPUTED from the real
 * engine registries and scaling formulas, so a balance change in `config.ts` / `runConfig.ts` /
 * `boss.ts` surfaces as a diff here (the whole point of a data-driven compendium).
 *
 * RE-RECORDED for the STAGE-6 sim-wave locked constants (HP_DIFFICULTY_DAMPEN 0.2→0.12,
 * ATTACK_DIFFICULTY_DAMPEN 0.15→0.10, ELITE_HP_MULT 1.3→1.15, ELITE_ATTACK_MULT 1.2→1.1,
 * BOSS_HP_DAMPEN 0.3→0.22). These pins cover only the three BASE enemies + the Bone Colossus
 * (Act-1 dungeon), none of which the 2026-07-17 biome-fairness amendment touches.
 * Elite sample floor = 6 ⇒ difficultyAt(6) = 1 + 0.15·6 = 1.9:
 *   hpMult(elite)  = (1 + (1.9−1)·0.12)·1.15 = 1.108·1.15 = 1.2742
 *   atkMult(elite) = (1 + (1.9−1)·0.10)·1.1  = 1.09·1.1  = 1.199
 * Boss floor = 12 ⇒ difficultyAt(12) = 2.8 ⇒ maxHp = round(120·1.396) = 168;
 *   phase atkMult = 1 + (2.8−1)·0.10 = 1.18.
 */
import { RELIC_IDS, getRelic } from '../../engine/run';
import { ENEMY_IDS, getEnemy } from '../../engine/combat';
import {
  BOSS_GLYPH,
  ELITE_SAMPLE_FLOOR,
  bossPhaseHpBands,
  compendiumBoss,
  compendiumEnemies,
  compendiumEnemy,
  compendiumRelics,
  intentStepLabel,
  scriptCycleText,
} from './compendiumModel';

describe('intentStepLabel / scriptCycleText', () => {
  it('labels each intent verb compactly, reusing the combat icons', () => {
    expect(intentStepLabel({ type: 'attack', value: 8 })).toBe('⚔ 8');
    expect(intentStepLabel({ type: 'charge', value: 0 })).toBe('⚡ charge');
    expect(intentStepLabel({ type: 'heal', value: 8 })).toBe('✚ heal 8');
  });

  it('renders a script as a looping cycle ending in "repeat"', () => {
    expect(scriptCycleText([{ type: 'attack', value: 8 }])).toBe('⚔ 8 → repeat');
    expect(
      scriptCycleText([
        { type: 'attack', value: 8 },
        { type: 'charge', value: 0 },
        { type: 'attack', value: 16 },
      ]),
    ).toBe('⚔ 8 → ⚡ charge → ⚔ 16 → repeat');
  });

  it('is empty for an empty script', () => {
    expect(scriptCycleText([])).toBe('');
  });
});

describe('compendiumRelics — all 88, from relicPresentation', () => {
  it('covers the whole roster in canonical order', () => {
    const cards = compendiumRelics();
    expect(cards).toHaveLength(88); // migration: 12 base + 76 expansion
    expect(cards.map((c) => c.id)).toEqual([...RELIC_IDS]);
  });

  it('carries the derived effect text and tier badge for a relic', () => {
    const card = compendiumRelics().find((c) => c.id === 'cascade-sigil');
    expect(card?.tier).toBe('epic');
    expect(card?.effect).toBe('+6% damage per extra combo');
  });

  it('never drifts from the registry name for any relic', () => {
    for (const card of compendiumRelics()) {
      expect(card.name).toBe(getRelic(card.id).name);
    }
  });
});

describe('compendiumEnemy — base stats + affinity + intent cycle', () => {
  it('reads the real Skeleton: 120 HP, 8/charge/16 cycle, weak B / resist R', () => {
    const skeleton = compendiumEnemy('skeleton');
    expect(skeleton.baseHp).toBe(120);
    expect(skeleton.baseHp).toBe(getEnemy('skeleton').maxHp); // sourced from the registry, not a copy
    expect(skeleton.scriptCycle).toBe('⚔ 8 → ⚡ charge → ⚔ 16 → repeat');
    expect(skeleton.affinity.weak.map((c) => c.label)).toEqual(['🔵×2']);
    expect(skeleton.affinity.resist.map((c) => c.label)).toEqual(['🔴×½']);
  });

  it('reads the real Slime: 80 HP, attack-8 cycle, weak R only', () => {
    const slime = compendiumEnemy('slime');
    expect(slime.baseHp).toBe(80);
    expect(slime.scriptCycle).toBe('⚔ 8 → repeat');
    expect(slime.affinity.weak.map((c) => c.label)).toEqual(['🔴×2']);
    expect(slime.affinity.resist).toHaveLength(0);
  });

  it('reads the real Bat: 90 HP, attack/self-heal cycle, weak G / resist B', () => {
    const bat = compendiumEnemy('bat');
    expect(bat.baseHp).toBe(90);
    expect(bat.scriptCycle).toBe('⚔ 6 → ✚ heal 8 → repeat');
    expect(bat.affinity.weak.map((c) => c.label)).toEqual(['🟢×2']);
    expect(bat.affinity.resist.map((c) => c.label)).toEqual(['🔵×½']);
  });
});

describe('compendiumEnemy — elite-scaled example at the mid-run floor', () => {
  it('labels the sample floor used', () => {
    expect(ELITE_SAMPLE_FLOOR).toBe(6);
    expect(compendiumEnemy('skeleton').elite.floor).toBe(6);
  });

  it('scales the Skeleton to 153 HP and 10/charge/19 at floor 6', () => {
    // hp = round(120·1.2742) = 153; attacks round(8·1.199)=10, round(16·1.199)=19; charge stays 0.
    const elite = compendiumEnemy('skeleton').elite;
    expect(elite.hp).toBe(153);
    expect(elite.scriptCycle).toBe('⚔ 10 → ⚡ charge → ⚔ 19 → repeat');
  });

  it('scales the Slime (102 HP) and Bat (115 HP, heal→10) at floor 6', () => {
    expect(compendiumEnemy('slime').elite.hp).toBe(102); // round(80·1.2742)
    expect(compendiumEnemy('slime').elite.scriptCycle).toBe('⚔ 10 → repeat'); // round(8·1.199)=10
    const bat = compendiumEnemy('bat').elite;
    expect(bat.hp).toBe(115); // round(90·1.2742)
    expect(bat.scriptCycle).toBe('⚔ 7 → ✚ heal 10 → repeat'); // atk round(6·1.199)=7, heal round(8·1.199)=10
  });
});

describe('compendiumEnemies — the full roster', () => {
  it('has all three enemies in registry order', () => {
    expect(compendiumEnemies().map((e) => e.id)).toEqual([...ENEMY_IDS]);
    expect(compendiumEnemies().map((e) => e.id)).toEqual(['slime', 'skeleton', 'bat']);
  });
});

describe('bossPhaseHpBands — derived from the engine thresholds', () => {
  it('partitions 185 HP into the three phase bands with no gaps or overlap', () => {
    const bands = bossPhaseHpBands(185);
    expect(bands).toEqual([
      { low: 123, high: 185 }, // phase 0: > 66%
      { low: 62, high: 122 }, //  phase 1: (33%, 66%]
      { low: 0, high: 61 }, //    phase 2: <= 33%
    ]);
  });
});

describe('compendiumBoss — Bone Colossus, floor-scaled', () => {
  const boss = compendiumBoss();

  it('is the Bone Colossus at floor 12, 168 HP scaled from 120 base', () => {
    expect(boss.name).toBe('Bone Colossus');
    expect(boss.glyph).toBe(BOSS_GLYPH);
    expect(boss.floor).toBe(12);
    expect(boss.baseHp).toBe(120);
    expect(boss.maxHp).toBe(168); // round(120·1.396), BOSS_HP_DAMPEN 0.3→0.22 re-record
  });

  it('has three phases with the scripted affinity shift and scaled scripts', () => {
    expect(boss.phases.map((p) => p.name)).toEqual(['Rising', 'Hardened', 'Enraged']);

    // Phase 0 "Rising": weak R, HP band 168–111, scaled script (atk ×1.18).
    expect(boss.phases[0].hpBand).toBe('168–111 HP');
    expect(boss.phases[0].affinity.weak.map((c) => c.label)).toEqual(['🔴×2']);
    expect(boss.phases[0].scriptCycle).toBe('⚔ 12 → ⚡ charge → ⚔ 24 → repeat'); // round(10·1.18)=12, round(20·1.18)=24

    // Phase 1 "Hardened": the shift — resists R, weak B; HP band 110–56.
    expect(boss.phases[1].hpBand).toBe('110–56 HP');
    expect(boss.phases[1].affinity.weak.map((c) => c.label)).toEqual(['🔵×2']);
    expect(boss.phases[1].affinity.resist.map((c) => c.label)).toEqual(['🔴×½']);
    expect(boss.phases[1].scriptCycle).toBe('⚔ 17 → ⚔ 17 → ⚡ charge → ⚔ 31 → repeat'); // round(14·1.18)=17, round(26·1.18)=31

    // Phase 2 "Enraged": weak Y; HP band 55–0.
    expect(boss.phases[2].hpBand).toBe('55–0 HP');
    expect(boss.phases[2].affinity.weak.map((c) => c.label)).toEqual(['🟡×2']);
    expect(boss.phases[2].scriptCycle).toBe('⚔ 24 → ⚔ 28 → repeat'); // round(20·1.18)=24, round(24·1.18)=28
  });

  it('surfaces the telegraph fairness note', () => {
    expect(boss.fairnessNote.toLowerCase()).toContain('telegraph');
    expect(boss.fairnessNote.toLowerCase()).toContain('fires');
  });
});
