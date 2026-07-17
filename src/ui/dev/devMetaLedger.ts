/**
 * Pure dev-mode meta operations (spec §8), written over an INJECTED `MetaStorePort` so the storage
 * separation is provable without native storage: every dev write targets ONLY the store handed in
 * (the dev slot), never the normal one. The metaController wires the real async dev store in; tests
 * pass an in-memory store to prove normal meta is untouched.
 *
 * No React / React Native imports; deterministic; never mutates input.
 */
import { INITIAL_META_STATE, devMetaReset, devUnlockAllMeta } from '../../engine/run';
import type { MetaState, MetaStorePort } from '../../engine/run';

/** The current dev profile (or a fresh one if the dev slot is empty). */
export function loadDevMeta(devStore: MetaStorePort): MetaState {
  return devStore.load() ?? INITIAL_META_STATE;
}

/**
 * Unlock ALL content into the DEV slot (spec §8): fully-unlock the current dev profile and persist it
 * to `devStore` — and ONLY `devStore`. Returns the new dev profile.
 */
export function devUnlockAllInto(devStore: MetaStorePort): MetaState {
  const unlocked = devUnlockAllMeta(loadDevMeta(devStore));
  devStore.save(unlocked);
  return unlocked;
}

/** Reset the DEV slot to a fresh profile (spec §8 "reset meta"), writing ONLY to `devStore`. */
export function devResetInto(devStore: MetaStorePort): MetaState {
  const fresh = devMetaReset();
  devStore.save(fresh);
  return fresh;
}
