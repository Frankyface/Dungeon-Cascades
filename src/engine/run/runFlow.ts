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
import type { CombatConfig, EnemyId, Enemy, TurnResolution } from '../combat';
import type { TileSource } from '../board';
import { generateMap, difficultyAt } from './mapGen';
import { createMapState, currentNode, moveTo } from './mapNav';
import { mapSeedFor, nodeSeedKey, enemySeedFor, encounterSeedFor, shopSeedFor, eventSeedFor, draftSeedFor } from './runSeeds';
import { selectEnemy, scaledEnemyFor } from './enemyScaling';
import { bossEnemyForPhase, bossMaxHp, syncBossPhase } from './boss';
import { startEncounterWithRelics, playTurnWithRelics } from './relicHooks';
import { draftOptions, applyDraft } from './draft';
import { computeGoldReward } from './gold';
import { generateShop } from './shop';
import { eventForSeed } from './events';
import { createRestState } from './rest';
import { STARTING_GOLD } from './economyConfig';
import { BOSS_NOMINAL_ENEMY_ID, RUN_PLAYER_MAX_HP } from './runConfig';
import { getVariant, resolveVariantStart } from './variants';
import type { RunVariant } from './variants';
import { assertRunActive, assertRunPhase } from './runTypes';
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
 */
export function startRun(seed: number, variantId?: string): RunState {
  const map = generateMap(mapSeedFor(seed));
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
    phase: { kind: 'awaiting_node' },
    status: 'active',
  };
  if (variantId === undefined) return base;
  return applyVariantStart(base, getVariant(variantId));
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
  return {
    ...state,
    playerHp: encounter.playerHp, // combat-start heals (e.g. Phoenix Feather) persist
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
  const key = nodeSeedKey(node.floor, node.index);

  switch (node.type) {
    case 'fight':
    case 'elite': {
      const isElite = node.type === 'elite';
      // The opening encounter (floor 0) is always the intro slime (docs/decisions.md calls slime
      // "the intro enemy") — this makes the first fight a gentle on-ramp and prevents a
      // catastrophic first-fight skeleton before the player owns any relics. Later floors draw
      // the full pool seeded by node coordinate.
      const enemyId = node.floor === 0 ? 'slime' : selectEnemy(createRng(enemySeedFor(state.seed, key))).enemyId;
      const enemyDef = scaledEnemyFor(enemyId, node.floor, isElite);
      return enterCombat(state, enemyId, enemyDef, isElite ? 'elite' : 'fight', encounterSeedFor(state.seed, key), options);
    }
    case 'boss': {
      const diff = difficultyAt(node.floor);
      const enemyDef = bossEnemyForPhase(0, bossMaxHp(node.floor), diff);
      return enterCombat(state, BOSS_NOMINAL_ENEMY_ID, enemyDef, 'boss', encounterSeedFor(state.seed, key), options);
    }
    case 'shop': {
      const { shop } = generateShop(state.relicIds, createRng(shopSeedFor(state.seed, key)));
      return { ...state, phase: { kind: 'shop', shop } };
    }
    case 'event': {
      const { eventId, rngState } = eventForSeed(createRng(eventSeedFor(state.seed, key)));
      return { ...state, phase: { kind: 'event', eventId, rngState } };
    }
    case 'rest':
      return { ...state, phase: { kind: 'rest', rest: createRestState() } };
  }
}

/** The result of a combat turn: the new run state plus the animatable combat resolution. */
export interface EncounterTurnResult {
  readonly state: RunState;
  readonly resolution: TurnResolution;
}

/**
 * Play one combat turn. Threads relic modifiers + the difficulty scalar/boss enemy through
 * combat (the boss re-syncs its phase — and its affinity shift — before the move). A win pays
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

  // Boss: re-sync the phase (and its affinity shift) to current HP before the move.
  if (phase.encounterKind === 'boss') {
    const node = currentNode(state.map, state.mapState);
    const sync = syncBossPhase(encounter, bossPhase, encounter.enemyMaxHp, difficultyAt(node.floor));
    encounter = sync.encounter;
    bossPhase = sync.phase;
  }

  const resolution = playTurnWithRelics(encounter, path, state.relicIds, {
    source: options.source,
    config: options.combatConfig,
  });
  const withHp: RunState = { ...state, playerHp: resolution.state.playerHp };

  if (resolution.status === 'lost') {
    return { state: finalize(withHp, 'defeat'), resolution };
  }

  if (resolution.status === 'won') {
    const isElite = phase.encounterKind === 'elite';
    const gold = computeGoldReward(
      { turns: resolution.state.turn, hpRetained: resolution.state.playerHp, maxHp: state.playerMaxHp, isElite },
      state.relicIds,
    );
    const won: RunState = { ...withHp, gold: state.gold + gold };

    if (phase.encounterKind === 'boss') {
      return { state: finalize(won, 'victory'), resolution };
    }

    // Post-win draft (pick-1-of-3); empty pool ⇒ skip straight to the move choice (no wedge).
    const node = currentNode(state.map, state.mapState);
    const { options: opts } = draftOptions(
      state.relicIds,
      createRng(draftSeedFor(state.seed, nodeSeedKey(node.floor, node.index))),
      isElite ? 'elite' : 'normal',
    );
    const phaseNext: RunState['phase'] = opts.length === 0 ? { kind: 'awaiting_move' } : { kind: 'draft', options: opts };
    return { state: { ...won, phase: phaseNext }, resolution };
  }

  // Ongoing: keep fighting (thread the re-synced boss phase forward).
  return {
    state: { ...withHp, phase: { kind: 'combat', encounter: resolution.state, encounterKind: phase.encounterKind, bossPhase } },
    resolution,
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
