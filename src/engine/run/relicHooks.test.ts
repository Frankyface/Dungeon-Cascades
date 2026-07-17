/**
 * Relic-hook engine fixtures. Pins the documented composition law
 *     value' = (value + Σ add) × Π (1 + mul)
 * — additive strictly before multiplicative, order-independent within a class — against
 * hand-computed outcomes, using both a synthetic registry (to isolate the law) and 2–3
 * stacked REAL roster relics. Also covers color/kind/perCombo conditions and the
 * combat-start / turn-start / gold helper folds.
 */
import {
  applyGoldRelics,
  applyRelicHooks,
  combatStartEnemyChip,
  combatStartPlayerHeal,
  turnStartRegen,
} from './relicHooks';
import type { Relic, RelicRegistry } from './relicTypes';

/** Synthetic relics to isolate the composition law from roster balance. */
const SYNTH: RelicRegistry = {
  addA: relic('addA', { onDamageComputed: { op: 'add', amount: 3 } }),
  addB: relic('addB', { onDamageComputed: { op: 'add', amount: 5 } }),
  mulC: relic('mulC', { onDamageComputed: { op: 'mul', amount: 0.5 } }), // ×1.5
  mulD: relic('mulD', { onDamageComputed: { op: 'mul', amount: 1.0 } }), // ×2.0
};
function relic(id: string, hooks: Relic['hooks']): Relic {
  return { id, name: id, flavor: '.', tier: 'common', hooks };
}

describe('applyRelicHooks — composition law (synthetic)', () => {
  it('applies all additives first, then the product of multipliers', () => {
    // (10 + 3 + 5) × (1.5 × 2.0) = 18 × 3 = 54.
    expect(applyRelicHooks('onDamageComputed', 10, {}, ['addA', 'addB', 'mulC', 'mulD'], SYNTH)).toBeCloseTo(54, 10);
  });

  it('is order-independent within each op class', () => {
    const a = applyRelicHooks('onDamageComputed', 10, {}, ['addA', 'addB', 'mulC', 'mulD'], SYNTH);
    const b = applyRelicHooks('onDamageComputed', 10, {}, ['mulD', 'mulC', 'addB', 'addA'], SYNTH);
    const c = applyRelicHooks('onDamageComputed', 10, {}, ['addB', 'mulD', 'addA', 'mulC'], SYNTH);
    expect(b).toBeCloseTo(a, 10);
    expect(c).toBeCloseTo(a, 10);
  });

  it('is identity with no relics owned', () => {
    expect(applyRelicHooks('onDamageComputed', 42, {}, [], SYNTH)).toBe(42);
  });

  it('ignores unknown ids (inert)', () => {
    expect(applyRelicHooks('onDamageComputed', 10, {}, ['ghost'], SYNTH)).toBe(10);
  });
});

describe('applyRelicHooks — conditions (real roster relics)', () => {
  it('color-keyed damage relic applies only to its color', () => {
    // Emberfang = ×1.5 on Red only.
    expect(applyRelicHooks('onDamageComputed', 10, { color: 'R' }, ['emberfang'])).toBeCloseTo(15, 10);
    expect(applyRelicHooks('onDamageComputed', 10, { color: 'G' }, ['emberfang'])).toBe(10);
  });

  it('perCombo relic scales with (totalCombos − 1)', () => {
    // Cascade Sigil = ×(1 + 0.06×(combos−1)).
    expect(applyRelicHooks('onDamageComputed', 10, { totalCombos: 1 }, ['cascade-sigil'])).toBeCloseTo(10, 10);
    expect(applyRelicHooks('onDamageComputed', 10, { totalCombos: 4 }, ['cascade-sigil'])).toBeCloseTo(11.8, 10);
  });

  it('kind-keyed combat-start relics apply only on their channel', () => {
    expect(applyRelicHooks('onCombatStart', 0, { kind: 'enemyChip' }, ['ambushers-cowl'])).toBe(10);
    expect(applyRelicHooks('onCombatStart', 0, { kind: 'playerHeal' }, ['ambushers-cowl'])).toBe(0);
  });
});

describe('applyRelicHooks — 2–3 stacked REAL relics (hand-computed)', () => {
  it('additive-before-multiplicative with Emberfang (×1.5 R) + Whetstone (+2)', () => {
    // Red group base 10, combos 1: (10 + 2) × 1.5 = 18.
    expect(applyRelicHooks('onDamageComputed', 10, { color: 'R', totalCombos: 1 }, ['emberfang', 'whetstone-charm'])).toBeCloseTo(18, 10);
    // Green group: Emberfang misses, Whetstone still adds: (10 + 2) × 1 = 12.
    expect(applyRelicHooks('onDamageComputed', 10, { color: 'G', totalCombos: 1 }, ['emberfang', 'whetstone-charm'])).toBeCloseTo(12, 10);
  });

  it('three-stack Emberfang + Whetstone + Cascade Sigil on a red 3-combo group', () => {
    // (10 + 2) × (1.5 × (1 + 0.06×2)) = 12 × (1.5 × 1.12) = 12 × 1.68 = 20.16.
    const v = applyRelicHooks('onDamageComputed', 10, { color: 'R', totalCombos: 3 }, [
      'emberfang',
      'whetstone-charm',
      'cascade-sigil',
    ]);
    expect(v).toBeCloseTo(20.16, 10);
  });
});

describe('combat-start / turn-start / gold helpers', () => {
  it('combatStartEnemyChip / PlayerHeal read their channels independently', () => {
    expect(combatStartEnemyChip(['ambushers-cowl'])).toBe(10);
    expect(combatStartPlayerHeal(['ambushers-cowl'])).toBe(0);
    expect(combatStartPlayerHeal(['phoenix-feather'])).toBe(8);
    expect(combatStartEnemyChip(['ambushers-cowl', 'phoenix-feather'])).toBe(10);
    expect(combatStartPlayerHeal(['ambushers-cowl', 'phoenix-feather'])).toBe(8);
  });

  it('turnStartRegen reads the regen channel; 0 without the relic', () => {
    expect(turnStartRegen(['second-wind'])).toBe(1);
    expect(turnStartRegen([])).toBe(0);
  });

  it('applyGoldRelics scales gold and rounds; identity without a gold relic', () => {
    expect(applyGoldRelics(100, ["misers-knuckle"])).toBe(125); // ×1.25
    expect(applyGoldRelics(100, [])).toBe(100);
  });
});
