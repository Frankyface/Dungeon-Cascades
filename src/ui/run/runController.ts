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
 */
export function stageNewRun(seed: number = makeRunSeed()): RunState {
  staged = startRun(seed);
  store.save(staged);
  return staged;
}

/** Prepare the SAVED run for resume (from the hydrated mirror). Null if no run is saved. */
export function stageResumeRun(): RunState | null {
  staged = store.load();
  return staged;
}

/** The provider consumes the staged run exactly once at mount (falls back to the saved run). */
export function takeStagedRun(): RunState | null {
  const run = staged ?? store.load();
  staged = null;
  return run;
}
