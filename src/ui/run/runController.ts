/**
 * The app-level run singleton: ONE AsyncStorage-backed store shared by the menu (to check for a
 * saved run and hydrate it) and the run provider (to persist progress), plus a tiny "staging"
 * hand-off so the menu can prepare a run (new or resumed) that the provider picks up on mount.
 *
 * Kept out of React state deliberately: the store must outlive individual screen mounts, and the
 * menu → provider hand-off crosses a navigation boundary. The provider mirrors the live run in
 * its own React state for rendering; this module owns persistence + the seed source.
 */
import { startRun } from '../../engine/run';
import type { RunState } from '../../engine/run';
import { AsyncStorageRunStore } from './asyncStorageRunStore';
import { metaState } from './metaController';

const store = new AsyncStorageRunStore();
let staged: RunState | null = null;

/** The shared persistence store (async-storage backed). */
export function runStore(): AsyncStorageRunStore {
  return store;
}

/** Hydrate the store's mirror from disk (cold-start; call once from the menu). Idempotent. */
export function hydrateRunStore(): Promise<RunState | null> {
  return store.hydrate();
}

/**
 * Whether the store's mirror already reflects a disk read/write (a save/clear or a prior hydrate).
 * The menu uses this to gate its run section: until it is true, Start/Continue are not interactive,
 * so a premature tap can't clobber an unread save.
 */
export function isRunStoreHydrated(): boolean {
  return store.isHydrated();
}

/** UI-side entropy for a fresh run seed (the engine stays pure — seeds come from the UI). */
export function makeRunSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff) >>> 0;
}

/**
 * Prepare a BRAND-NEW run for the provider to pick up, and persist it immediately so a cold
 * start (before any node completes) still offers Continue. Returns the fresh run.
 *
 * `variantId` is OPTIONAL (Stage 4): omit it for a vanilla start (byte-identical to before), or
 * pass a variant id (from the start-selection screen) to begin from that sidegrade. The engine's
 * `startRun` validates the id and bakes the variant's modifiers into the initial state.
 *
 * The run also snapshots the profile's UNLOCKED RELIC POOL (Stage-6 §2) from the live meta, so this
 * run's drafts / shops / event grants offer exactly the relics the player has unlocked (locked relics
 * never appear). A fresh profile's snapshot is the base 12, so a first run is unchanged.
 */
export function stageNewRun(seed: number = makeRunSeed(), variantId?: string): RunState {
  staged = startRun(seed, variantId, metaState().unlockedRelicIds);
  store.save(staged);
  return staged;
}

/** Prepare the SAVED run for resume (from the hydrated mirror). Null if no run is saved. */
export function stageResumeRun(): RunState | null {
  staged = store.load();
  return staged;
}

/**
 * Stage an ALREADY-BUILT run state for the provider to pick up, and persist it. Used by dev mode
 * (spec §8), which constructs a run from overrides (fixed seed / forced Act-2 biome / jump-to-act-2)
 * via the engine's pure flow rather than the standard `stageNewRun` path.
 */
export function stageRunState(run: RunState): RunState {
  staged = run;
  store.save(run);
  return run;
}

/** The provider consumes the staged run exactly once at mount (falls back to the saved run). */
export function takeStagedRun(): RunState | null {
  const run = staged ?? store.load();
  staged = null;
  return run;
}
