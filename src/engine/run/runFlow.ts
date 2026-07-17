/**
 * The run flow — pure functions that drive a run through its phase state machine:
 * start → (enter node → resolve it → move to next)* → boss → victory | death anywhere.
 *
 * This module owns the ENCOUNTER + progression transitions (startRun, enterNode,
 * playEncounterTurn, resolveDraftPick, advanceToNode, abandonRun); the non-combat NODE
 * actions (shop / event / rest) live in runNodes.ts. Combat is reached only through the
 * wave-1 relic wrappers (`startEncounterWithRelics` / `playTurnWithRelics`), which thread the
 * player's relic modifiers AND the difficulty-scaled / boss enemy (via the `CombatState.enemy`
 * override) into combat — the combat turn machine is never duplicated. Terminal runs reject
 * every action.
 *
 * PURE ENGINE: no React / React Native imports; deterministic (all seeds derive from the run
 * seed); never mutates input.
 */
import { createRng } from '../board';
import type { CombatConfig, CombatState, EnemyId, Enemy, TurnResolution } from '../combat';
import type { TileSource } from '../board';
import { generateMap, difficultyAt } from './mapGen';
import { createMapState, currentNode, moveTo } from './mapNav';
import { mapSeedFor, mapSeedForAct, act2BiomeSeedFor, nodeSeedKey, enemySeedFor, encounterSeedFor, shopSeedFor, eventSeedFor, draftSeedFor, altarSeedFor } from './runSeeds';
import { selectEnemy, scaledEnemyFor, selectBiomeEnemy, scaledBiomeEnemyFor } from './enemyScaling';
import { bossEnemyForPhase, bossEnemyForPhaseOf, bossMaxHp, bossMaxHpFor, syncBossPhase, syncBossPhaseOf } from './boss';
import type { BossSyncResult } from './boss';
import { getBossForBiome } from './biomeBosses';
import { selectAct2Biome } from './biomes';
import {
  startEncounterWithRelics,
  playTurnWithRelics,
  cascadeWaveGold,
  enemyDefeatedGold,
  enemyDefeatedPlayerHeal,
  actStartGold,
  actStartPlayerHeal,
} from './relicHooks';
import { draftOptions, applyDraft } from './draft';
import { computeGoldReward } from './gold';
import { generateShop } from './shop';
import { eventForSeed } from './events';
import { createRestState } from './rest';
import { STARTING_GOLD } from './economyConfig';
import {
  BOSS_NOMINAL_ENEMY_ID,
  RUN_PLAYER_MAX_HP,
  ACT2_NOMINAL_ENEMY_ID,
  ACT_TRANSITION_HEAL_FRACTION,
  actFloorOffset,
} from './runConfig';
import { getVariant, resolveVariantStart } from './variants';
import type { RunVariant } from './variants';
import { currentActEncountersWon, normalizeMeta } from './meta';
import type { MetaState } from './meta';
import { pickAltarUnlock } from './altar';
import { applyAltarUnlock } from './unlocks';
import type { UnlockEvent } from './unlocks';
import { UNLOCKED_BY_DEFAULT_IDS } from './relics';
import { assertRunActive, assertRunPhase, currentRunNode } from './runTypes';
import type { EncounterKind, RunState, RunStatus } from './runTypes';
import type { Path } from '../board';

/** Optional injection for combat (scripted refill source / tuned config) — defaults to combat's. */
export interface RunOptions {
  readonly source?: TileSource;
  readonly combatConfig?: CombatConfig;
}

/** Move a run into a terminal status. */
function finalize(state: RunState, status: RunStatus): RunState {
  return { ...state, status, phase: { kind: 'ended' } };
}

/**
 * Begin a run: generate the map from the seed, park at the start node, full HP, no relics.
 *
 * `variantId` is OPTIONAL (Stage 4). When omitted the returned state is BYTE-IDENTICAL to a
 * pre-variant vanilla start (no `variantId` field, unchanged HP/gold/relics). When supplied it
 * reshapes ONLY the initial state via the variant's run-start modifiers (starting relics, gold,
 * max HP) and tags the run with the variant id — the rest of the run flows through the exact same
 * state machine. Throws on an unknown variant id (boundary validation).
 *
 * `unlockedRelicIds` is the OPTIONAL Stage-6 meta pool SNAPSHOT (the UI passes `meta.unlockedRelicIds`).
 * It is stored verbatim on the RunState so this run's drafts/shops/event-grants filter to it; when
 * omitted the field is absent and the pools fall back to the base 12 — a byte-identical vanilla start.
 */
export function startRun(seed: number, variantId?: string, unlockedRelicIds?: readonly string[]): RunState {
  const map = generateMap(mapSeedFor(seed));
  // The Act-2 biome is fixed at start (a pure function of the seed on its own RNG stream, so it
  // perturbs no Act-1 content and round-trips losslessly). It is inert until the act transition.
  const act2BiomeId = selectAct2Biome(createRng(act2BiomeSeedFor(seed))).biomeId;
  const base: RunState = {
    version: 1,
    seed,
    map,
    mapState: createMapState(map),
    playerHp: RUN_PLAYER_MAX_HP,
    playerMaxHp: RUN_PLAYER_MAX_HP,
    gold: STARTING_GOLD,
    relicIds: [],
    nodesCompleted: 0,
    act: 1,
    act2BiomeId,
    phase: { kind: 'awaiting_node' },
    status: 'active',
    // Snapshot the unlocked pool ONLY when supplied, so a snapshot-less start stays byte-identical.
    ...(unlockedRelicIds === undefined ? {} : { unlockedRelicIds }),
  };
  const started = variantId === undefined ? base : applyVariantStart(base, getVariant(variantId));
  // Act 1 IS the start of an act, so the `onActStart` relic hooks fire here too — not only at the
  // Act-1→Act-2 transition (`advanceAct`). This makes the three "each act" relics (content-relics.md:
  // pathfinders-map / wayfarers-draught / second-dawn) spec-accurate. It only affects a run that
  // OWNS such a relic at start — i.e. a variant-granted starting relic — so vanilla and every shipped
  // variant (none grant an onActStart relic) stay byte-identical: the fold returns the same values and
  // `applyActStart` returns the SAME object reference when nothing changed. The Act-1 heal caps against
  // a full-HP start (a no-op), matching advanceAct's cap discipline.
  return applyActStart(started);
}

/**
 * Fire the `onActStart` relic hooks (bonus gold + a capped bonus heal) at an act's start. Pure. When
 * no owned relic touches `onActStart` both folds are 0 and the SAME state object is returned, so a
 * vanilla / relic-less start is byte-identical (no new fields, no numeric change).
 */
function applyActStart(state: RunState): RunState {
  const gold = state.gold + actStartGold(state.relicIds);
  const playerHp = Math.min(state.playerMaxHp, state.playerHp + actStartPlayerHeal(state.relicIds));
  if (gold === state.gold && playerHp === state.playerHp) return state;
  return { ...state, gold, playerHp };
}

/**
 * Fold a variant's run-start modifiers into a fresh vanilla start. Pure: the run starts at full
 * (modified) max HP, gold is floored at 0, max HP at `MIN_VARIANT_MAX_HP`, and start relics are
 * added in order (skipping any the run already owns, which vanilla never does). The `revealMap`
 * flag is intentionally NOT stored on RunState — it is a property of the variant the UI reads by
 * id, and it has no engine/sim effect.
 */
function applyVariantStart(base: RunState, variant: RunVariant): RunState {
  const resolved = resolveVariantStart(base.playerMaxHp, base.gold, base.relicIds, variant.modifiers);
  return {
    ...base,
    playerMaxHp: resolved.maxHp,
    playerHp: resolved.maxHp, // a run always starts at full HP (of the variant's pool)
    gold: resolved.gold,
    relicIds: resolved.relicIds,
    variantId: variant.id,
  };
}

/** Begin a combat phase against a (scaled / boss) enemy, carrying the player's HP + relics in. */
function enterCombat(
  state: RunState,
  enemyId: EnemyId,
  enemyDef: Enemy,
  kind: EncounterKind,
  encounterSeed: number,
  options: RunOptions,
): RunState {
  const encounter = startEncounterWithRelics(enemyId, encounterSeed, state.relicIds, {
    source: options.source,
    config: options.combatConfig,
    startingPlayerHp: state.playerHp,
    enemy: enemyDef,
  });
  // Record the REAL enemy id fought (Act-2 biome enemies carry it on `enemyDef`, not the nominal
  // `enemyId`), for cross-act compendium discovery. Bosses are kill-gated, so they are NOT recorded.
  const foughtEnemyIds =
    kind === 'boss' || (state.foughtEnemyIds ?? []).includes(enemyDef.id)
      ? state.foughtEnemyIds
      : [...(state.foughtEnemyIds ?? []), enemyDef.id];
  return {
    ...state,
    playerHp: encounter.playerHp, // combat-start heals (e.g. Phoenix Feather) persist
    ...(foughtEnemyIds === state.foughtEnemyIds ? {} : { foughtEnemyIds }),
    phase: { kind: 'combat', encounter, encounterKind: kind, bossPhase: 0 },
  };
}

/**
 * Resolve the current node into its activity phase. fight/elite/boss → a combat phase against
 * a difficulty-scaled (or boss) enemy; shop/event/rest → the matching interaction phase. Every
 * per-node draw is seeded by the node's coordinate, so content is path-independent.
 */
export function enterNode(state: RunState, options: RunOptions = {}): RunState {
  assertRunActive(state);
  assertRunPhase(state, 'awaiting_node');
  const node = currentNode(state.map, state.mapState);
  // Difficulty + every per-node seed key use the GLOBAL floor (Act-2 continues the curve: local
  // floor f in act A → global f + actFloorOffset(A)). Act 1's offset is 0, so its keys/difficulty
  // are byte-identical to the pre-two-act engine; Act 2's offset (13) both hardens the curve and
  // keeps Act-2 node seeds distinct from Act-1's same-coordinate nodes.
  const globalFloor = node.floor + actFloorOffset(state.act);
  const key = nodeSeedKey(globalFloor, node.index);

  switch (node.type) {
    case 'fight':
    case 'elite': {
      const isElite = node.type === 'elite';
      if (state.act === 1) {
        // The Act-1 opening encounter (floor 0) is always the intro slime (docs/decisions.md calls
        // slime "the intro enemy") — a gentle on-ramp that prevents a catastrophic first-fight
        // skeleton before the player owns any relics. Later floors draw the full pool by coordinate.
        const enemyId = node.floor === 0 ? 'slime' : selectEnemy(createRng(enemySeedFor(state.seed, key))).enemyId;
        const enemyDef = scaledEnemyFor(enemyId, globalFloor, isElite);
        return enterCombat(state, enemyId, enemyDef, isElite ? 'elite' : 'fight', encounterSeedFor(state.seed, key), options);
      }
      // Act 2: draw from the run's Act-2 biome kit (four biome enemies). The player is established
      // (relics + the transition heal), so there is no on-ramp special case. The biome enemy reaches
      // combat through the `enemy` override; the narrow `enemyId` is the nominal placeholder.
      const biomeEnemyId = selectBiomeEnemy(createRng(enemySeedFor(state.seed, key)), state.act2BiomeId).enemyId;
      const enemyDef = scaledBiomeEnemyFor(biomeEnemyId, globalFloor, isElite);
      return enterCombat(state, ACT2_NOMINAL_ENEMY_ID, enemyDef, isElite ? 'elite' : 'fight', encounterSeedFor(state.seed, key), options);
    }
    case 'boss': {
      const diff = difficultyAt(globalFloor);
      if (state.act === 1) {
        // Act-1 boss = the Bone Colossus on the exact existing byte-identical path.
        const enemyDef = bossEnemyForPhase(0, bossMaxHp(globalFloor), diff);
        return enterCombat(state, BOSS_NOMINAL_ENEMY_ID, enemyDef, 'boss', encounterSeedFor(state.seed, key), options);
      }
      // Act-2 boss = the run's Act-2 biome boss, driven through the generic per-boss phase machinery.
      const boss = getBossForBiome(state.act2BiomeId);
      const enemyDef = bossEnemyForPhaseOf(boss, 0, bossMaxHpFor(boss.baseHp, globalFloor), diff);
      return enterCombat(state, BOSS_NOMINAL_ENEMY_ID, enemyDef, 'boss', encounterSeedFor(state.seed, key), options);
    }
    case 'shop': {
      // Thread the run's meta pool SNAPSHOT (§2): the shop stocks only unlocked, unowned relics.
      // Absent snapshot ⇒ generateShop's base-12 default ⇒ byte-identical to the pre-wave-2 shop.
      const { shop } = generateShop(state.relicIds, createRng(shopSeedFor(state.seed, key)), state.unlockedRelicIds);
      return { ...state, phase: { kind: 'shop', shop } };
    }
    case 'event': {
      const { eventId, rngState } = eventForSeed(createRng(eventSeedFor(state.seed, key)));
      return { ...state, phase: { kind: 'event', eventId, rngState } };
    }
    case 'rest':
      return { ...state, phase: { kind: 'rest', rest: createRestState() } };
    case 'altar':
      // Seed the altar's rarity-roll + relic-pick stream from the node coordinate (path-independent,
      // survives save/load). The pick itself waits until the player commits (`sacrificeAtAltar`).
      return { ...state, phase: { kind: 'altar', rngState: createRng(altarSeedFor(state.seed, key)) } };
  }
}

/** The result of a combat turn: the new run state plus the animatable combat resolution. */
export interface EncounterTurnResult {
  readonly state: RunState;
  readonly resolution: TurnResolution;
}

/**
 * Play one combat turn. Threads relic modifiers + the difficulty scalar/boss enemy through
 * combat (the boss re-syncs its phase — and its affinity shift — at the END of the turn that
 * crossed an HP threshold, so the outgoing telegraph always belongs to the acting phase). A
 * win pays
 * performance-scaled gold and opens a draft (fight/elite) or ends the run in victory (boss); a
 * loss (player HP ≤ 0) ends the run in defeat.
 */
export function playEncounterTurn(state: RunState, path: Path, options: RunOptions = {}): EncounterTurnResult {
  assertRunActive(state);
  assertRunPhase(state, 'combat');
  const phase = state.phase;
  if (phase.kind !== 'combat') throw new Error('unreachable'); // narrow for TS

  let encounter = phase.encounter;
  let bossPhase = phase.bossPhase;
  const isBoss = phase.encounterKind === 'boss';
  const bossDiff = isBoss ? difficultyAt(currentNode(state.map, state.mapState).floor + actFloorOffset(state.act)) : 0;
  // Which boss's phase data drives the sync: Act 1 = the Bone Colossus (narrow `syncBossPhase`,
  // byte-identical); Act 2 = the run's biome boss (generic `syncBossPhaseOf`).
  const runBoss = isBoss && state.act === 2 ? getBossForBiome(state.act2BiomeId) : null;
  const syncBoss = (enc: CombatState, ph: number): BossSyncResult =>
    runBoss === null
      ? syncBossPhase(enc, ph, enc.enemyMaxHp, bossDiff)
      : syncBossPhaseOf(runBoss, enc, ph, enc.enemyMaxHp, bossDiff);

  // Boss: defensive pre-move re-sync. Since the end-of-turn sync below (fix 2026-07-16) keeps
  // the stored phase/telegraph in step with HP, this is a NO-OP for any state this engine
  // produces — it only corrects a legacy save persisted mid-transition by a pre-fix build.
  if (isBoss) {
    const sync = syncBoss(encounter, bossPhase);
    encounter = sync.encounter;
    bossPhase = sync.phase;
  }

  const resolution = playTurnWithRelics(encounter, path, state.relicIds, {
    source: options.source,
    config: options.combatConfig,
  });
  // Bank the onCascadeWave GOLD channel here (wave 1b contract): the enemy-damage + player-heal
  // channels are applied INSIDE combat by playTurnWithRelics; gold is a run-layer concern banked at
  // resolution — never double-applied. It is 0 unless an owned relic feeds `gold` per cascade wave.
  const cascadeGold = cascadeWaveGold(resolution.move.waves.length, state.relicIds);
  const withHp: RunState = { ...state, playerHp: resolution.state.playerHp, gold: state.gold + cascadeGold };

  if (resolution.status === 'lost') {
    return { state: finalize(withHp, 'defeat'), resolution };
  }

  if (resolution.status === 'won') {
    const isBossKind = phase.encounterKind === 'boss';
    const isElite = phase.encounterKind === 'elite';
    // Performance-scaled gold pays on a fight/elite win; the boss pays no draft gold.
    const perfGold = isBossKind
      ? 0
      : computeGoldReward(
          { turns: resolution.state.turn, hpRetained: resolution.state.playerHp, maxHp: state.playerMaxHp, isElite },
          state.relicIds,
        );
    // onEnemyDefeated relic side-channels (wave 1b) fire once per defeated enemy — bonus gold and a
    // capped bonus heal — on EVERY combat win (fight, elite, boss). 0 without an owned relic.
    const bonusGold = enemyDefeatedGold(state.relicIds);
    const healedHp = Math.min(state.playerMaxHp, resolution.state.playerHp + enemyDefeatedPlayerHeal(state.relicIds));
    const won: RunState = { ...withHp, playerHp: healedHp, gold: withHp.gold + perfGold + bonusGold };

    if (isBossKind) {
      // Act-1 boss beaten → the act transition (heal + onActStart + Act-2 map are applied by
      // `advanceAct`). Act-2 boss beaten → run victory.
      if (state.act === 1) {
        return { state: { ...won, phase: { kind: 'act_transition' } }, resolution };
      }
      return { state: finalize(won, 'victory'), resolution };
    }

    // Post-win draft (pick-1-of-3); empty pool ⇒ skip straight to the move choice (no wedge). The
    // draft seed uses the GLOBAL floor so Act-2 drafts never collide with Act-1's same-coordinate node.
    const node = currentNode(state.map, state.mapState);
    const { options: opts } = draftOptions(
      state.relicIds,
      createRng(draftSeedFor(state.seed, nodeSeedKey(node.floor + actFloorOffset(state.act), node.index))),
      isElite ? 'epic' : 'common', // migration-mechanical: relic tiers normal→common, elite→epic
      state.unlockedRelicIds, // §2 pool snapshot (absent ⇒ base-12 default ⇒ byte-identical)
    );
    const phaseNext: RunState['phase'] = opts.length === 0 ? { kind: 'awaiting_move' } : { kind: 'draft', options: opts };
    return { state: { ...won, phase: phaseNext }, resolution };
  }

  // Ongoing: keep fighting. Boss: re-sync the phase NOW — at the END of the turn whose damage
  // may have crossed an HP threshold — so the telegraph stored (and shown) after this turn
  // already belongs to the phase that will actually act ("what you see is what fires" holds
  // across phase transitions; the fired action itself is unchanged — the new phase's script[0]
  // fired on the next turn either way, it just used to be un-telegraphed). `syncBossPhase`
  // reads the desired phase straight from current HP, so a turn crossing TWO thresholds swaps
  // directly from phase 0 to phase 2. After a swap the new phase starts at intentIndex 0 with
  // script[0] telegraphed — a clean, fully visible opening for the new script. The returned
  // resolution mirrors the synced state/telegraph so the UI animates exactly what will fire,
  // and save/load mid-transition persists the already-synced encounter (transcript equality).
  let nextEncounter = resolution.state;
  let outResolution = resolution;
  if (isBoss) {
    const sync = syncBoss(nextEncounter, bossPhase);
    if (sync.phase !== bossPhase) {
      nextEncounter = sync.encounter;
      bossPhase = sync.phase;
      outResolution = { ...resolution, state: nextEncounter, telegraph: nextEncounter.telegraph };
    }
  }
  return {
    state: { ...withHp, phase: { kind: 'combat', encounter: nextEncounter, encounterKind: phase.encounterKind, bossPhase } },
    resolution: outResolution,
  };
}

/**
 * Resolve the ACT TRANSITION after the Act-1 boss (spec-systems.md §1): heal the player by
 * `ACT_TRANSITION_HEAL_FRACTION` of max HP (capped), fire the wave-1b `onActStart` relic hooks
 * (bonus gold + a capped bonus heal), then generate the Act-2 map in the run's Act-2 biome and park
 * at its start node in `act: 2`. Pure; requires an active run in the `act_transition` phase.
 */
export function advanceAct(state: RunState): RunState {
  assertRunActive(state);
  assertRunPhase(state, 'act_transition');

  // 1. Transition heal — heal BY a fraction of max HP (capped), mirroring the rest-node convention.
  const transitionHeal = Math.round(state.playerMaxHp * ACT_TRANSITION_HEAL_FRACTION);
  let playerHp = Math.min(state.playerMaxHp, state.playerHp + transitionHeal);
  // 2. onActStart relic hooks (wave 1b): bonus gold + a capped bonus heal on top of the transition.
  const gold = state.gold + actStartGold(state.relicIds);
  playerHp = Math.min(state.playerMaxHp, playerHp + actStartPlayerHeal(state.relicIds));
  // 3. Bank the just-finished Act-1 encounters for CUMULATIVE cross-act scoring (R2) BEFORE the
  // Act-1 map is discarded: every won fight/elite on the Act-1 path PLUS the Act-1 boss just beaten.
  const priorActsEncountersWon = (state.priorActsEncountersWon ?? 0) + currentActEncountersWon(state) + 1;
  // 4. Generate the Act-2 map (same generator, independent layout stream) and park at its start.
  const map = generateMap(mapSeedForAct(state.seed, 2));
  return {
    ...state,
    act: 2,
    playerHp,
    gold,
    map,
    mapState: createMapState(map),
    priorActsEncountersWon,
    phase: { kind: 'awaiting_node' },
  };
}

/**
 * Resolve a post-win draft. `pickedId` must be one of the offered options (adds the relic); or
 * `null` to skip. Either way the run advances to the move-choice phase.
 */
export function resolveDraftPick(state: RunState, pickedId: string | null): RunState {
  assertRunActive(state);
  assertRunPhase(state, 'draft');
  const phase = state.phase;
  if (phase.kind !== 'draft') throw new Error('unreachable');

  if (pickedId !== null && !phase.options.includes(pickedId)) {
    throw new Error(`resolveDraftPick: '${pickedId}' is not an offered option`);
  }
  const relicIds = pickedId === null ? state.relicIds : applyDraft(state.relicIds, pickedId);
  return { ...state, relicIds, phase: { kind: 'awaiting_move' } };
}

/** Move to a legal next node (from the move-choice phase). Throws on an illegal jump. */
export function advanceToNode(state: RunState, nodeId: string): RunState {
  assertRunActive(state);
  assertRunPhase(state, 'awaiting_move');
  const mapState = moveTo(state.map, state.mapState, nodeId); // guards illegal jumps
  return { ...state, mapState, nodesCompleted: state.nodesCompleted + 1, phase: { kind: 'awaiting_node' } };
}

/** Abandon the run: an immediate terminal defeat (giving up counts as a loss). */
export function abandonRun(state: RunState): RunState {
  assertRunActive(state);
  return finalize(state, 'defeat');
}

/** The result of an Altar sacrifice: the terminal run, the new meta, and the unlock event(s). */
export interface AltarSacrificeResult {
  readonly state: RunState;
  readonly meta: MetaState;
  readonly events: readonly UnlockEvent[];
  /** The relic unlocked (null only if literally EVERY relic is already unlocked). */
  readonly relicId: string | null;
}

/**
 * SACRIFICE the run at an Altar (spec §2c): end it NOW to permanently unlock ONE not-yet-unlocked
 * relic. The run becomes terminal `sacrificed` (banks score as a defeat — the UI clears the save);
 * the relic is chosen by the altar's seeded, DEPTH-SCALED draw from META's LOCKED pool
 * (`pickAltarUnlock`) and folded into the profile via `applyAltarUnlock` (an immediate META event,
 * even though the run died — the whole point). Pure: returns the new run + meta + events; the caller
 * persists the meta and surfaces the ceremony. Requires an active run in the `altar` phase.
 */
export function sacrificeAtAltar(state: RunState, meta: MetaState): AltarSacrificeResult {
  assertRunActive(state);
  assertRunPhase(state, 'altar');
  const phase = state.phase;
  if (phase.kind !== 'altar') throw new Error('unreachable');

  const floor = currentRunNode(state).floor;
  const norm = normalizeMeta(meta);
  const pick = pickAltarUnlock(phase.rngState, norm.unlockedRelicIds ?? UNLOCKED_BY_DEFAULT_IDS, state.act, floor);
  const unlock =
    pick.relicId === null ? { meta: norm, events: [] as readonly UnlockEvent[] } : applyAltarUnlock(norm, pick.relicId);

  return {
    state: finalize(state, 'sacrificed'),
    meta: unlock.meta,
    events: unlock.events,
    relicId: pick.relicId,
  };
}

/** Leave the altar WITHOUT sacrificing (a no-op node) — advance to the move-choice phase. */
export function leaveAltar(state: RunState): RunState {
  assertRunActive(state);
  assertRunPhase(state, 'altar');
  return { ...state, phase: { kind: 'awaiting_move' } };
}
