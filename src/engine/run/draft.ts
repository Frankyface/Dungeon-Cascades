/**
 * Relic drafting: after a fight/elite win, offer 3 distinct unowned relics (pick 1 of 3),
 * seeded from the unowned pool with tier-weighted odds. `elite` drafts weight the pool
 * toward elite-tier relics (feature-relics-drafting.md). Deterministic under an RngState;
 * no duplicates are ever offered and pool exhaustion degrades gracefully.
 *
 * PURE ENGINE: no React / React Native imports; deterministic; never mutates input.
 */
import { nextFloat } from '../board';
import type { RngState } from '../board';
import { RELIC_IDS, RELIC_REGISTRY, UNLOCKED_BY_DEFAULT_IDS, getRelic } from './relics';
import type { RelicRegistry, RelicTier } from './relicTypes';

/** How many relics a draft offers. */
export const DRAFT_OPTION_COUNT = 3;

/** Sampling weight for a relic whose tier MATCHES the draft tier (favored). */
export const DRAFT_WEIGHT_MATCH = 3;
/** Sampling weight for a relic whose tier does not match the draft tier. */
export const DRAFT_WEIGHT_OFF = 1;

/** The result of offering a draft: the options plus the advanced RNG state. */
export interface DraftResult {
  readonly options: readonly string[];
  readonly rngState: RngState;
}

/** A relic's draft weight for a given tier: favored when its tier matches the draft's. */
function weightFor(relicTier: RelicTier, draftTier: RelicTier): number {
  return relicTier === draftTier ? DRAFT_WEIGHT_MATCH : DRAFT_WEIGHT_OFF;
}

/**
 * Offer a draft. Draws up to `DRAFT_OPTION_COUNT` DISTINCT relics from the unowned+UNLOCKED pool
 * by weighted sampling without replacement, threading `rngState`. Returns fewer than three
 * options only when the pool is smaller than three (graceful exhaustion — the documented
 * fallback), and an empty list when nothing is left to offer. Never offers an owned or LOCKED
 * relic and never repeats one within a draft.
 *
 * `unlockedIds` (Stage-6 pool seam) filters the pool to the meta-unlocked relics; it defaults to
 * `UNLOCKED_BY_DEFAULT_IDS` (the base 12), so a run that passes nothing sees exactly the pre-wave
 * pool (byte-identical) and every locked expansion relic is excluded. Wave 2 threads real meta
 * state in.
 */
export function draftOptions(
  ownedRelicIds: readonly string[],
  rngState: RngState,
  tier: RelicTier,
  unlockedIds: readonly string[] = UNLOCKED_BY_DEFAULT_IDS,
  registry: RelicRegistry = RELIC_REGISTRY,
): DraftResult {
  const owned = new Set(ownedRelicIds);
  const unlocked = new Set(unlockedIds);
  // Pool in canonical roster order (deterministic): unowned AND unlocked only.
  const ids = (registry === RELIC_REGISTRY ? RELIC_IDS : Object.keys(registry)).filter(
    (id) => !owned.has(id) && unlocked.has(id),
  );

  const pool: string[] = [...ids];
  const weights = pool.map((id) => weightFor(getRelic(id, registry).tier, tier));
  const options: string[] = [];
  let state = rngState;

  while (options.length < DRAFT_OPTION_COUNT && pool.length > 0) {
    let total = 0;
    for (const w of weights) total += w;

    const draw = nextFloat(state);
    state = draw.state;
    let target = draw.value * total;

    let chosen = pool.length - 1; // fallback guards float edge (target === total)
    for (let i = 0; i < pool.length; i++) {
      target -= weights[i];
      if (target < 0) {
        chosen = i;
        break;
      }
    }

    options.push(pool[chosen]);
    pool.splice(chosen, 1);
    weights.splice(chosen, 1);
  }

  return { options, rngState: state };
}

/**
 * Add a drafted relic to the owned set, returning a NEW list (immutable). Throws if the id
 * is unknown or already owned (boundary validation — a duplicate should never reach here).
 */
export function applyDraft(
  ownedRelicIds: readonly string[],
  pickedId: string,
  registry: RelicRegistry = RELIC_REGISTRY,
): readonly string[] {
  getRelic(pickedId, registry); // throws on unknown id
  if (ownedRelicIds.includes(pickedId)) {
    throw new Error(`applyDraft: relic '${pickedId}' is already owned`);
  }
  return [...ownedRelicIds, pickedId];
}
