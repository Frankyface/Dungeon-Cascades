/**
 * Meta-progression state (Stage 4, decisions.md 2026-07-15 "Meta-progression shape").
 *
 * A single serializable `MetaState` — a cumulative SCORE that banks after EVERY run (win or
 * lose) plus the set of variant ids unlocked so far. Variants unlock at fixed cumulative-score
 * TRANCHES (this module owns the score formula, the tranche table, and idempotent unlock
 * application); persistence rides on a `MetaStorePort` mirroring `RunStorePort`.
 *
 * NO POWER CREEP BY CONSTRUCTION: meta state gates only which VARIANTS a player may pick at the
 * new-run screen. Vanilla is always available and `startRun(seed)` never reads meta, so a fresh
 * profile and a maxed profile produce identical vanilla starts (asserted by test). Unlocks are
 * cosmetic-access only — never stat bonuses.
 *
 * PURE ENGINE: no React / React Native imports; deterministic; never mutates input. See CLAUDE.md.
 */
import type { RunState } from './runTypes';
import { currentRunNode } from './runTypes';
import { nodeById } from './mapNav';
import { VARIANT_IDS } from './variants';

// ── Score constants (the single tuning surface for run scoring) ───────────────────────
//
// perRunScore = floorsCleared·PER_FLOOR + encountersWon·PER_ENCOUNTER_WON + (victory ? VICTORY_BONUS : 0)
// Banked win OR lose (a defeat still banks the floors + encounters it reached), so progress
// never stalls. Whole numbers so a run's score is hand-checkable.

/** Score per deepest floor reached (a floor-depth reward; banks on defeat too). */
export const META_SCORE_PER_FLOOR = 1;

/** Score per combat encounter WON (fights + elites + the boss). */
export const META_SCORE_PER_ENCOUNTER_WON = 2;

/** Flat bonus for completing a run (reaching victory). */
export const META_VICTORY_BONUS = 10;

/** The performance inputs that determine a single run's banked score. */
export interface RunScoreInput {
  /** Deepest map floor the run reached (0-indexed; the boss floor on a victory). */
  readonly floorsCleared: number;
  /** Combat encounters won across the run (fights + elites + a won boss). */
  readonly encountersWon: number;
  /** Whether the run ended in victory. */
  readonly victory: boolean;
}

/** The score a single run banks, from its performance inputs. Pure arithmetic; always ≥ 0. */
export function scoreRun(input: RunScoreInput): number {
  return (
    input.floorsCleared * META_SCORE_PER_FLOOR +
    input.encountersWon * META_SCORE_PER_ENCOUNTER_WON +
    (input.victory ? META_VICTORY_BONUS : 0)
  );
}

/**
 * Derive a terminal run's score inputs from its final `RunState` — no extra bookkeeping needed
 * on RunState. `floorsCleared` is the current (deepest) node's floor; `encountersWon` counts the
 * fight/elite nodes on the visited path that were cleared (all of them EXCEPT the current node
 * when the run ended in defeat there — a death only ever happens IN a combat node), plus the boss
 * on a victory. Only meaningful once the run is terminal.
 */
export function runScoreInput(state: RunState): RunScoreInput {
  const victory = state.status === 'victory';
  const floorsCleared = currentRunNode(state).floor;
  const currentId = state.mapState.currentNodeId;

  let encountersWon = 0;
  for (const id of state.mapState.visited) {
    const type = nodeById(state.map, id).type;
    if (type !== 'fight' && type !== 'elite') continue;
    // The current node on a DEFEAT is the encounter that killed the player — not a win.
    if (id === currentId && state.status === 'defeat') continue;
    encountersWon++;
  }
  if (victory) encountersWon++; // the boss (its node is 'boss', not counted in the loop)

  return { floorsCleared, encountersWon, victory };
}

/** Convenience: the score a terminal run banks, straight from its final state. */
export function scoreForRun(state: RunState): number {
  return scoreRun(runScoreInput(state));
}

// ── Unlock tranches (cumulative-score milestones → variant unlocks) ───────────────────
//
// PACING ARITHMETIC (feature-meta-variants.md target: first unlock ~2–3 runs, full slate
// ~15–20 runs). Vanilla policy-bot mean score is ≈ 20/run (measured by `--mode report`; see the
// Verification Log). With that baseline the tranches below fire at:
//   T1  50 → ~2.5 runs     T4 210 → ~10.5 runs
//   T2 100 → ~5 runs       T5 290 → ~14.5 runs
//   T3 150 → ~7.5 runs     T6 360 → ~18 runs
// i.e. the first unlock lands inside the 2–3-run window and the full six-variant slate inside the
// 15–20-run window. The thresholds are the tuning surface; re-derive if scoring or balance moves.

/** One unlock milestone: cross `score` (cumulative) and `variantId` becomes available. */
export interface UnlockTranche {
  readonly score: number;
  readonly variantId: string;
}

/** The six milestones, ascending, one per variant in canonical (VARIANTS) order. */
export const UNLOCK_TRANCHES: readonly UnlockTranche[] = [
  { score: 50, variantId: VARIANT_IDS[0] },
  { score: 100, variantId: VARIANT_IDS[1] },
  { score: 150, variantId: VARIANT_IDS[2] },
  { score: 210, variantId: VARIANT_IDS[3] },
  { score: 290, variantId: VARIANT_IDS[4] },
  { score: 360, variantId: VARIANT_IDS[5] },
];

// ── MetaState + operations ────────────────────────────────────────────────────────────

/** The one serializable meta object: cumulative score + the set of unlocked variant ids. */
export interface MetaState {
  readonly score: number;
  /** Unlocked variant ids, in canonical (tranche) order. Vanilla is implicit — never listed. */
  readonly unlockedVariantIds: readonly string[];
}

/** A fresh profile: no score, nothing unlocked (vanilla only). */
export const INITIAL_META_STATE: MetaState = { score: 0, unlockedVariantIds: [] };

/** Every variant id whose tranche threshold is met at `score` (canonical order). */
export function unlockedAtScore(score: number): readonly string[] {
  return UNLOCK_TRANCHES.filter((t) => score >= t.score).map((t) => t.variantId);
}

/**
 * Ensure `meta.unlockedVariantIds` contains exactly the variants its score has earned — idempotent
 * and order-stable (canonical tranche order). Applying it twice, or to an already-current state,
 * changes nothing; a variant crosses its tranche and unlocks exactly once. Existing unlocked ids
 * are always retained (a lowered threshold could never revoke an earned variant).
 */
export function applyUnlocks(meta: MetaState): MetaState {
  const earned = new Set(unlockedAtScore(meta.score));
  for (const id of meta.unlockedVariantIds) earned.add(id); // never revoke
  const unlockedVariantIds = VARIANT_IDS.filter((id) => earned.has(id)); // canonical order
  if (
    unlockedVariantIds.length === meta.unlockedVariantIds.length &&
    unlockedVariantIds.every((id, i) => id === meta.unlockedVariantIds[i])
  ) {
    return meta; // already current — return the same reference (idempotent)
  }
  return { ...meta, unlockedVariantIds };
}

/**
 * Bank one run's score into the profile, unlocking any newly-earned variants. Pure. NOTE: banking
 * is per-CALL, not idempotent over a run — persist the resulting accumulated MetaState, don't
 * re-bank the same run (reload restores the accumulated state; the UNLOCK derivation is the
 * idempotent part, so a reload never double-unlocks).
 */
export function bankRun(meta: MetaState, runScore: number): MetaState {
  const score = meta.score + Math.max(0, runScore);
  return applyUnlocks({ ...meta, score });
}

/** Whether a variant id is unlocked in this profile. */
export function isVariantUnlocked(meta: MetaState, variantId: string): boolean {
  return meta.unlockedVariantIds.includes(variantId);
}

/**
 * The variant ids a player may currently START a run from: vanilla (represented by `null`) is
 * always first, then the unlocked variants in canonical order. Kept as a list of `string | null`
 * so the UI can render "vanilla" as a real, always-present choice.
 */
export function selectableStarts(meta: MetaState): readonly (string | null)[] {
  return [null, ...VARIANT_IDS.filter((id) => meta.unlockedVariantIds.includes(id))];
}

// ── Persistence port ──────────────────────────────────────────────────────────────────

/** The meta persistence seam (the async-storage adapter, UI-side, implements this). */
export interface MetaStorePort {
  /** Persist the meta profile (overwriting any prior save). */
  save(state: MetaState): void;
  /** Load the saved profile, or `null` if none is saved. */
  load(): MetaState | null;
  /** Delete the saved profile (a full meta reset). */
  clear(): void;
}

/**
 * In-memory `MetaStorePort` for tests. Stores the profile as a JSON STRING and re-parses on load
 * (real serialization; independent copy every load) — mirrors `InMemoryRunStore`.
 */
export class InMemoryMetaStore implements MetaStorePort {
  private data: string | null = null;

  save(state: MetaState): void {
    this.data = JSON.stringify(state);
  }

  load(): MetaState | null {
    return this.data === null ? null : (JSON.parse(this.data) as MetaState);
  }

  clear(): void {
    this.data = null;
  }
}

/**
 * Load the persisted profile (or a fresh one), re-applying unlocks so a stored state is always
 * consistent with its score even if the tranche table changed between sessions. The single entry
 * point the UI calls on boot.
 */
export function loadMeta(store: MetaStorePort): MetaState {
  const loaded = store.load();
  return loaded === null ? INITIAL_META_STATE : applyUnlocks(loaded);
}
