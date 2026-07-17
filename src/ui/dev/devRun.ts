/**
 * Pure DEV-RUN construction (spec §8): build a run from dev overrides — a fixed seed, a variant, a
 * forced Act-2 biome, and/or a jump straight to Act 2 — using only the engine's own pure functions.
 * The Act-2 biome is a pure function of the seed, so an override is honoured by SEARCHING seeds for
 * one that lands on the target biome; jump-to-act-2 runs the engine's `advanceAct` on a synthetic
 * transition. No persistence here — the dev controller stages the result.
 *
 * No React imports; deterministic; never mutates input.
 */
import { createRng } from '../../engine/board';
import { ACT2_BIOME_IDS, act2BiomeSeedFor, advanceAct, selectAct2Biome, startRun } from '../../engine/run';
import type { BiomeId } from '../../engine/combat';
import type { RunState } from '../../engine/run';

/** The Act-2 biome a given seed will land on (the engine's pure, seed-derived selection). */
export function act2BiomeForSeed(seed: number): BiomeId {
  return selectAct2Biome(createRng(act2BiomeSeedFor(seed))).biomeId;
}

/**
 * Find a seed whose Act-2 biome is `target`, scanning up from `startSeed`. Returns `startSeed` as a
 * graceful fallback if none is found within `maxTries` (won't happen — one of four biomes recurs
 * every few seeds). Deterministic.
 */
export function findSeedForAct2Biome(target: BiomeId, startSeed: number, maxTries = 1000): number {
  for (let i = 0; i < maxTries; i++) {
    const seed = (startSeed + i) >>> 0;
    if (act2BiomeForSeed(seed) === target) return seed;
  }
  return startSeed;
}

/** Dev run-start overrides. Every field is optional; omitted fields fall back to a normal start. */
export interface DevRunOptions {
  readonly seed: number;
  readonly variantId?: string;
  /** Force the run's Act-2 biome (seed is searched to honour it). */
  readonly act2BiomeId?: BiomeId;
  /** Start already in Act 2 (runs the engine's act transition on a synthetic boss-cleared state). */
  readonly jumpToAct2?: boolean;
  /** The meta pool snapshot (usually the dev profile's fully-unlocked set). */
  readonly unlockedRelicIds?: readonly string[];
}

/**
 * Build a dev run from the overrides using pure engine flow. When `act2BiomeId` is set the seed is
 * searched so the run truly lands on it; when `jumpToAct2` is set the run is advanced into Act 2 via
 * `advanceAct` (heal + Act-2 map). Throws on an unknown variant id (engine boundary validation).
 */
export function buildDevRun(options: DevRunOptions): RunState {
  const seed = options.act2BiomeId !== undefined ? findSeedForAct2Biome(options.act2BiomeId, options.seed) : options.seed;
  const run = startRun(seed, options.variantId, options.unlockedRelicIds);
  if (options.jumpToAct2 !== true) return run;
  // Synthesize the act-transition phase and run the real engine transition (heal + Act-2 map).
  return advanceAct({ ...run, phase: { kind: 'act_transition' } });
}

/** The Act-2 biome ids a dev override may choose from (the four Act-2 biomes). */
export const DEV_ACT2_BIOME_CHOICES: readonly BiomeId[] = ACT2_BIOME_IDS;
