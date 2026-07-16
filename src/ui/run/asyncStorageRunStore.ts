/**
 * The device-side `RunStorePort` adapter, backed by AsyncStorage. The engine's port is
 * SYNCHRONOUS (save/load/clear return immediately) but AsyncStorage is async, so this adapter
 * keeps a synchronous in-memory MIRROR: reads/writes hit the mirror instantly, and each write
 * is flushed to AsyncStorage in the background. On a cold start `hydrate()` loads the mirror
 * from disk once before the run UI reads it.
 *
 * This is the ONLY place the run engine touches native storage — the engine itself stays pure
 * (see the `grep -rn "async-storage" src/engine/` gate). The wiring is proven with the
 * in-memory port in `runSession.test.ts`; real device persistence is confirmed on-device.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RunState, RunStorePort } from '../../engine/run';

/** Storage key (versioned so a future save-schema bump can migrate cleanly). */
export const RUN_STORAGE_KEY = 'dungeon-cascades/run/v1';

export class AsyncStorageRunStore implements RunStorePort {
  private mirror: RunState | null = null;
  private hydrated = false;

  /** Persist the run: update the mirror now, flush to disk in the background. */
  save(state: RunState): void {
    this.mirror = state;
    this.hydrated = true;
    void AsyncStorage.setItem(RUN_STORAGE_KEY, JSON.stringify(state)).catch((err) => {
      console.warn('[run-store] save failed:', err);
    });
  }

  /** The current run from the synchronous mirror (call `hydrate()` first on a cold start). */
  load(): RunState | null {
    return this.mirror;
  }

  /** Delete the saved run: clear the mirror now, remove from disk in the background. */
  clear(): void {
    this.mirror = null;
    this.hydrated = true;
    void AsyncStorage.removeItem(RUN_STORAGE_KEY).catch((err) => {
      console.warn('[run-store] clear failed:', err);
    });
  }

  /**
   * Load the saved run from disk into the mirror (cold-start hydration). Returns the loaded run
   * (or null). A corrupt/unreadable payload is treated as "no save" rather than crashing the app.
   */
  async hydrate(): Promise<RunState | null> {
    try {
      const raw = await AsyncStorage.getItem(RUN_STORAGE_KEY);
      this.mirror = raw ? (JSON.parse(raw) as RunState) : null;
    } catch (err) {
      console.warn('[run-store] hydrate failed, treating as no save:', err);
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
