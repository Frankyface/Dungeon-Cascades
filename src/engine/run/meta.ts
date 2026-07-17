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
import { actFloorOffset } from './runConfig';
import { UNLOCKED_BY_DEFAULT_IDS } from './relics';
import { VARIANT_IDS, GOD_OF_WAR_ID } from './variants';

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
 * Won fight/elite encounters on a run's CURRENT-act map path: every visited fight/elite node
 * EXCEPT the one a defeat died in (a death only ever happens IN a combat node). Does NOT count
 * the boss (a `boss`-type node) — the caller adds that. Shared by `runScoreInput` and, at the act
 * transition, by the cross-act accumulation that banks a finished act's encounters (R2). Pure.
 */
export function currentActEncountersWon(state: RunState): number {
  const currentId = state.mapState.currentNodeId;
  let won = 0;
  for (const id of state.mapState.visited) {
    const type = nodeById(state.map, id).type;
    if (type !== 'fight' && type !== 'elite') continue;
    // The current node on a DEFEAT is the encounter that killed the player — not a win.
    if (id === currentId && state.status === 'defeat') continue;
    won++;
  }
  return won;
}

/**
 * Derive a terminal run's score inputs from its final `RunState`. CUMULATIVE across acts
 * (decisions.md 2026-07-17 R2): a 2-act run credits BOTH acts.
 * - `floorsCleared` = the deepest node's GLOBAL floor (`localFloor + actFloorOffset(act)`), so an
 *   Act-2 death/victory counts the whole 13-floor Act-1 depth beneath it. Act 1 is byte-identical
 *   (offset 0).
 * - `encountersWon` = the current act's won fights/elites (`currentActEncountersWon`) PLUS the
 *   `priorActsEncountersWon` banked from every completed act (each including that act's beaten
 *   boss), PLUS 1 for the terminal act's boss on a victory. A single-act run carries no prior
 *   acts (⇒ 0), so its score is unchanged from before R2.
 * Only meaningful once the run is terminal.
 */
export function runScoreInput(state: RunState): RunScoreInput {
  const victory = state.status === 'victory';
  const floorsCleared = currentRunNode(state).floor + actFloorOffset(state.act);
  let encountersWon = (state.priorActsEncountersWon ?? 0) + currentActEncountersWon(state);
  if (victory) encountersWon++; // the terminal act's boss (its node is 'boss', not counted above)

  return { floorsCleared, encountersWon, victory };
}

/** Convenience: the score a terminal run banks, straight from its final state. */
export function scoreForRun(state: RunState): number {
  return scoreRun(runScoreInput(state));
}

// ── Unlock tranches (cumulative-score milestones → variant unlocks) ───────────────────
//
// PACING ARITHMETIC (feature-meta-variants.md target: first unlock ~2–3 runs, full slate
// ~15–20 runs). R2 RE-DERIVATION (decisions.md 2026-07-17): with CUMULATIVE cross-act scoring a
// 2-act run now banks BOTH acts' floors+encounters, so the vanilla policy-bot mean rose from the
// old ≈20/run to ≈31.6/run (measured N=1000, seed 42, at the CURRENT untuned two-act balance:
// win rate ~7%). At that mean the thresholds below fire at:
//   T1  50 → ~1.6 runs     T4 210 → ~6.6 runs
//   T2 100 → ~3.2 runs     T5 290 → ~9.2 runs
//   T3 150 → ~4.7 runs     T6 360 → ~11.4 runs
// i.e. the first unlock still lands early but the full slate now completes faster than the 15–20
// window. The thresholds are the SIM-TUNING surface and are LEFT UNCHANGED this wave on purpose:
// the two-act win rate is still far below the spec §9 20–60% band, and lifting it there (the
// balance-tuning wave's job) will raise the mean AGAIN (victories add the +10 bonus + more
// cumulative encounters). Final tranche calibration therefore rides WITH the win-rate band re-tune,
// exactly like the run-sim balance BANDS are deferred to that wave (runSim.test.ts). Re-derive the
// thresholds against the tuned mean at that point.

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

/**
 * The one serializable meta object. Stage 4 gave it a cumulative score + the unlocked VARIANT set;
 * Stage-6 wave 2 (spec-systems.md §2) adds the CONTENT unlock & discovery model.
 *
 * The wave-2 fields are OPTIONAL — every read defaults to its fresh value via `??` (and `loadMeta`
 * runs them through `normalizeMeta`). This mirrors the RunState evolution pattern (`variantId?`,
 * `priorActsEncountersWon?`): an OLD save that predates these fields, or a partial test literal,
 * stays valid and loads as a fully-formed fresh-defaulted profile — no migration, no power creep.
 */
export interface MetaState {
  readonly score: number;
  /** Unlocked variant ids, in canonical (tranche) order. Vanilla is implicit — never listed. */
  readonly unlockedVariantIds: readonly string[];
  /**
   * Relic ids the player may draft/shop for (§2). Fresh = the base 12 (`UNLOCKED_BY_DEFAULT_IDS`);
   * expansion relics enter here via the biome-reached / boss-killed / Altar paths. Locked relics
   * NEVER appear in drafts/shops.
   */
  readonly unlockedRelicIds?: readonly string[];
  /** Enemy ids discovered for the compendium — added on first FIGHT, or on their biome's unlock. */
  readonly discoveredEnemyIds?: readonly string[];
  /** Boss ids discovered for the compendium — added on first KILL, or on their biome's unlock. */
  readonly discoveredBossIds?: readonly string[];
  /**
   * Act-2 biomes unlocked by REACHING them (§2a). `dungeon` (the always-present Act-1 biome) is
   * IMPLICIT and never listed — exactly like vanilla in `unlockedVariantIds` — so this set holds
   * only the four Act-2 biomes.
   */
  readonly unlockedBiomeIds?: readonly string[];
  /** True once all 5 bosses are discovered (spec §6 gate for Boss Rush). */
  readonly bossRushUnlocked?: boolean;
  /** True once Boss Rush is first WON (spec §6 / content-roles.md — unlocks the God of War class). */
  readonly godOfWarUnlocked?: boolean;
  /** Altar bookkeeping (§2c): how many relics have been permanently unlocked via Altar sacrifice. */
  readonly altarUnlockCount?: number;
}

/**
 * A fresh profile: no score, no variants, the base 12 relics unlocked, nothing discovered, no Act-2
 * biome reached, Boss Rush / God of War still locked. Fully-formed (every field populated) so the UI
 * gets a complete object; the fields stay optional on the type for backward-compat with old saves.
 */
export const INITIAL_META_STATE: MetaState = {
  score: 0,
  unlockedVariantIds: [],
  unlockedRelicIds: [...UNLOCKED_BY_DEFAULT_IDS],
  discoveredEnemyIds: [],
  discoveredBossIds: [],
  unlockedBiomeIds: [],
  bossRushUnlocked: false,
  godOfWarUnlocked: false,
  altarUnlockCount: 0,
};

/**
 * Fill any missing wave-2 fields of a (possibly old / partial) MetaState with their fresh defaults,
 * returning a fully-formed profile. Pure. Idempotent (a complete state is returned unchanged in
 * value). Used by `loadMeta` so the UI and unlock derivation always see every field.
 */
export function normalizeMeta(meta: MetaState): MetaState {
  return {
    score: meta.score,
    unlockedVariantIds: meta.unlockedVariantIds,
    unlockedRelicIds: meta.unlockedRelicIds ?? [...UNLOCKED_BY_DEFAULT_IDS],
    discoveredEnemyIds: meta.discoveredEnemyIds ?? [],
    discoveredBossIds: meta.discoveredBossIds ?? [],
    unlockedBiomeIds: meta.unlockedBiomeIds ?? [],
    bossRushUnlocked: meta.bossRushUnlocked ?? false,
    godOfWarUnlocked: meta.godOfWarUnlocked ?? false,
    altarUnlockCount: meta.altarUnlockCount ?? 0,
  };
}

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
 * always first, then the unlocked tranche variants in canonical order, and — ONLY once Boss Rush
 * has been won (`godOfWarUnlocked`) — the God of War prestige class LAST. God of War is never part
 * of the tranche set, so it appears here strictly by its own earned flag (spec §3). Kept as a list
 * of `string | null` so the UI can render "vanilla" as a real, always-present choice.
 */
export function selectableStarts(meta: MetaState): readonly (string | null)[] {
  const starts: (string | null)[] = [null, ...VARIANT_IDS.filter((id) => meta.unlockedVariantIds.includes(id))];
  if (meta.godOfWarUnlocked === true) starts.push(GOD_OF_WAR_ID);
  return starts;
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
  return loaded === null ? INITIAL_META_STATE : applyUnlocks(normalizeMeta(loaded));
}
