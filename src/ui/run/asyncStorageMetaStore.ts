/**
 * The device-side `MetaStorePort` adapter, backed by AsyncStorage — the meta-progression twin of
 * `AsyncStorageRunStore`. The engine's port is SYNCHRONOUS (save/load/clear return immediately) but
 * AsyncStorage is async, so this adapter keeps a synchronous in-memory MIRROR: reads/writes hit the
 * mirror instantly, and each write is flushed to AsyncStorage in the background. On a cold start
 * `hydrate()` loads the mirror from disk once before the menu reads it.
 *
 * This is the ONLY place the meta engine touches native storage — the engine itself stays pure
 * (see the `grep -rn "async-storage" src/engine/` gate). Persistence behavior is proven with the
 * in-memory `InMemoryMetaStore` in the engine tests; real device persistence is confirmed on-device.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MetaState, MetaStorePort } from '../../engine/run';
import { META_STORAGE_KEY } from './metaStorageKeys';

// Re-export for existing call sites (the key constants now live in a native-free module).
export { META_STORAGE_KEY, DEV_META_STORAGE_KEY } from './metaStorageKeys';

export class AsyncStorageMetaStore implements MetaStorePort {
  private mirror: MetaState | null = null;
  private hydrated = false;
  private readonly key: string;

  /**
   * @param key The storage key this store persists under. Defaults to the normal meta key; dev-mode
   *   passes `DEV_META_STORAGE_KEY` so dev state persists to a SEPARATE slot and never touches normal
   *   meta (spec §8 storage separation).
   */
  constructor(key: string = META_STORAGE_KEY) {
    this.key = key;
  }

  /** Persist the profile: update the mirror now, flush to disk in the background. */
  save(state: MetaState): void {
    this.mirror = state;
    this.hydrated = true;
    void AsyncStorage.setItem(this.key, JSON.stringify(state)).catch((err) => {
      console.warn('[meta-store] save failed:', err);
    });
  }

  /**
   * Persist the profile and AWAIT the disk flush — the crash-safe variant used by the Altar sacrifice
   * (spec §2c): the meta unlock (an un-re-derivable altar pick) must be durable BEFORE the run save
   * clears the slot, so a crash between the two writes can never lose it. Ordinary callers keep the
   * background-flush `save`. A flush failure is swallowed like `save` (best-effort; the mirror is
   * already updated) rather than rejecting the caller's ordered write.
   */
  async saveAndFlush(state: MetaState): Promise<void> {
    this.mirror = state;
    this.hydrated = true;
    try {
      await AsyncStorage.setItem(this.key, JSON.stringify(state));
    } catch (err) {
      console.warn('[meta-store] saveAndFlush failed:', err);
    }
  }

  /** The current profile from the synchronous mirror (call `hydrate()` first on a cold start). */
  load(): MetaState | null {
    return this.mirror;
  }

  /** Delete the saved profile (a full meta reset): clear the mirror now, remove from disk in the background. */
  clear(): void {
    this.mirror = null;
    this.hydrated = true;
    void AsyncStorage.removeItem(this.key).catch((err) => {
      console.warn('[meta-store] clear failed:', err);
    });
  }

  /**
   * Load the saved profile from disk into the mirror (cold-start hydration). Returns the loaded
   * profile (or null). A corrupt/unreadable payload is treated as "no save" rather than crashing.
   *
   * IDEMPOTENT: once the mirror reflects a disk read/write (an earlier hydrate, or a save/clear),
   * hydrating again returns the current mirror WITHOUT re-reading disk — a remount can't resurrect a
   * stale disk value or race a just-banked profile.
   */
  async hydrate(): Promise<MetaState | null> {
    if (this.hydrated) {
      return this.mirror;
    }
    try {
      const raw = await AsyncStorage.getItem(this.key);
      this.mirror = raw ? (JSON.parse(raw) as MetaState) : null;
    } catch (err) {
      console.warn('[meta-store] hydrate failed, treating as no save:', err);
      this.mirror = null;
    }
    this.hydrated = true;
    return this.mirror;
  }

  /** Whether the mirror reflects a disk read/write yet (false before the first hydrate/save). */
  isHydrated(): boolean {
    return this.hydrated;
  }
}
