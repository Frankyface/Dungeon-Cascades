/**
 * Deterministic seed derivation for the sim harness.
 *
 * The engine facts we respect: board-creation and move-refill are INDEPENDENT
 * seeded streams. The harness therefore splits a single base seed into a tree of
 * well-separated sub-seeds so nothing shares entropy by accident:
 *
 *     baseSeed (--seed)
 *       └─ gameSeed(i)          = deriveSeed(baseSeed, i)          per game index i
 *            ├─ boardSeed       = deriveSeed(gameSeed, TAG_BOARD)  → createBoard   (stream A)
 *            ├─ moveSeed        = deriveSeed(gameSeed, TAG_MOVE)   → resolveMove   (stream B)
 *            └─ botSeed         = deriveSeed(gameSeed, TAG_BOT)    → bot decisions (stream C)
 *
 * `deriveSeed(seed, tag)` folds `tag` into `seed` with an odd (invertible)
 * multiplicative constant so distinct (seed, tag) pairs stay distinct, then draws
 * one uint32 from the engine's own mulberry32 to avalanche the bits. It uses ONLY
 * the engine PRNG — no Math.random, no Date.now — so the whole seed tree is a pure
 * function of the base seed.
 */
import { createRng, nextFloat } from '../board';

/** 2^32, used to recover a full uint32 from a [0,1) float draw. */
const UINT32 = 0x100000000;

/** Odd 32-bit constant (⌊2^32 / φ⌋). Multiplying by an odd number is invertible mod 2^32. */
const GOLDEN32 = 0x9e3779b1;

/** Sub-stream tags. Small distinct integers; the multiplicative fold spreads them apart. */
export const SEED_TAG_BOARD = 1;
export const SEED_TAG_MOVE = 2;
export const SEED_TAG_BOT = 3;

/**
 * Derive a uint32 sub-seed from a seed and an integer tag. Deterministic and pure.
 */
export function deriveSeed(seed: number, tag: number): number {
  const mixed = ((seed >>> 0) ^ Math.imul((tag >>> 0) + 1, GOLDEN32)) >>> 0;
  // mulberry32's first step hard-mixes the input, so a single draw suffices.
  const { value } = nextFloat(createRng(mixed));
  return (value * UINT32) >>> 0;
}

/** The seed for game `gameIndex` of a harness run rooted at `baseSeed`. */
export function gameSeedFor(baseSeed: number, gameIndex: number): number {
  return deriveSeed(baseSeed, gameIndex);
}
