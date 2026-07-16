/**
 * Deterministic seed derivation for the run layer (map + drafts).
 *
 * LAYERING CHOICE (justified): this MIRRORS the fold in src/engine/sim/seeds.ts rather
 * than importing it. `sim/` is the harness that DRIVES the engine; `run/` is an engine
 * module that sits above `combat/` and `board/`. Importing from `sim/` would invert the
 * dependency (engine → harness). combat/encounter.ts set this precedent — it reimplements
 * its stream split locally, "no dependency on the sim layer". We follow it: this file
 * imports ONLY board primitives, so board → combat → run stays a clean one-way stack.
 *
 * The derivation is identical in spirit to seeds.ts: fold an integer tag into a seed with
 * an odd (invertible) multiplicative constant, then draw one uint32 from the engine's own
 * mulberry32 to avalanche the bits. Pure: only the board PRNG, no Math.random/Date.now.
 */
import { createRng, nextFloat } from '../board';

/** 2^32, used to recover a full uint32 from a [0,1) float draw. */
const UINT32 = 0x100000000;

/** Odd 32-bit constant (⌊2^32 / φ⌋). Multiplying by an odd number is invertible mod 2^32. */
const GOLDEN32 = 0x9e3779b1;

/** Sub-stream tags for the run tree. Small distinct integers; the fold spreads them apart. */
export const RUN_TAG_MAP = 1;
export const RUN_TAG_DRAFT = 2;
/** Stage-3 lifecycle sub-streams (added wave 2; independent of map/draft). */
export const RUN_TAG_ENEMY = 3; // which enemy a fight/elite node rolls
export const RUN_TAG_ENCOUNTER = 4; // the fight's board + refill seed
export const RUN_TAG_SHOP = 5; // a shop node's seeded stock
export const RUN_TAG_EVENT = 6; // an event node's scripted-event draw + gamble rolls

/**
 * Derive a uint32 sub-seed from a seed and an integer tag. Deterministic and pure —
 * byte-for-byte the same construction as sim/seeds.ts `deriveSeed`.
 */
export function deriveSeed(seed: number, tag: number): number {
  const mixed = ((seed >>> 0) ^ Math.imul((tag >>> 0) + 1, GOLDEN32)) >>> 0;
  const { value } = nextFloat(createRng(mixed));
  return (value * UINT32) >>> 0;
}

/** The map-generation seed for a run rooted at `runSeed`. */
export function mapSeedFor(runSeed: number): number {
  return deriveSeed(runSeed, RUN_TAG_MAP);
}

/**
 * The draft seed for the draft offered at node number `nodeIndex` of a run rooted at
 * `runSeed`. Each draft gets an independent stream so drafts never share entropy.
 */
export function draftSeedFor(runSeed: number, nodeIndex: number): number {
  return deriveSeed(deriveSeed(runSeed, RUN_TAG_DRAFT), nodeIndex);
}

/**
 * A stable per-node key from a map coordinate `(floor, index)`. Used to seed every per-node
 * sub-stream (enemy, encounter, shop, event, draft) so a node's content is a pure function of
 * (runSeed, floor, index) — path-independent and reproducible across save/load. Floors and
 * per-floor widths are tiny (≤ a few dozen / ≤3), so `floor × 1000 + index` is collision-free.
 */
export function nodeSeedKey(floor: number, index: number): number {
  return floor * 1000 + index;
}

/** The enemy-selection seed for the node at `nodeKey` of a run rooted at `runSeed`. */
export function enemySeedFor(runSeed: number, nodeKey: number): number {
  return deriveSeed(deriveSeed(runSeed, RUN_TAG_ENEMY), nodeKey);
}

/** The encounter (board + refill) seed for the node at `nodeKey`. */
export function encounterSeedFor(runSeed: number, nodeKey: number): number {
  return deriveSeed(deriveSeed(runSeed, RUN_TAG_ENCOUNTER), nodeKey);
}

/** The shop-stock seed for the node at `nodeKey`. */
export function shopSeedFor(runSeed: number, nodeKey: number): number {
  return deriveSeed(deriveSeed(runSeed, RUN_TAG_SHOP), nodeKey);
}

/** The event seed (scripted-event draw + gamble rolls) for the node at `nodeKey`. */
export function eventSeedFor(runSeed: number, nodeKey: number): number {
  return deriveSeed(deriveSeed(runSeed, RUN_TAG_EVENT), nodeKey);
}
