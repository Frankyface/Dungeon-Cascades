/**
 * Boss Rush mode (Stage-6 wave 2, spec-systems.md §6).
 *
 * Fight all FIVE bosses back-to-back — in the fixed thematic order dungeon → glacial → emberworks →
 * rotwood → sunken — each at ACT-2-BOSS scaling, with NO map. Between bosses the player heals a
 * fraction of max HP and takes ONE draft from their unlocked pool. Death ends the attempt (no meta
 * loss); the FIRST victory awards God of War (the caller applies `applyBossRushVictory`).
 *
 * Modeled as a lean, serializable, RESUMABLE `BossRushState` that REUSES the run's encounter +
 * boss-phase machinery (`startEncounterWithRelics` / `playTurnWithRelics` / `syncBossPhaseOf`) — no
 * duplicate turn engine. Gated on `meta.bossRushUnlocked`.
 *
 * PURE ENGINE: no React / React Native imports; deterministic (all seeds derive from the rush seed);
 * never mutates input.
 */
import { createRng } from '../board';
import type { Board, Path, TileSource } from '../board';
import type { BossId, CombatConfig, CombatState, Enemy, TurnResolution } from '../combat';
import { BOSSES } from './biomeBosses';
import type { Boss } from './boss';
import { bossEnemyForPhaseOf, bossMaxHpFor, syncBossPhaseOf } from './boss';
import { difficultyAt } from './mapGen';
import { startEncounterWithRelics, playTurnWithRelics } from './relicHooks';
import { draftOptions, applyDraft } from './draft';
import { deriveSeed } from './runSeeds';
import { ACT_FLOOR_SPAN, BOSS_NOMINAL_ENEMY_ID, RUN_PLAYER_MAX_HP } from './runConfig';
import { UNLOCKED_BY_DEFAULT_IDS } from './relics';
import type { RelicTier } from './relicTypes';
import type { MetaState } from './meta';

/** The five bosses in Boss-Rush order (dungeon → glacial → emberworks → rotwood → sunken). */
export const BOSS_RUSH_BOSSES: readonly Boss[] = BOSSES;

/** The Boss-Rush boss ids, in order (for the UI progress list / gating readouts). */
export const BOSS_RUSH_ORDER: readonly BossId[] = BOSS_RUSH_BOSSES.map((b) => b.id);

/** Every boss fights at the deepest (Act-2-boss) scaling: global floor `2·span − 1` (= 25). */
export const BOSS_RUSH_FLOOR = ACT_FLOOR_SPAN * 2 - 1;

/** HP healed between bosses, as a fraction of max HP (spec §6 "healing between bosses"). Sim-tunable. */
export const BOSS_RUSH_HEAL_FRACTION = 0.3;

/** The tier the between-boss draft weights toward (a boss-grade reward). Sim-tunable. */
export const BOSS_RUSH_DRAFT_TIER: RelicTier = 'epic';

/**
 * Pre-boss-1 LOADOUT CEREMONY (decisions.md 2026-07-17): epic-tier drafts the player takes from their
 * unlocked pool BEFORE fighting boss 1. A bare-fisted floor-25 Bone Colossus is wrong for a human, not
 * just a bot — the ceremony lets a Boss-Rush attempt open with a real build. Sim-tunable 1..3; the
 * between-boss interstitial heal + draft is unchanged. Served through the ordinary `draft` phase.
 */
export const BOSS_RUSH_PREDRAFT_COUNT = 3;

// Distinct seed tags so the encounter + draft streams never collide with a run's or each other's.
const TAG_BOSSRUSH_ENCOUNTER = 811;
const TAG_BOSSRUSH_DRAFT = 822;
const TAG_BOSSRUSH_PREDRAFT = 833;

/** What the player is doing in a Boss-Rush attempt. */
export type BossRushPhase =
  | { readonly kind: 'combat'; readonly encounter: CombatState; readonly bossPhase: number }
  | { readonly kind: 'draft'; readonly options: readonly string[] } // between bosses
  | { readonly kind: 'ended' };

/** The whole serializable Boss-Rush attempt (resumable — plain JSON-safe data). */
export interface BossRushState {
  readonly version: 1;
  readonly seed: number;
  /** Which boss (0..4 into `BOSS_RUSH_BOSSES`) is current / just cleared. */
  readonly bossIndex: number;
  readonly playerHp: number;
  readonly playerMaxHp: number;
  readonly relicIds: readonly string[];
  /** The meta pool snapshot the between-boss drafts filter to (absent ⇒ base 12). */
  readonly unlockedRelicIds?: readonly string[];
  /**
   * Pre-boss-1 loadout-ceremony drafts still to take (served through the `draft` phase). Present and
   * counting down from `BOSS_RUSH_PREDRAFT_COUNT` only during the ceremony; 0/absent everywhere after
   * (so a legacy save with no ceremony is treated as "ceremony done" and behaves exactly as before).
   */
  readonly predraftsRemaining?: number;
  readonly phase: BossRushPhase;
  readonly status: 'active' | 'victory' | 'defeat';
}

/** Optional combat injection (scripted refill / tuned config), mirroring `RunOptions`. */
export interface BossRushOptions {
  readonly source?: TileSource;
  readonly combatConfig?: CombatConfig;
}

/** Whether a Boss-Rush attempt has finished. */
export function isBossRushTerminal(state: BossRushState): boolean {
  return state.status !== 'active';
}

/** The scaled boss `Enemy` for `bossIndex` at Act-2-boss scaling (phase 0). */
function bossEnemyAt(bossIndex: number): Enemy {
  const boss = BOSS_RUSH_BOSSES[bossIndex];
  const diff = difficultyAt(BOSS_RUSH_FLOOR);
  return bossEnemyForPhaseOf(boss, 0, bossMaxHpFor(boss.baseHp, BOSS_RUSH_FLOOR), diff);
}

/** Begin the combat against the current `bossIndex`, carrying HP + relics in. */
function enterBoss(state: BossRushState, options: BossRushOptions): BossRushState {
  const encounterSeed = deriveSeed(deriveSeed(state.seed, TAG_BOSSRUSH_ENCOUNTER), state.bossIndex);
  const encounter = startEncounterWithRelics(BOSS_NOMINAL_ENEMY_ID, encounterSeed, state.relicIds, {
    source: options.source,
    config: options.combatConfig,
    startingPlayerHp: state.playerHp,
    enemy: bossEnemyAt(state.bossIndex),
  });
  return { ...state, playerHp: encounter.playerHp, phase: { kind: 'combat', encounter, bossPhase: 0 } };
}

/**
 * Open the next pre-boss-1 loadout-ceremony draft, or enter boss 0 once the ceremony is done. Each
 * pre-draft draws epic-tier options from the unlocked pool (excluding already-picked relics) on its
 * OWN seed stream. An empty pool (nothing epic left to offer) ends the ceremony early and enters boss
 * 0 — never a wedge. Pure; never mutates input.
 */
function openPredraft(state: BossRushState, options: BossRushOptions): BossRushState {
  const remaining = state.predraftsRemaining ?? 0;
  if (remaining <= 0) return enterBoss({ ...state, predraftsRemaining: 0 }, options);
  const predraftIndex = BOSS_RUSH_PREDRAFT_COUNT - remaining; // 0-based ceremony slot (distinct seed each)
  const draftSeed = deriveSeed(deriveSeed(state.seed, TAG_BOSSRUSH_PREDRAFT), predraftIndex);
  const { options: opts } = draftOptions(
    state.relicIds,
    createRng(draftSeed),
    BOSS_RUSH_DRAFT_TIER,
    state.unlockedRelicIds ?? UNLOCKED_BY_DEFAULT_IDS,
  );
  // Nothing left to offer ⇒ end the ceremony and go straight to boss 0 (no wedge, no empty draft).
  if (opts.length === 0) return enterBoss({ ...state, predraftsRemaining: 0 }, options);
  return { ...state, phase: { kind: 'draft', options: opts } };
}

/**
 * Begin a Boss-Rush attempt. Throws unless `meta.bossRushUnlocked` (spec §6 gate). Starts at full HP
 * with no relics, then opens the pre-boss-1 LOADOUT CEREMONY: `BOSS_RUSH_PREDRAFT_COUNT` epic-tier
 * drafts from `meta.unlockedRelicIds` BEFORE boss 1 (so the attempt opens with a build). The between-
 * boss drafts filter to the same pool.
 */
export function startBossRush(seed: number, meta: MetaState, options: BossRushOptions = {}): BossRushState {
  if (!(meta.bossRushUnlocked ?? false)) {
    throw new Error('startBossRush: Boss Rush is not unlocked (all 5 bosses must be discovered first)');
  }
  const base: BossRushState = {
    version: 1,
    seed,
    bossIndex: 0,
    playerHp: RUN_PLAYER_MAX_HP,
    playerMaxHp: RUN_PLAYER_MAX_HP,
    relicIds: [],
    predraftsRemaining: BOSS_RUSH_PREDRAFT_COUNT,
    ...(meta.unlockedRelicIds === undefined ? {} : { unlockedRelicIds: meta.unlockedRelicIds }),
    phase: { kind: 'ended' }, // replaced by openPredraft / enterBoss
    status: 'active',
  };
  return openPredraft(base, options);
}

/** The result of a Boss-Rush combat turn: the new state plus the animatable resolution. */
export interface BossRushTurnResult {
  readonly state: BossRushState;
  readonly resolution: TurnResolution;
}

/** Move a Boss-Rush attempt into a terminal status. */
function finalizeRush(state: BossRushState, status: 'victory' | 'defeat'): BossRushState {
  return { ...state, status, phase: { kind: 'ended' } };
}

/**
 * Play ONE Boss-Rush combat turn. Threads relics + the boss enemy through combat and re-syncs the
 * boss phase at the END of the turn (same "what you see is what fires" discipline as a run). A loss
 * ends the attempt (`defeat`); a win either advances (heal + a between-boss draft) or, after the
 * FIFTH boss, ends the attempt in `victory`. Requires an active attempt in the `combat` phase.
 */
export function playBossRushTurn(state: BossRushState, path: Path, options: BossRushOptions = {}): BossRushTurnResult {
  if (state.status !== 'active') throw new Error(`playBossRushTurn: attempt is already ${state.status}`);
  if (state.phase.kind !== 'combat') throw new Error(`playBossRushTurn: expected 'combat', got '${state.phase.kind}'`);
  const phase = state.phase;

  const boss = BOSS_RUSH_BOSSES[state.bossIndex];
  const diff = difficultyAt(BOSS_RUSH_FLOOR);

  // Defensive pre-move sync (a no-op for engine-produced states; corrects a legacy mid-transition save).
  const pre = syncBossPhaseOf(boss, phase.encounter, phase.bossPhase, phase.encounter.enemyMaxHp, diff);
  let encounter = pre.encounter;
  let bossPhase = pre.phase;

  const resolution = playTurnWithRelics(encounter, path, state.relicIds, {
    source: options.source,
    config: options.combatConfig,
  });
  const withHp: BossRushState = { ...state, playerHp: resolution.state.playerHp };

  if (resolution.status === 'lost') {
    return { state: finalizeRush(withHp, 'defeat'), resolution };
  }

  if (resolution.status === 'won') {
    // The fifth (last) boss down ⇒ Boss Rush cleared. Otherwise heal + open the between-boss draft.
    if (state.bossIndex >= BOSS_RUSH_BOSSES.length - 1) {
      return { state: finalizeRush(withHp, 'victory'), resolution };
    }
    const healed = Math.min(state.playerMaxHp, resolution.state.playerHp + Math.round(state.playerMaxHp * BOSS_RUSH_HEAL_FRACTION));
    const draftSeed = deriveSeed(deriveSeed(state.seed, TAG_BOSSRUSH_DRAFT), state.bossIndex);
    const { options: opts } = draftOptions(
      state.relicIds,
      createRng(draftSeed),
      BOSS_RUSH_DRAFT_TIER,
      state.unlockedRelicIds ?? UNLOCKED_BY_DEFAULT_IDS,
    );
    // An empty pool (everything owned/unlocked) skips straight to the next boss (no wedge).
    const next: BossRushState = { ...withHp, playerHp: healed };
    if (opts.length === 0) return { state: enterBoss({ ...next, bossIndex: next.bossIndex + 1 }, options), resolution };
    return { state: { ...next, phase: { kind: 'draft', options: opts } }, resolution };
  }

  // Ongoing: re-sync the boss phase now (end of the HP-crossing turn) so the stored telegraph fires next.
  let nextEncounter = resolution.state;
  let outResolution = resolution;
  const sync = syncBossPhaseOf(boss, nextEncounter, bossPhase, nextEncounter.enemyMaxHp, diff);
  if (sync.phase !== bossPhase) {
    nextEncounter = sync.encounter;
    bossPhase = sync.phase;
    outResolution = { ...resolution, state: nextEncounter, telegraph: nextEncounter.telegraph };
  }
  return {
    state: { ...withHp, phase: { kind: 'combat', encounter: nextEncounter, bossPhase } },
    resolution: outResolution,
  };
}

/**
 * Resolve a `draft` phase: add `pickedId` (or `null` to skip). A PRE-boss-1 ceremony draft
 * (`predraftsRemaining > 0`) consumes one pre-draft and opens the next (staying on boss 0's slot); a
 * BETWEEN-boss draft advances to the NEXT boss's combat. Requires an active attempt in the `draft`
 * phase; `pickedId` must be one of the options.
 */
export function resolveBossRushDraft(state: BossRushState, pickedId: string | null, options: BossRushOptions = {}): BossRushState {
  if (state.status !== 'active') throw new Error(`resolveBossRushDraft: attempt is already ${state.status}`);
  if (state.phase.kind !== 'draft') throw new Error(`resolveBossRushDraft: expected 'draft', got '${state.phase.kind}'`);
  if (pickedId !== null && !state.phase.options.includes(pickedId)) {
    throw new Error(`resolveBossRushDraft: '${pickedId}' is not an offered option`);
  }
  const relicIds = pickedId === null ? state.relicIds : applyDraft(state.relicIds, pickedId);
  const remaining = state.predraftsRemaining ?? 0;
  if (remaining > 0) {
    // Pre-boss-1 loadout ceremony: consume ONE pre-draft; stay on boss 0's slot (do NOT advance).
    return openPredraft({ ...state, relicIds, predraftsRemaining: remaining - 1 }, options);
  }
  // Between-boss draft: add the relic and advance to the NEXT boss's combat (unchanged).
  return enterBoss({ ...state, relicIds, bossIndex: state.bossIndex + 1 }, options);
}

/** The outcome of driving a whole Boss-Rush attempt headlessly (sim + the §9 completability check). */
export interface BossRushDriveResult {
  readonly state: BossRushState;
  readonly steps: number;
  /** True if the attempt terminated before the safety cap (no wedge). */
  readonly terminated: boolean;
  /** How many of the five bosses were beaten (5 on a victory). */
  readonly bossesCleared: number;
}

/**
 * Drive a whole Boss-Rush attempt to terminal with `combatPath` and a between-boss `draftPick`
 * (default: take the first offered relic). Pure and deterministic; `cap` guards a hypothetical wedge.
 * Used by the sim / the §9 "completable by the policy bot under dev-unlock" sanity check.
 */
export function driveBossRush(
  start: BossRushState,
  combatPath: (board: Board) => Path,
  draftPick: (options: readonly string[]) => string | null = (o) => (o.length > 0 ? o[0] : null),
  options: BossRushOptions = {},
  cap = 2000,
): BossRushDriveResult {
  let state = start;
  let steps = 0;
  while (state.status === 'active' && steps < cap) {
    if (state.phase.kind === 'combat') {
      state = playBossRushTurn(state, combatPath(state.phase.encounter.board), options).state;
    } else if (state.phase.kind === 'draft') {
      state = resolveBossRushDraft(state, draftPick(state.phase.options), options);
    } else {
      break; // ended (defensive)
    }
    steps++;
  }
  // bossesCleared: a victory beat all five; otherwise the bosses BEFORE the current index are cleared.
  const bossesCleared = state.status === 'victory' ? BOSS_RUSH_BOSSES.length : state.bossIndex;
  return { state, steps, terminated: state.status !== 'active', bossesCleared };
}
