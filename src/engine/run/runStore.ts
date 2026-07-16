/**
 * Save / load for a run behind an injected persistence PORT, so the engine stays pure: the
 * UI supplies an async-storage-backed adapter (its job, not this one); tests use the in-memory
 * implementation here. A run is one serializable object, so persistence is a JSON round-trip.
 *
 * Save-on-node-completion + rogue-lite death semantics are expressed as the `saveOnNodeCompletion`
 * helper the UI calls after each node resolves: an ACTIVE run is saved; a TERMINAL run (victory
 * or defeat) CLEARS the slot (no retry from save — a finished run does not resume).
 *
 * PURE ENGINE: no React / React Native imports; the in-memory store holds a JSON string (not a
 * live reference) so a saved run is provably decoupled from later mutation of the original.
 */
import type { RunState } from './runTypes';
import { isTerminal } from './runTypes';

/** The persistence seam. The async-storage adapter (UI-side) implements this same interface. */
export interface RunStorePort {
  /** Persist the current run (overwriting any prior save). */
  save(state: RunState): void;
  /** Load the saved run, or `null` if none is saved. */
  load(): RunState | null;
  /** Delete any saved run. */
  clear(): void;
}

/**
 * In-memory `RunStorePort` for tests. Stores the run as a JSON STRING and re-parses on load,
 * so it exercises real serialization (a non-serializable field would surface here) and hands
 * back an independent copy every time.
 */
export class InMemoryRunStore implements RunStorePort {
  private data: string | null = null;

  save(state: RunState): void {
    this.data = JSON.stringify(state);
  }

  load(): RunState | null {
    return this.data === null ? null : (JSON.parse(this.data) as RunState);
  }

  clear(): void {
    this.data = null;
  }
}

/**
 * The save-on-node-completion checkpoint the UI calls after each node resolves. Persists an
 * active run; clears the slot on a terminal run (rogue-lite: no resume from a finished run).
 */
export function saveOnNodeCompletion(store: RunStorePort, state: RunState): void {
  if (isTerminal(state)) {
    store.clear();
  } else {
    store.save(state);
  }
}
