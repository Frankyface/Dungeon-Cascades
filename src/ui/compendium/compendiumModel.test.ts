/**
 * Compendium view-model fidelity tests. Every expected number is HAND-COMPUTED from the real
 * engine registries and scaling formulas, so a balance change in `config.ts` / `runConfig.ts` /
 * `boss.ts` surfaces as a diff here (the whole point of a data-driven compendium).
 *
 * Elite sample floor = 6 ⇒ difficultyAt(6) = 1 + 0.15·6 = 1.9:
 *   hpMult(elite)  = (1 + (1.9−1)·0.2)·1.3 = 1.18·1.3 = 1.534
 *   atkMult(elite) = (1 + (1.9−1)·0.15)·1.2 = 1.135·1.2 = 1.362
 * Boss floor = 12 ⇒ difficultyAt(12) = 2.8 ⇒ maxHp = round(120·1.54) = 185;
 *   phase atkMult = 1 + (2.8−1)·0.15 = 1.27.
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

  it('scales the Skeleton to 184 HP and 11/charge/22 at floor 6', () => {
    // hp = round(120·1.534) = 184; attacks round(8·1.362)=11, round(16·1.362)=22; charge stays 0.
    const elite = compendiumEnemy('skeleton').elite;
    expect(elite.hp).toBe(184);
    expect(elite.scriptCycle).toBe('⚔ 11 → ⚡ charge → ⚔ 22 → repeat');
  });

  it('scales the Slime (123 HP) and Bat (138 HP, heal→11) at floor 6', () => {
    expect(compendiumEnemy('slime').elite.hp).toBe(123); // round(80·1.534)
    expect(compendiumEnemy('slime').elite.scriptCycle).toBe('⚔ 11 → repeat');
    const bat = compendiumEnemy('bat').elite;
    expect(bat.hp).toBe(138); // round(90·1.534)
    expect(bat.scriptCycle).toBe('⚔ 8 → ✚ heal 11 → repeat'); // atk round(6·1.362)=8, heal round(8·1.362)=11
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

  it('is the Bone Colossus at floor 12, 185 HP scaled from 120 base', () => {
    expect(boss.name).toBe('Bone Colossus');
    expect(boss.glyph).toBe(BOSS_GLYPH);
    expect(boss.floor).toBe(12);
    expect(boss.baseHp).toBe(120);
    expect(boss.maxHp).toBe(185);
  });

  it('has three phases with the scripted affinity shift and scaled scripts', () => {
    expect(boss.phases.map((p) => p.name)).toEqual(['Rising', 'Hardened', 'Enraged']);

    // Phase 0 "Rising": weak R, HP band 185–123, scaled script (atk ×1.27).
    expect(boss.phases[0].hpBand).toBe('185–123 HP');
    expect(boss.phases[0].affinity.weak.map((c) => c.label)).toEqual(['🔴×2']);
    expect(boss.phases[0].scriptCycle).toBe('⚔ 13 → ⚡ charge → ⚔ 25 → repeat');

    // Phase 1 "Hardened": the shift — resists R, weak B; HP band 122–62.
    expect(boss.phases[1].hpBand).toBe('122–62 HP');
    expect(boss.phases[1].affinity.weak.map((c) => c.label)).toEqual(['🔵×2']);
    expect(boss.phases[1].affinity.resist.map((c) => c.label)).toEqual(['🔴×½']);
    expect(boss.phases[1].scriptCycle).toBe('⚔ 18 → ⚔ 18 → ⚡ charge → ⚔ 33 → repeat');

    // Phase 2 "Enraged": weak Y; HP band 61–0.
    expect(boss.phases[2].hpBand).toBe('61–0 HP');
    expect(boss.phases[2].affinity.weak.map((c) => c.label)).toEqual(['🟡×2']);
    expect(boss.phases[2].scriptCycle).toBe('⚔ 25 → ⚔ 30 → repeat');
  });

  it('surfaces the telegraph fairness note', () => {
    expect(boss.fairnessNote.toLowerCase()).toContain('telegraph');
    expect(boss.fairnessNote.toLowerCase()).toContain('fires');
  });
});
