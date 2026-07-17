/**
 * Combat-math fixtures — every expected value is hand-computed with the
 * docs/decisions.md 2026-07-15 "Combat recalibration" constants (ATTACK_BASE 3,
 * HEAL_BASE 2, GROUP_SIZE_BONUS 0.25, CASCADE_BONUS 0.25) so the curve is
 * pen-and-paper verifiable.
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
  it('single 3-match, normal affinity → 3 damage', () => {
    const fx = computeEffects([group('G', 3)], {}, CFG);
    expect(fx.damage).toBe(3); // 3 × (1+0.25×0) × 1.0 × cascade(1.0)
    expect(fx.heal).toBe(0);
    expect(fx.cascadeMultiplier).toBe(1);
    expect(fx.groups).toHaveLength(1);
    expect(fx.groups[0]).toEqual({ color: 'G', size: 3, kind: 'damage', affinity: 1.0, baseAmount: 3 });
  });

  it('4-tile group → 3.75 rounds to 4', () => {
    const fx = computeEffects([group('G', 4)], {}, CFG);
    expect(fx.groups[0].baseAmount).toBe(3.75); // 3 × 1.25 × 1.0
    expect(fx.damage).toBe(4); // round(3.75)
  });

  it('5-tile group → 4.5 rounds to 5 (round-half-up)', () => {
    const fx = computeEffects([group('G', 5)], {}, CFG);
    expect(fx.groups[0].baseAmount).toBe(4.5); // 3 × 1.5
    expect(fx.damage).toBe(5); // round(4.5)
  });

  it('multi-group single wave: two 3-matches → 8 damage (×1.25)', () => {
    const fx = computeEffects([group('G', 3), group('B', 3)], {}, CFG);
    expect(fx.cascadeMultiplier).toBe(1.25); // 1 + 0.25×(2−1)
    expect(fx.damage).toBe(8); // (3+3) × 1.25 = 7.5 → round 8
  });

  it('multi-wave cascade: three 3-matches → 14 damage (×1.5)', () => {
    const fx = computeEffects([group('G', 3), group('B', 3), group('Y', 3)], {}, CFG);
    expect(fx.cascadeMultiplier).toBe(1.5); // 1 + 0.25×(3−1)
    expect(fx.damage).toBe(14); // 9 × 1.5 = 13.5 → round 14
  });

  it('rounds ONCE at the aggregate: two 4-matches → round(7.5×1.25)=9, NOT 10', () => {
    // Per-group 3.75 each; sum 7.5; ×1.25 = 9.375 → round 9.
    // (Rounding per-group first would give 4+4=8 → ×1.25=10 → 10. We do not.)
    const fx = computeEffects([group('G', 4), group('B', 4)], {}, CFG);
    expect(fx.damage).toBe(9);
  });
});

describe('computeEffects — affinity multipliers on a single 3-match', () => {
  it('weak 2.0 → 6, normal 1.0 → 3, resist 0.5 → 2, immune 0.0 → 0', () => {
    expect(computeEffects([group('R', 3)], { R: 2.0 }, CFG).damage).toBe(6); // 3 × 2.0
    expect(computeEffects([group('R', 3)], {}, CFG).damage).toBe(3); // 3 × 1.0
    expect(computeEffects([group('R', 3)], { R: 0.5 }, CFG).damage).toBe(2); // 3 × 0.5 = 1.5 → round 2
    expect(computeEffects([group('R', 3)], { R: 0.0 }, CFG).damage).toBe(0); // 3 × 0.0
  });
});

describe('computeEffects — heal math', () => {
  it('single 3-match P → 2 heal, 0 damage', () => {
    const fx = computeEffects([group('P', 3)], {}, CFG);
    expect(fx.heal).toBe(2); // 2 × 1.0 × cascade(1.0)
    expect(fx.damage).toBe(0);
    expect(fx.groups[0].kind).toBe('heal');
  });

  it('4-tile P → 2.5 rounds to 3 (round-half-up)', () => {
    const fx = computeEffects([group('P', 4)], {}, CFG);
    expect(fx.heal).toBe(3); // round(2 × 1.25) = round(2.5)
  });
});

describe('computeEffects — heal groups feed the cascade multiplier (dedicated fixture)', () => {
  it('adding a heal group RAISES damage on the other groups', () => {
    // Two damage 3-matches, WITHOUT a heal group: totalCombos=2 → ×1.25.
    const withoutHeal = computeEffects([group('G', 3), group('B', 3)], {}, CFG);
    // Same two damage groups PLUS a heal group: totalCombos=3 → ×1.5.
    const withHeal = computeEffects([group('G', 3), group('B', 3), group('P', 3)], {}, CFG);

    expect(withoutHeal.damage).toBe(8); // (3+3) × 1.25 = 7.5 → round 8
    expect(withHeal.damage).toBe(9); // (3+3) × 1.5 = 9 — the heal group lifted the multiplier
    expect(withHeal.damage).toBeGreaterThan(withoutHeal.damage);
    expect(withHeal.heal).toBe(3); // round(2 × 1.5) = round(3)
  });
});

describe('computeEffects — per-group damage ≥0 clamp (decisions.md 2026-07-17 R3)', () => {
  // A relic fold that subtracts 4 from every damage group's pre-cascade amount — mimics a large
  // negative ADDITIVE fold (e.g. zenith-chalice's −2/group). Without the clamp a small group folds
  // NEGATIVE and would eat a healthy group's damage in the sum, or heal the enemy outright.
  const minus4 = { damageGroup: (base: number): number => base - 4 };

  it('clamps a negatively-folded single group at 0 (never heals the enemy)', () => {
    // R size 3, normal affinity → base 3; fold 3 − 4 = −1 → clamped to 0.
    expect(computeEffects([group('R', 3)], {}, CFG, minus4).damage).toBe(0);
  });

  it('a clamped group does not subtract from a healthy group in the sum', () => {
    // R(3) normal → base 3, fold −1 → clamp 0.  G(3) weak ×2 → base 6, fold 2 (stays positive).
    // totalCombos 2 ⇒ ×1.25. Clamped: (0 + 2) × 1.25 = 2.5 → round 3. Unclamped would be
    // (−1 + 2) × 1.25 = 1.25 → round 1 — the clamp is exactly what makes this 3, not 1.
    const fx = computeEffects([group('R', 3), group('G', 3)], { G: 2.0 }, CFG, minus4);
    expect(fx.damage).toBe(3);
  });

  it('is byte-identical when the fold stays non-negative (clamp is a no-op)', () => {
    const plus2 = { damageGroup: (base: number): number => base + 2 };
    expect(computeEffects([group('R', 3)], {}, CFG, plus2).damage).toBe(5); // 3 + 2, unclamped
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
