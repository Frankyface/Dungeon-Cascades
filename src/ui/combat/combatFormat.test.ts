import { getEnemy } from '../../engine/combat';
import type { EnemyAction, GroupEffect, TurnResolution } from '../../engine/combat';
import {
  buildAffinityChips,
  buildImpactFeedback,
  buildStatusChips,
  enemyName,
  formatEnemyAction,
  formatHp,
  formatIntent,
  formatMoveFeedback,
  formatMultiplier,
  hpFraction,
  parseEnemyId,
  rotSeepText,
} from './combatFormat';

describe('enemyName', () => {
  it('title-cases the enemy id', () => {
    expect(enemyName('slime')).toBe('Slime');
    expect(enemyName('skeleton')).toBe('Skeleton');
    expect(enemyName('bat')).toBe('Bat');
  });
});

describe('parseEnemyId', () => {
  it('accepts the three known enemy ids', () => {
    expect(parseEnemyId('slime')).toBe('slime');
    expect(parseEnemyId('skeleton')).toBe('skeleton');
    expect(parseEnemyId('bat')).toBe('bat');
  });

  it('rejects unknown or missing params', () => {
    expect(parseEnemyId('dragon')).toBeNull();
    expect(parseEnemyId('')).toBeNull();
    expect(parseEnemyId(undefined)).toBeNull();
  });
});

describe('formatMultiplier', () => {
  it('renders the documented tiers', () => {
    expect(formatMultiplier(2)).toBe('×2');
    expect(formatMultiplier(0.5)).toBe('×½');
    expect(formatMultiplier(0)).toBe('×0');
  });

  it('trims tuned decimals', () => {
    expect(formatMultiplier(1.5)).toBe('×1.5');
    expect(formatMultiplier(3)).toBe('×3');
  });
});

describe('buildAffinityChips', () => {
  it('splits the real Skeleton table into weak (B) and resist (R)', () => {
    // Skeleton: resist R (0.5×), weak B (2×) — from the engine registry.
    const chips = buildAffinityChips(getEnemy('skeleton').affinity);
    expect(chips.weak.map((c) => c.color)).toEqual(['B']);
    expect(chips.weak[0].label).toBe('🔵×2');
    expect(chips.resist.map((c) => c.color)).toEqual(['R']);
    expect(chips.resist[0].label).toBe('🔴×½');
    expect(chips.immune).toHaveLength(0);
  });

  it('handles the real Slime (weak R only, no resists)', () => {
    const chips = buildAffinityChips(getEnemy('slime').affinity);
    expect(chips.weak.map((c) => c.label)).toEqual(['🔴×2']);
    expect(chips.resist).toHaveLength(0);
  });

  it('keeps a stable R,G,B,Y,P color order and drops normal colors', () => {
    const chips = buildAffinityChips({ Y: 2, R: 2, G: 0, B: 1 });
    // R before Y (order), B is normal → dropped, G is immune.
    expect(chips.weak.map((c) => c.color)).toEqual(['R', 'Y']);
    expect(chips.immune.map((c) => c.color)).toEqual(['G']);
  });
});

describe('formatIntent', () => {
  it('formats an attack telegraph as a badge and a sentence', () => {
    const intent = formatIntent({ type: 'attack', value: 8 });
    expect(intent.badge).toBe('⚔ 8');
    expect(intent.sentence).toBe('Attacks for 8 next turn');
    expect(intent.kind).toBe('attack');
  });

  it('formats a charge telegraph', () => {
    expect(formatIntent({ type: 'charge', value: 0 }).badge).toBe('charging…');
  });

  it('formats a heal telegraph', () => {
    expect(formatIntent({ type: 'heal', value: 5 }).badge).toBe('heals 5');
  });
});

describe('formatEnemyAction', () => {
  it('describes each fired action, and defeat when null', () => {
    expect(formatEnemyAction('slime', { type: 'attack', value: 6 })).toBe('Slime attacks for 6');
    expect(formatEnemyAction('skeleton', { type: 'charge', value: 0 })).toBe('Skeleton is charging…');
    expect(formatEnemyAction('bat', { type: 'heal', value: 5 })).toBe('Bat heals 5');
    expect(formatEnemyAction('slime', null)).toBe('Slime is defeated');
  });
});

/**
 * Minimal TurnResolution stub carrying only the fields the formatters read. `effectiveDamage` /
 * `effectiveHeal` default to the raw `damage` / `heal` and the mitigation fields to 0 — override
 * them for the biome-channel cases.
 */
function resolutionWith(
  fields: Partial<TurnResolution> & { groups: readonly GroupEffect[]; damage: number; heal: number },
): TurnResolution {
  return {
    effectiveDamage: fields.damage,
    effectiveHeal: fields.heal,
    shieldAbsorbed: 0,
    armorAbsorbed: 0,
    rotTick: 0,
    ...fields,
  } as TurnResolution;
}

function damageGroup(color: GroupEffect['color'], affinity: number): GroupEffect {
  return { color, size: 3, kind: 'damage', affinity, baseAmount: 10 * affinity };
}

describe('formatMoveFeedback', () => {
  it('reports damage and a weakness callout when a weakness color is hit', () => {
    const fb = formatMoveFeedback(
      resolutionWith({ groups: [damageGroup('B', 2)], damage: 20, heal: 0 }),
    );
    expect(fb.damage).toBe(20);
    expect(fb.didDamage).toBe(true);
    expect(fb.weaknessHit).toBe(true);
    expect(fb.weaknessColors).toEqual(['B']);
    expect(fb.weaknessCallout).toBe('🔵 Weakness!');
  });

  it('no weakness callout for a normal-affinity hit, and reports heal', () => {
    const fb = formatMoveFeedback(
      resolutionWith({
        groups: [damageGroup('R', 1), { color: 'P', size: 3, kind: 'heal', affinity: 1, baseAmount: 5 }],
        damage: 10,
        heal: 5,
      }),
    );
    expect(fb.weaknessHit).toBe(false);
    expect(fb.weaknessCallout).toBe('');
    expect(fb.didHeal).toBe(true);
  });

  it('dedupes multiple weakness groups of the same color', () => {
    const fb = formatMoveFeedback(
      resolutionWith({ groups: [damageGroup('B', 2), damageGroup('B', 2)], damage: 50, heal: 0 }),
    );
    expect(fb.weaknessColors).toEqual(['B']);
  });

  it('reports EFFECTIVE damage/heal + mitigation (shield absorb + curse halving)', () => {
    const fb = formatMoveFeedback(
      resolutionWith({ groups: [], damage: 20, heal: 10, effectiveDamage: 6, effectiveHeal: 5, shieldAbsorbed: 14 }),
    );
    expect(fb.damage).toBe(6); // what actually reached HP, not the raw 20
    expect(fb.heal).toBe(5); // curse-halved
    expect(fb.shieldAbsorbed).toBe(14);
    expect(fb.curseHalved).toBe(true);
  });
});

describe('buildImpactFeedback', () => {
  it('calls out shield absorption on the damage line', () => {
    const fb = buildImpactFeedback(
      resolutionWith({ groups: [], damage: 20, heal: 0, effectiveDamage: 6, shieldAbsorbed: 14 }),
    );
    expect(fb.main).toBe('−6 damage (14 absorbed by shield)');
    expect(fb.tone).toBe('damage');
  });

  it('calls out the curse on the heal line', () => {
    const fb = buildImpactFeedback(
      resolutionWith({ groups: [], damage: 0, heal: 10, effectiveHeal: 5 }),
    );
    expect(fb.main).toBe('+5 HP healed (halved by curse)');
    expect(fb.tone).toBe('heal');
  });

  it('surfaces a fully-absorbed hit instead of "no match"', () => {
    const fb = buildImpactFeedback(
      resolutionWith({ groups: [], damage: 6, heal: 0, effectiveDamage: 0, shieldAbsorbed: 6 }),
    );
    expect(fb.main).toBe('0 through (6 absorbed by shield)');
    expect(fb.tone).toBe('neutral');
  });

  it('keeps the weakness accent while showing effective numbers', () => {
    const fb = buildImpactFeedback(
      resolutionWith({ groups: [damageGroup('B', 2)], damage: 20, heal: 0, effectiveDamage: 20 }),
    );
    expect(fb.main).toBe('−20 damage');
    expect(fb.accent).toBe('🔵 Weakness!');
  });

  it('falls back to a plain no-match line when nothing landed and nothing was absorbed', () => {
    const fb = buildImpactFeedback(resolutionWith({ groups: [], damage: 0, heal: 0 }));
    expect(fb.main).toBe('No match — no damage');
    expect(fb.tone).toBe('neutral');
  });
});

describe('buildStatusChips', () => {
  it('is empty for a default-biome fight (no channels)', () => {
    expect(buildStatusChips({})).toEqual([]);
  });

  it('renders one chip per active channel with its value', () => {
    const chips = buildStatusChips({ enemyShield: 12, enemyArmor: 4, rotStacks: 3, curseTurns: 2 });
    expect(chips.map((c) => [c.key, c.label])).toEqual([
      ['shield', '12'],
      ['armor', '4'],
      ['rot', '3'],
      ['curse', '2 turns'],
    ]);
  });

  it('singularizes a 1-turn curse and drops zero/absent channels', () => {
    const chips = buildStatusChips({ enemyShield: 0, curseTurns: 1 });
    expect(chips.map((c) => c.key)).toEqual(['curse']);
    expect(chips[0].label).toBe('1 turn');
  });
});

describe('rotSeepText', () => {
  it('renders the rot DoT line', () => {
    expect(rotSeepText(3)).toBe('Rot seeps −3');
  });
});

describe('hpFraction', () => {
  it('maps hp to a clamped 0..1 fraction', () => {
    expect(hpFraction(30, 60)).toBe(0.5);
    expect(hpFraction(60, 60)).toBe(1);
    expect(hpFraction(0, 60)).toBe(0);
  });

  it('clamps out-of-range and guards a non-positive max', () => {
    expect(hpFraction(-5, 60)).toBe(0);
    expect(hpFraction(90, 60)).toBe(1);
    expect(hpFraction(10, 0)).toBe(0);
  });
});

describe('formatHp', () => {
  it('renders the hp/max label and floors negatives', () => {
    expect(formatHp(12, 30)).toBe('12/30');
    expect(formatHp(-3, 30)).toBe('0/30');
  });
});
