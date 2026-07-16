/**
 * Combat-math fixtures — every expected value is hand-computed with the
 * docs/decisions.md defaults (ATTACK_BASE 10, HEAL_BASE 5, GROUP_SIZE_BONUS 0.25,
 * CASCADE_BONUS 0.25) so the curve is pen-and-paper verifiable.
 *
 * Rounding rule under test (the single-rounding-site decision): per-group amounts
 * are kept at full float precision; the cascade multiplier is applied to the summed
 * damage and summed heal; the aggregate damage and aggregate heal are each rounded
 * ONCE with Math.round (round-half-up). Fixtures below pin that choice.
 */
import { computeEffects, TILE_EFFECTS, affinityMultiplier } from './effects';
import { DEFAULT_COMBAT_CONFIG } from './config';
import type { AffinityTable, ClearedGroup, TileColor } from './types';

const CFG = DEFAULT_COMBAT_CONFIG;

/** Build a cleared group of a given color and size (position contents are irrelevant). */
function group(color: TileColor, size: number): ClearedGroup {
  const positions = Array.from({ length: size }, (_, i) => ({ col: i % 6, row: Math.floor(i / 6) }));
  return { color, positions };
}

describe('TILE_EFFECTS — data-driven color → verb table', () => {
  it('maps R/G/B/Y to damage and P to heal', () => {
    expect(TILE_EFFECTS.R.kind).toBe('damage');
    expect(TILE_EFFECTS.G.kind).toBe('damage');
    expect(TILE_EFFECTS.B.kind).toBe('damage');
    expect(TILE_EFFECTS.Y.kind).toBe('damage');
    expect(TILE_EFFECTS.P.kind).toBe('heal');
  });
});

describe('affinityMultiplier — weak / normal / resist / immune', () => {
  it('returns the table value, defaulting absent colors to normal (1.0)', () => {
    const table: AffinityTable = { R: 2.0, B: 0.5, Y: 0.0 };
    expect(affinityMultiplier(table, 'R')).toBe(2.0); // weak
    expect(affinityMultiplier(table, 'B')).toBe(0.5); // resist
    expect(affinityMultiplier(table, 'Y')).toBe(0.0); // immune
    expect(affinityMultiplier(table, 'G')).toBe(1.0); // normal (absent)
  });
});

describe('computeEffects — damage math (hand-computed)', () => {
  it('single 3-match, normal affinity → 10 damage', () => {
    const fx = computeEffects([group('G', 3)], {}, CFG);
    expect(fx.damage).toBe(10); // 10 × (1+0.25×0) × 1.0 × cascade(1.0)
    expect(fx.heal).toBe(0);
    expect(fx.cascadeMultiplier).toBe(1);
    expect(fx.groups).toHaveLength(1);
    expect(fx.groups[0]).toEqual({ color: 'G', size: 3, kind: 'damage', affinity: 1.0, baseAmount: 10 });
  });

  it('4-tile group → 12.5 rounds to 13 (round-half-up)', () => {
    const fx = computeEffects([group('G', 4)], {}, CFG);
    expect(fx.groups[0].baseAmount).toBe(12.5); // 10 × 1.25 × 1.0
    expect(fx.damage).toBe(13); // round(12.5)
  });

  it('5-tile group → 15 damage', () => {
    const fx = computeEffects([group('G', 5)], {}, CFG);
    expect(fx.groups[0].baseAmount).toBe(15); // 10 × 1.5
    expect(fx.damage).toBe(15);
  });

  it('multi-group single wave: two 3-matches → 25 damage (×1.25)', () => {
    const fx = computeEffects([group('G', 3), group('B', 3)], {}, CFG);
    expect(fx.cascadeMultiplier).toBe(1.25); // 1 + 0.25×(2−1)
    expect(fx.damage).toBe(25); // (10+10) × 1.25
  });

  it('multi-wave cascade: three 3-matches → 45 damage (×1.5)', () => {
    const fx = computeEffects([group('G', 3), group('B', 3), group('Y', 3)], {}, CFG);
    expect(fx.cascadeMultiplier).toBe(1.5); // 1 + 0.25×(3−1)
    expect(fx.damage).toBe(45); // 30 × 1.5
  });

  it('rounds ONCE at the aggregate: two 4-matches → round(25×1.25)=31, NOT 33', () => {
    // Per-group 12.5 each; sum 25; ×1.25 = 31.25 → round 31.
    // (Rounding per-group first would give 13+13=26 → ×1.25=32.5 → 33. We do not.)
    const fx = computeEffects([group('G', 4), group('B', 4)], {}, CFG);
    expect(fx.damage).toBe(31);
  });
});

describe('computeEffects — affinity multipliers on a single 3-match', () => {
  it('weak 2.0 → 20, normal 1.0 → 10, resist 0.5 → 5, immune 0.0 → 0', () => {
    expect(computeEffects([group('R', 3)], { R: 2.0 }, CFG).damage).toBe(20);
    expect(computeEffects([group('R', 3)], {}, CFG).damage).toBe(10);
    expect(computeEffects([group('R', 3)], { R: 0.5 }, CFG).damage).toBe(5);
    expect(computeEffects([group('R', 3)], { R: 0.0 }, CFG).damage).toBe(0);
  });
});

describe('computeEffects — heal math', () => {
  it('single 3-match P → 5 heal, 0 damage', () => {
    const fx = computeEffects([group('P', 3)], {}, CFG);
    expect(fx.heal).toBe(5); // 5 × 1.0 × cascade(1.0)
    expect(fx.damage).toBe(0);
    expect(fx.groups[0].kind).toBe('heal');
  });

  it('4-tile P → 6.25 rounds to 6', () => {
    const fx = computeEffects([group('P', 4)], {}, CFG);
    expect(fx.heal).toBe(6); // round(5 × 1.25)
  });
});

describe('computeEffects — heal groups feed the cascade multiplier (dedicated fixture)', () => {
  it('adding a heal group RAISES damage on the other groups', () => {
    // Two damage 3-matches, WITHOUT a heal group: totalCombos=2 → ×1.25.
    const withoutHeal = computeEffects([group('G', 3), group('B', 3)], {}, CFG);
    // Same two damage groups PLUS a heal group: totalCombos=3 → ×1.5.
    const withHeal = computeEffects([group('G', 3), group('B', 3), group('P', 3)], {}, CFG);

    expect(withoutHeal.damage).toBe(25); // 20 × 1.25
    expect(withHeal.damage).toBe(30); // 20 × 1.5 — the heal group lifted the multiplier
    expect(withHeal.damage).toBeGreaterThan(withoutHeal.damage);
    expect(withHeal.heal).toBe(8); // round(5 × 1.5) = round(7.5)
  });
});

describe('computeEffects — degenerate inputs', () => {
  it('no groups (no-match move) → 0 damage, 0 heal, multiplier 1', () => {
    const fx = computeEffects([], {}, CFG);
    expect(fx.damage).toBe(0);
    expect(fx.heal).toBe(0);
    expect(fx.cascadeMultiplier).toBe(1);
    expect(fx.groups).toHaveLength(0);
  });

  it('does not mutate the input groups array', () => {
    const groups = [group('G', 3)];
    const snapshot = JSON.stringify(groups);
    computeEffects(groups, {}, CFG);
    expect(JSON.stringify(groups)).toBe(snapshot);
  });
});
