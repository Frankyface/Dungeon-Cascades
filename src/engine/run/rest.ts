/**
 * Rest sites: heal a fraction of MAX HP once per node. The heal amount is
 * REST_HEAL_FRACTION of max (rounded), capped at max HP; a `RestState` tracks the
 * single-use invariant so the state machine can reject a second rest at the same node.
 *
 * PURE ENGINE: no React / React Native imports; deterministic; never mutates input.
 */
import { DEFAULT_ECONOMY_CONFIG } from './economyConfig';
import type { EconomyConfig } from './economyConfig';

/** Serializable rest-site state: whether this node's single rest has been consumed. */
export interface RestState {
  readonly rested: boolean;
}

/** A fresh (unused) rest state. */
export function createRestState(): RestState {
  return { rested: false };
}

/** New HP after resting: `hp + round(maxHp × fraction)`, capped at `maxHp`. Pure. */
export function restHeal(hp: number, maxHp: number, config: EconomyConfig = DEFAULT_ECONOMY_CONFIG): number {
  const healed = Math.round(maxHp * config.restHealFraction);
  return Math.min(maxHp, hp + healed);
}

/** The result of resting: the new HP and the (now-used) rest state. */
export interface RestResult {
  readonly hp: number;
  readonly state: RestState;
}

/**
 * Consume this node's rest: heal and flip the state to used. Throws if the node has already
 * been rested at (single-use invariant — boundary validation so a UI double-tap fails loud).
 */
export function applyRest(
  state: RestState,
  hp: number,
  maxHp: number,
  config: EconomyConfig = DEFAULT_ECONOMY_CONFIG,
): RestResult {
  if (state.rested) {
    throw new Error('applyRest: already rested at this site (single-use per node)');
  }
  return { hp: restHeal(hp, maxHp, config), state: { rested: true } };
}
