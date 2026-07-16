/**
 * The app-level meta-progression singleton — the twin of `runController`. ONE AsyncStorage-backed
 * store holds the cumulative-score profile, and a `BankLedger` (this module's live state) folds each
 * terminal run's score into it EXACTLY once. The menu hydrates it (to gate its run section and show
 * the total), the start-selection screen reads it (to gate variant choice), and the outcome screen
 * banks into it.
 *
 * Kept out of React state deliberately (like `runController`): the profile must outlive individual
 * screen mounts and cross the menu → run → outcome navigation boundary. INVARIANT: the menu gates
 * its run section until this store is hydrated, so no run is ever banked before hydration adopts the
 * saved profile — a bank always accrues onto the real total, never onto a blank one.
 */
import { loadMeta } from '../../engine/run';
import type { MetaState, RunState } from '../../engine/run';
import { AsyncStorageMetaStore } from './asyncStorageMetaStore';
import { INITIAL_BANK_LEDGER, bankRunOnce } from './metaBanking';
import type { BankLedger, BankOutcome } from './metaBanking';

const store = new AsyncStorageMetaStore();
let ledger: BankLedger = INITIAL_BANK_LEDGER;

/** The shared meta persistence store (async-storage backed). */
export function metaStore(): AsyncStorageMetaStore {
  return store;
}

/**
 * Hydrate the store's mirror from disk (cold-start; call once from the menu) and adopt the loaded
 * profile into the ledger. `loadMeta` re-applies unlocks so a stored profile is always consistent
 * with its score. Idempotent — a warm remount resolves instantly and re-adopts the same profile.
 */
export function hydrateMetaStore(): Promise<MetaState> {
  return store.hydrate().then(() => {
    const meta = loadMeta(store); // applies unlocks to the hydrated mirror
    ledger = { ...ledger, meta };
    return meta;
  });
}

/** Whether the store's mirror already reflects a disk read/write (a save or a prior hydrate). */
export function isMetaStoreHydrated(): boolean {
  return store.isHydrated();
}

/** The current meta profile from the live ledger (cumulative score + unlocked variants). */
export function metaState(): MetaState {
  return ledger.meta;
}

/**
 * Bank a TERMINAL run's score into the profile — the single call site the outcome screen uses. The
 * ledger's once-guard makes this idempotent per run: a re-mounted / re-visited outcome screen calls
 * this again and gets the SAME outcome back WITHOUT double-counting. A real (first-time) bank is
 * flushed to disk; a replayed bank touches neither the ledger nor storage.
 */
export function bankRunOutcome(state: RunState): BankOutcome {
  const { ledger: next, outcome, didBank } = bankRunOnce(ledger, state);
  ledger = next;
  if (didBank) {
    store.save(outcome.meta);
  }
  return outcome;
}
