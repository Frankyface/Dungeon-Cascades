/**
 * Data-driven tile-effect layer + the pure combat math.
 *
 * TAXONOMY (docs/decisions.md — offense-first affinity model): R/G/B/Y are
 * elemental DAMAGE colors checked against a per-enemy affinity table; P is the one
 * utility color, HEAL. The color→verb mapping lives in the `TILE_EFFECTS` data
 * table and the per-verb amount formula lives in `EFFECT_AMOUNT`, so adding a future
 * verb (e.g. Block) is a data entry + one handler — not an engine rewrite.
 *
 * ROUNDING (the single-rounding-site rule, flagged because fixtures depend on it):
 * per-group amounts stay at full float precision; the cascade multiplier is applied
 * to the SUMMED damage and SUMMED heal; the aggregate `damage` and aggregate `heal`
 * are each rounded ONCE with Math.round (round-half-up). Rounding per-group first is
 * deliberately NOT done — it would change multi-group totals.
 *
 * PURE ENGINE: no React / React Native imports; deterministic; never mutates input.
 */
import { MATCH_MIN } from '../board';
import type { CombatConfig } from './config';
import type { CombatModifiers } from './modifiers';
import type {
  AffinityTable,
  ClearedGroup,
  CombatEffects,
  EffectKind,
  GroupEffect,
  TileColor,
} from './types';

/** The data-driven color → combat-verb table. Adding a verb = one more entry. */
export const TILE_EFFECTS: Record<TileColor, { readonly kind: EffectKind }> = {
  R: { kind: 'damage' },
  G: { kind: 'damage' },
  B: { kind: 'damage' },
  Y: { kind: 'damage' },
  P: { kind: 'heal' },
};

/**
 * Look up a color's affinity multiplier against a table. A color ABSENT from the
 * table is `normal` (1.0). Supported tiers: weak 2.0 / normal 1.0 / resist 0.5 /
 * immune 0.0 (any non-negative number is honored).
 */
export function affinityMultiplier(table: AffinityTable, color: TileColor): number {
  const value = table[color];
  return value === undefined ? 1.0 : value;
}

/** Group-size scaling shared by every verb: `1 + GROUP_SIZE_BONUS × (size − 3)`. */
function sizeBonus(size: number, config: CombatConfig): number {
  return 1 + config.groupSizeBonus * (size - MATCH_MIN);
}

/**
 * Per-verb pre-cascade amount handlers. Each returns ONE group's contribution
 * before the cascade multiplier. Adding a verb adds one handler here.
 */
const EFFECT_AMOUNT: Record<EffectKind, (size: number, affinity: number, config: CombatConfig) => number> = {
  damage: (size, affinity, config) => config.attackBase * sizeBonus(size, config) * affinity,
  heal: (size, _affinity, config) => config.healBase * sizeBonus(size, config),
};

/**
 * Compute the combat effect of a move from its cleared groups (already flattened
 * across every cascade wave). `totalCombos` — which drives the cascade multiplier —
 * is `groups.length`, i.e. it counts ALL groups, heal groups included, exactly as
 * the board engine's `MoveResolution.totalCombos` does. Pure; never mutates input.
 *
 * `modifiers` is the OPTIONAL Stage-3 relic seam (see modifiers.ts): when omitted (or
 * with its transforms omitted), this function is byte-identical to the Stage-2 engine.
 * When supplied, each group's post-affinity, PRE-cascade amount is passed through the
 * relevant transform before summing — the cascade multiplier and the single-rounding
 * site are unchanged, so relic bonuses cascade-scale and round exactly like base damage.
 */
export function computeEffects(
  groups: readonly ClearedGroup[],
  affinity: AffinityTable,
  config: CombatConfig,
  modifiers?: CombatModifiers,
): CombatEffects {
  const totalCombos = groups.length;
  const cascadeMultiplier = totalCombos > 0 ? 1 + config.cascadeBonus * (totalCombos - 1) : 1;

  const breakdown: GroupEffect[] = [];
  let rawDamage = 0;
  let rawHeal = 0;

  for (const g of groups) {
    const size = g.positions.length;
    const kind = TILE_EFFECTS[g.color].kind;
    const affinityUsed = kind === 'damage' ? affinityMultiplier(affinity, g.color) : 1;
    const baseAmount = EFFECT_AMOUNT[kind](size, affinityUsed, config);

    // Relic seam: transform the group amount when a modifier is supplied; otherwise the
    // amount is the untouched Stage-2 value (identity ⇒ byte-identical behavior).
    let amount = baseAmount;
    if (kind === 'heal') {
      if (modifiers?.healGroup) amount = modifiers.healGroup(baseAmount, size, totalCombos);
      rawHeal += amount;
    } else {
      if (modifiers?.damageGroup) amount = modifiers.damageGroup(baseAmount, g.color, size, totalCombos);
      rawDamage += amount;
    }

    breakdown.push({ color: g.color, size, kind, affinity: affinityUsed, baseAmount: amount });
  }

  return {
    groups: breakdown,
    cascadeMultiplier,
    damage: Math.round(rawDamage * cascadeMultiplier),
    heal: Math.round(rawHeal * cascadeMultiplier),
  };
}
