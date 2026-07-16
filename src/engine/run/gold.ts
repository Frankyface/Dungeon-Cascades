/**
 * Performance-scaled gold: fighting well literally pays better (the tile-taxonomy
 * decision's "skill-earned economy" concession — gold TILES were dropped, so the economy
 * rewards combat skill without diluting the board).
 *
 *   reward = (base + speedBonus + hpBonus) × (elite ? eliteMult : 1)
 *     speedBonus = speedBonusMax × clamp((medianTurns − turns) / (medianTurns − 1), 0, 1)
 *     hpBonus    = hpBonusMax    × clamp(hpRetained / maxHp, 0, 1)
 *
 * The `onGoldEarned` relic hook folds in last, and the whole thing is rounded ONCE at the
 * aggregate (economy's single-rounding-site rule) via `applyGoldRelics`, which also floors
 * at 0. Constants live in economyConfig.ts (sim-tunable). Pure and deterministic.
 *
 * PURE ENGINE: no React / React Native imports; deterministic; never mutates input.
 */
import { applyGoldRelics } from './relicHooks';
import type { RelicRegistry } from './relicTypes';
import { DEFAULT_ECONOMY_CONFIG } from './economyConfig';
import type { EconomyConfig } from './economyConfig';

/** Clamp `x` into [lo, hi]. */
function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** The performance inputs to a gold reward (all from the just-won encounter). */
export interface GoldContext {
  /** Turns the fight took to win (fewer than the median pays more). */
  readonly turns: number;
  /** Player HP remaining after the fight (more retained pays more). */
  readonly hpRetained: number;
  /** Player max HP (the HP bonus is measured as a fraction of this). */
  readonly maxHp: number;
  /** Elites pay the elite multiplier on the whole reward. */
  readonly isElite: boolean;
}

/**
 * Compute the gold an encounter win pays. `relicIds` are the player's owned relics (the
 * `onGoldEarned` hook is applied to the raw float before the single rounding). Deterministic
 * and side-effect free.
 */
export function computeGoldReward(
  context: GoldContext,
  relicIds: readonly string[],
  config: EconomyConfig = DEFAULT_ECONOMY_CONFIG,
  registry?: RelicRegistry,
): number {
  const { turns, hpRetained, maxHp, isElite } = context;

  const speedDenom = Math.max(1, config.goldMedianTurns - 1);
  const speedFraction = clamp((config.goldMedianTurns - turns) / speedDenom, 0, 1);
  const speedBonus = config.goldSpeedBonusMax * speedFraction;

  const hpFraction = maxHp > 0 ? clamp(hpRetained / maxHp, 0, 1) : 0;
  const hpBonus = config.goldHpBonusMax * hpFraction;

  const raw = (config.goldBase + speedBonus + hpBonus) * (isElite ? config.eliteGoldMult : 1);

  // applyGoldRelics folds `onGoldEarned`, rounds once, and floors at 0.
  return registry === undefined ? applyGoldRelics(raw, relicIds) : applyGoldRelics(raw, relicIds, registry);
}
