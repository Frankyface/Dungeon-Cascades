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
import { INITIAL_META_STATE, bankRun, scoreForRun } from '../../engine/run';
import type { MetaState, RunState } from '../../engine/run';

/** What a single banked run produced — the numbers the outcome screen shows, plus the new meta. */
export interface BankOutcome {
  /** The score this run banked (≥ 0). */
  readonly runScore: number;
  /** The profile's cumulative score AFTER banking this run. */
  readonly totalScore: number;
  /** Variant ids this run's score just crossed the tranche for (empty if none), canonical order. */
  readonly newlyUnlockedIds: readonly string[];
  /** The profile state after banking (persist this). */
  readonly meta: MetaState;
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
    meta: nextMeta,
  };
  return {
    ledger: { meta: nextMeta, banked: { ...ledger.banked, [identity]: outcome } },
    outcome,
    didBank: true,
  };
}

/** Bank a terminal run ONCE, deriving its score from its final state (`scoreForRun`). */
export function bankRunOnce(ledger: BankLedger, state: RunState): BankOnceResult {
  return bankScoreOnce(ledger, runIdentity(state), scoreForRun(state));
}
