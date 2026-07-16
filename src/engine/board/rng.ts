/**
 * Deterministic seeded PRNG (mulberry32), written in a pure, state-threading
 * style: no hidden mutable closure and no ambient RNG. Each call takes an RngState
 * and returns the drawn value plus the advanced state. Same state ⇒ same output.
 */
import type { RngState } from './types';

/** Normalize a seed (or an existing state) into a canonical uint32 RngState. */
export function createRng(seed: number): RngState {
  return { a: seed >>> 0 };
}

/** Type guard: is this value an RngState (vs a raw numeric seed)? */
export function isRngState(value: number | RngState): value is RngState {
  return typeof value === 'object' && value !== null && typeof value.a === 'number';
}

/** Normalize `number | RngState` to an RngState. */
export function toRngState(seedOrState: number | RngState): RngState {
  return isRngState(seedOrState) ? { a: seedOrState.a >>> 0 } : createRng(seedOrState);
}

/**
 * Draw the next float in [0, 1) and return the advanced state. Pure: the input
 * state is never mutated.
 */
export function nextFloat(state: RngState): { value: number; state: RngState } {
  const a = (state.a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: { a } };
}

/**
 * Draw the next integer in [0, bound) and return the advanced state.
 * `bound` must be a positive integer.
 */
export function nextInt(state: RngState, bound: number): { value: number; state: RngState } {
  if (!Number.isInteger(bound) || bound <= 0) {
    throw new Error(`nextInt bound must be a positive integer, got ${bound}`);
  }
  const { value, state: next } = nextFloat(state);
  return { value: Math.floor(value * bound), state: next };
}
