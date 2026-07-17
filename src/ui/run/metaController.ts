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
 *
 * DEV MODE (spec §8): a SEPARATE dev store (`DEV_META_STORAGE_KEY`) holds a fully-unlockable dev
 * profile. While dev mode is ACTIVE, every read and every bank routes to the dev ledger/store, so the
 * normal profile is never read for gameplay AND never written — the sim/purity evidence stays dev-free
 * BY CONSTRUCTION (the two stores use distinct keys; nothing here ever writes dev data to the normal
 * key). Dev mode is a session toggle (off on every cold start).
 */
import { devMetaReset, devUnlockAllMeta, loadMeta } from '../../engine/run';
import type { MetaState, RunState, UnlockEvent } from '../../engine/run';
import { AsyncStorageMetaStore } from './asyncStorageMetaStore';
import { DEV_META_STORAGE_KEY } from './metaStorageKeys';
import { INITIAL_BANK_LEDGER, applyContentUnlocks, bankRunRouted } from './metaBanking';
import type { BankLedger, BankOutcome } from './metaBanking';

const store = new AsyncStorageMetaStore();
let ledger: BankLedger = INITIAL_BANK_LEDGER;

// Dev-mode: a separate, clearly-marked store + ledger + session flag (spec §8 storage separation).
const devStore = new AsyncStorageMetaStore(DEV_META_STORAGE_KEY);
let devLedger: BankLedger = INITIAL_BANK_LEDGER;
let devActive = false;

/** The ledger reads/banks route to right now (dev when active, normal otherwise). */
function activeLedger(): BankLedger {
  return devActive ? devLedger : ledger;
}

/** The store the active ledger persists to. */
function activeStore(): AsyncStorageMetaStore {
  return devActive ? devStore : store;
}

/** Replace the active ledger (dev or normal, whichever is live). */
function setActiveLedger(next: BankLedger): void {
  if (devActive) devLedger = next;
  else ledger = next;
}

/** The shared meta persistence store (async-storage backed). */
export function metaStore(): AsyncStorageMetaStore {
  return store;
}

/**
 * Hydrate the store's mirror from disk (cold-start; call once from the menu) and adopt the loaded
 * profile into the ledger. `loadMeta` re-applies unlocks so a stored profile is always consistent
 * with its score. Idempotent — a warm remount resolves instantly and re-adopts the same profile.
 * Hydrates the dev slot too; returns the ACTIVE profile (dev when dev mode is on).
 */
export function hydrateMetaStore(): Promise<MetaState> {
  return Promise.all([store.hydrate(), devStore.hydrate()]).then(() => {
    ledger = { ...ledger, meta: loadMeta(store) };
    devLedger = { ...devLedger, meta: loadMeta(devStore) };
    return activeLedger().meta;
  });
}

/** Whether the store's mirror already reflects a disk read/write (a save or a prior hydrate). */
export function isMetaStoreHydrated(): boolean {
  return store.isHydrated();
}

/** The current meta profile from the ACTIVE ledger (dev profile when dev mode is on). */
export function metaState(): MetaState {
  return activeLedger().meta;
}

/**
 * Bank a TERMINAL run's score into the profile — the single call site the outcome screen uses. The
 * ledger's once-guard makes this idempotent per run: a re-mounted / re-visited outcome screen calls
 * this again and gets the SAME outcome back WITHOUT double-counting. A real (first-time) bank is
 * flushed to disk; a replayed bank touches neither the ledger nor storage. Routes to the dev slot
 * while dev mode is active OR the run is `isDevRun`-stamped (belt and braces, spec §8), so a dev run
 * never pollutes the normal profile even if the dev toggle was flipped off after the run started.
 */
export function bankRunOutcome(state: RunState): BankOutcome {
  const routed = bankRunRouted(ledger, devLedger, devActive, state);
  ledger = routed.normal;
  devLedger = routed.dev;
  if (routed.didBank) {
    (routed.bankedDev ? devStore : store).save(routed.outcome.meta);
  }
  return routed.outcome;
}

/**
 * Apply a run's CONTENT unlocks/discoveries at a NON-terminal checkpoint (the act transition, spec
 * §2a: reaching an Act-2 biome unlocks it) and persist them if anything changed. Idempotent — reruns
 * yield no new events and touch neither the ledger nor storage. Returns the events for the ceremony.
 */
export function bankContentUnlocksNow(state: RunState): readonly UnlockEvent[] {
  const { ledger: next, events } = applyContentUnlocks(activeLedger(), state);
  setActiveLedger(next);
  if (events.length > 0) {
    activeStore().save(next.meta);
  }
  return events;
}

/**
 * Adopt an externally-computed meta profile into the ledger and persist it — the sink for flows that
 * produce a new `MetaState` themselves via the engine's own appliers: the Altar sacrifice
 * (`sacrificeAtAltar` → `applyAltarUnlock`) and the Boss-Rush victory (`applyBossRushVictory`). Keeps
 * a single persistence call site so those unlocks survive save/load like every other meta change.
 */
export function adoptMeta(meta: MetaState): void {
  setActiveLedger({ ...activeLedger(), meta });
  activeStore().save(meta);
}

/**
 * Like `adoptMeta`, but AWAITS the disk flush — the crash-safe sink for the Altar sacrifice (spec §2c).
 * The caller (RunContext) awaits this BEFORE it saves the terminal run, so the permanent relic unlock
 * is durable before the run slot clears: a crash between the two writes preserves the unlock (which
 * cannot be re-derived) instead of losing it. Ledger update is synchronous; only the flush is awaited.
 */
export function adoptMetaFlush(meta: MetaState): Promise<void> {
  setActiveLedger({ ...activeLedger(), meta });
  return activeStore().saveAndFlush(meta);
}

// ── Dev mode (spec §8) ────────────────────────────────────────────────────────────────────

/** Whether dev mode is currently active (drives the DEV banner + which profile is live). */
export function isDevMode(): boolean {
  return devActive;
}

/** Turn dev mode on/off. While ON, all reads/banks route to the SEPARATE dev slot. */
export function setDevMode(active: boolean): void {
  devActive = active;
}

/** The dev profile (independent of whether dev mode is currently active). */
export function devMetaSnapshot(): MetaState {
  return devLedger.meta;
}

/** DEV: fully unlock all content into the dev slot ONLY (never the normal key). Returns the dev profile. */
export function devUnlockAllContent(): MetaState {
  const meta = devUnlockAllMeta(devLedger.meta);
  devLedger = { ...devLedger, meta };
  devStore.save(meta);
  return meta;
}

/** DEV: reset the dev slot to a fresh profile (spec §8 "reset meta"). Normal meta untouched. */
export function devResetContent(): MetaState {
  const meta = devMetaReset();
  devLedger = { meta, banked: {} };
  devStore.save(meta);
  return meta;
}
