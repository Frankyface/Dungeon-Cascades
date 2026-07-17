/**
 * Pure banking-once logic for the meta-progression layer: bank a terminal run's score into the
 * profile EXACTLY ONCE, even though the outcome screen that triggers it can mount, re-render, and
 * be re-visited. The engine's `bankRun` is per-CALL (not idempotent over a run) — banking twice
 * would double-count. Since `MetaState` has no field for "which run did I already bank" and the
 * engine is read-only, the once-guard lives here: a UI-side ledger keyed by a stable run identity.
 *
 * Keeping this pure (a `BankLedger` in, a new `BankLedger` out) means the whole guard is Jest-
 * testable with no React and no native storage — the `metaController` singleton just holds the
 * ledger and persists the resulting `MetaState`. No React / React Native imports; never mutates.
 */
import { INITIAL_META_STATE, bankRun, deriveUnlocks, scoreForRun } from '../../engine/run';
import type { MetaState, RunState, UnlockEvent } from '../../engine/run';

/** What a single banked run produced — the numbers the outcome screen shows, plus the new meta. */
export interface BankOutcome {
  /** The score this run banked (≥ 0). */
  readonly runScore: number;
  /** The profile's cumulative score AFTER banking this run. */
  readonly totalScore: number;
  /** Variant ids this run's score just crossed the tranche for (empty if none), canonical order. */
  readonly newlyUnlockedIds: readonly string[];
  /**
   * CONTENT unlock events (Stage-6 §2) this bank surfaced — biome reached, legendary relic unlocked,
   * enemy/boss discovered, Boss Rush opened. Empty for a score-only bank. The outcome screen renders
   * these as ceremony cards alongside the score. Derived idempotently, so a replayed bank replays the
   * same list without re-applying anything.
   */
  readonly unlockEvents: readonly UnlockEvent[];
  /** The profile state after banking (persist this). */
  readonly meta: MetaState;
}

/** The result of applying content unlocks to a ledger: the (possibly unchanged) ledger + new events. */
export interface ContentUnlockResult {
  readonly ledger: BankLedger;
  readonly events: readonly UnlockEvent[];
}

/**
 * Apply a run state's CONTENT unlocks/discoveries (spec §2) to a ledger's meta, IDEMPOTENTLY. Folds
 * `deriveUnlocks(state, meta)` into the ledger; when nothing is new the SAME ledger reference is
 * returned (so callers can cheaply detect "no change"). Not keyed by run identity — it relies on
 * `deriveUnlocks` being idempotent (re-applying an already-applied state yields no events), so it is
 * safe to call at BOTH a checkpoint (the act transition) and the terminal outcome.
 */
export function applyContentUnlocks(ledger: BankLedger, state: RunState): ContentUnlockResult {
  const { meta, events } = deriveUnlocks(state, ledger.meta);
  if (events.length === 0) return { ledger, events };
  return { ledger: { ...ledger, meta }, events };
}

/**
 * The UI-side banking ledger: the live meta profile plus the outcome of every run already banked
 * this session, keyed by run identity. Re-banking a known identity is a no-op that replays the
 * SAME outcome (so a re-visited outcome screen shows identical numbers without advancing the score).
 */
export interface BankLedger {
  readonly meta: MetaState;
  readonly banked: Readonly<Record<string, BankOutcome>>;
}

/** A fresh ledger: a blank profile, nothing banked yet. */
export const INITIAL_BANK_LEDGER: BankLedger = { meta: INITIAL_META_STATE, banked: {} };

/** The result of a bank attempt: the (possibly unchanged) ledger, the outcome, and whether it banked. */
export interface BankOnceResult {
  readonly ledger: BankLedger;
  readonly outcome: BankOutcome;
  /** `false` when `identity` was already banked — the outcome is replayed, meta is untouched. */
  readonly didBank: boolean;
}

/**
 * A stable identity for a terminal run, so it banks exactly once. The run seed is unique per run
 * (fresh random seed at start); the variant tag disambiguates the (astronomically unlikely) case
 * of two runs sharing a seed under different variants.
 */
export function runIdentity(state: RunState): string {
  return `${state.seed}:${state.variantId ?? 'vanilla'}`;
}

/**
 * Bank an explicit run score under a run identity, ONCE. The first call for an identity folds the
 * score into meta (unlocking any newly-earned variants) and records the outcome; any later call for
 * the same identity returns the recorded outcome with `didBank: false` and the ledger unchanged.
 * Pure — returns a new ledger, never mutates the input.
 */
export function bankScoreOnce(ledger: BankLedger, identity: string, runScore: number): BankOnceResult {
  const existing = ledger.banked[identity];
  if (existing !== undefined) {
    return { ledger, outcome: existing, didBank: false };
  }
  const nextMeta = bankRun(ledger.meta, runScore);
  const alreadyUnlocked = new Set(ledger.meta.unlockedVariantIds);
  const newlyUnlockedIds = nextMeta.unlockedVariantIds.filter((id) => !alreadyUnlocked.has(id));
  const outcome: BankOutcome = {
    runScore: Math.max(0, runScore),
    totalScore: nextMeta.score,
    newlyUnlockedIds,
    unlockEvents: [],
    meta: nextMeta,
  };
  return {
    ledger: { meta: nextMeta, banked: { ...ledger.banked, [identity]: outcome } },
    outcome,
    didBank: true,
  };
}

/**
 * Bank a terminal run ONCE: first fold in its CONTENT unlocks (biome/boss/discoveries — idempotent),
 * then bank its SCORE once (`scoreForRun`) onto the content-updated meta. The returned outcome carries
 * BOTH the score numbers and the content unlock events, so the outcome screen celebrates everything a
 * terminal run earned. A replay (same run identity) returns the STORED outcome untouched — its events
 * intact, the meta not advanced.
 */
export function bankRunOnce(ledger: BankLedger, state: RunState): BankOnceResult {
  const cu = applyContentUnlocks(ledger, state); // idempotent content-unlock fold
  const score = bankScoreOnce(cu.ledger, runIdentity(state), scoreForRun(state));
  if (!score.didBank) {
    // Already banked this identity: the stored outcome (with its captured events) replays; the
    // ledger already reflects the content unlocks from the first bank, so return it unchanged.
    return score;
  }
  // Attach the content events to the freshly-banked outcome and re-store it under the identity.
  const identity = runIdentity(state);
  const outcome: BankOutcome = { ...score.outcome, unlockEvents: cu.events };
  return {
    ledger: { ...score.ledger, banked: { ...score.ledger.banked, [identity]: outcome } },
    outcome,
    didBank: true,
  };
}

/** The result of a slot-routed bank: both ledgers (only the routed one changes) + the outcome. */
export interface RoutedBankResult {
  readonly normal: BankLedger;
  readonly dev: BankLedger;
  readonly outcome: BankOutcome;
  readonly didBank: boolean;
  /** Which slot received the bank — so the caller persists to the matching store. */
  readonly bankedDev: boolean;
}

/**
 * Route a terminal run's bank to the correct profile slot and bank it ONCE (spec §8 dev isolation).
 * It goes to the DEV ledger when dev mode is active OR the run is `isDevRun`-stamped — BELT AND BRACES:
 * a dev run must never accrue onto the normal profile even if dev mode was toggled off after the run
 * started. Otherwise it banks onto the NORMAL ledger. Pure — returns both ledgers (only the routed one
 * changes) plus the outcome and which slot banked; the singleton persists the matching store.
 */
export function bankRunRouted(
  normal: BankLedger,
  dev: BankLedger,
  devActive: boolean,
  state: RunState,
): RoutedBankResult {
  const useDev = devActive || state.isDevRun === true;
  const res = bankRunOnce(useDev ? dev : normal, state);
  return {
    normal: useDev ? normal : res.ledger,
    dev: useDev ? res.ledger : dev,
    outcome: res.outcome,
    didBank: res.didBank,
    bankedDev: useDev,
  };
}
