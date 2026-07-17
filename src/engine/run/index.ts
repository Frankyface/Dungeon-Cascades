/**
 * Public API of the Dungeon Cascades run engine (Stage 3 — map + relics).
 *
 * Consumers: the (later) run-lifecycle layer, the headless sim, and the Skia UI.
 * Everything here is pure, deterministic, and serializable — no React / React Native
 * imports, no ambient time or randomness (seeded PRNG only). The run engine sits ABOVE
 * the board and combat engines and never modifies them; relic effects reach combat solely
 * through combat's optional `CombatModifiers` seam.
 */

// ── Node map ─────────────────────────────────────────────────────────────────
export type { NodeType, MapNode, RunMap, MapState } from './mapTypes';
export type { FloorRole, MapConfig } from './mapConfig';
export {
  DEFAULT_MAP_CONFIG,
  DEFAULT_FLOOR_PLAN,
  ENCOUNTER_MIN,
  ENCOUNTER_MAX,
  REST_MIN,
  ELITE_MIN_TOTAL,
  SHOP_COUNT,
} from './mapConfig';
export { generateMap, difficultyAt, isEncounter, validateMap } from './mapGen';
export {
  createMapState,
  legalNextNodes,
  canMoveTo,
  moveTo,
  currentNode,
  nodeById,
  nodesOnFloor,
  isComplete,
} from './mapNav';

// ── Run seed derivation ──────────────────────────────────────────────────────
export { deriveSeed, mapSeedFor, draftSeedFor, RUN_TAG_MAP, RUN_TAG_DRAFT } from './runSeeds';

// ── Relics: data model + roster ──────────────────────────────────────────────
export type { HookName, RelicTier, RelicModifier, Relic, RelicContext, RelicRegistry } from './relicTypes';
export { HOOK_NAMES } from './relicTypes';
export { ROSTER, RELIC_REGISTRY, RELIC_IDS, getRelic, assertRosterWellFormed } from './relics';

// ── Relics: hook engine + combat integration ─────────────────────────────────
export {
  applyRelicHooks,
  buildCombatModifiers,
  combatStartEnemyChip,
  combatStartPlayerHeal,
  turnStartRegen,
  applyGoldRelics,
  startEncounterWithRelics,
  playTurnWithRelics,
} from './relicHooks';
export type { RelicEncounterOptions } from './relicHooks';

// ── Relics: drafting ─────────────────────────────────────────────────────────
export { draftOptions, applyDraft, DRAFT_OPTION_COUNT, DRAFT_WEIGHT_MATCH, DRAFT_WEIGHT_OFF } from './draft';
export type { DraftResult } from './draft';

// ── Run seed tree (wave-2 per-node sub-streams) ──────────────────────────────
export {
  RUN_TAG_ENEMY,
  RUN_TAG_ENCOUNTER,
  RUN_TAG_SHOP,
  RUN_TAG_EVENT,
  nodeSeedKey,
  enemySeedFor,
  encounterSeedFor,
  shopSeedFor,
  eventSeedFor,
} from './runSeeds';

// ── Economy: config + performance-scaled gold ────────────────────────────────
export {
  GOLD_BASE,
  GOLD_SPEED_BONUS_MAX,
  GOLD_MEDIAN_TURNS,
  GOLD_HP_BONUS_MAX,
  ELITE_GOLD_MULT,
  STARTING_GOLD,
  SHOP_RELIC_MIN,
  SHOP_RELIC_MAX,
  SHOP_PRICE_NORMAL,
  SHOP_PRICE_ELITE,
  SHOP_HEAL_AMOUNT,
  SHOP_HEAL_PRICE,
  REST_HEAL_FRACTION,
  EVENT_RELIC_FALLBACK_GOLD,
  EVENT_MIN_HP,
  DEFAULT_ECONOMY_CONFIG,
} from './economyConfig';
export type { EconomyConfig } from './economyConfig';
export { computeGoldReward } from './gold';
export type { GoldContext } from './gold';

// ── Economy: shop / rest / events ────────────────────────────────────────────
export { generateShop, buyShopItem, shopHasLegalAction } from './shop';
export type { ShopItem, ShopRelicItem, ShopHealItem, ShopState, ShopGenResult, BuyResult, BuyRejection } from './shop';
export { createRestState, restHeal, applyRest } from './rest';
export type { RestState, RestResult } from './rest';
export { EVENTS, EVENT_IDS, getEvent, eventForSeed, resolveEventChoice, applyEventEffect, eventHasLegalAction } from './events';
export type {
  GameEvent,
  EventChoice,
  EventOutcome,
  EventGamble,
  EventEffect,
  EventApplyState,
  EventApplyResult,
} from './events';

// ── Run lifecycle: difficulty config, enemy scaling, boss ─────────────────────
export {
  ENCOUNTER_POOL,
  RUN_PLAYER_MAX_HP,
  HP_DIFFICULTY_DAMPEN,
  ATTACK_DIFFICULTY_DAMPEN,
  ELITE_HP_MULT,
  ELITE_ATTACK_MULT,
  BOSS_BASE_HP,
  BOSS_HP_DAMPEN,
  BOSS_NOMINAL_ENEMY_ID,
  BOSS_NAME,
} from './runConfig';
export { scaleEnemy, scaledEnemyFor, selectEnemy } from './enemyScaling';
export {
  BOSS_PHASES,
  bossMaxHp,
  bossMaxHpFor,
  bossPhaseForHp,
  bossEnemyForPhase,
  bossEnemyForPhaseOf,
  syncBossPhase,
} from './boss';
export type { Boss, BossPhase, BossSyncResult } from './boss';

// ── Stage-6: biome bosses + biome registry ───────────────────────────────────
export {
  BIOME_BOSS_BASE_HP,
  BONE_COLOSSUS,
  RIMEHEART,
  FORGEHEART,
  THE_ROTMOTHER,
  DROWNED_SOVEREIGN,
  BOSS_REGISTRY,
  BOSSES,
  getBossForBiome,
} from './biomeBosses';
export {
  BIOMES,
  BIOME_IDS,
  ACT2_BIOME_IDS,
  getBiome,
  assertBiomesWellFormed,
} from './biomes';
export type { Biome } from './biomes';

// ── Run state + flow (the lifecycle state machine) ───────────────────────────
export type { RunState, RunPhase, RunStatus, EncounterKind, RunAction } from './runTypes';
export { isTerminal, legalActions, currentRunNode, assertRunActive, assertRunPhase } from './runTypes';
export { startRun, enterNode, playEncounterTurn, resolveDraftPick, advanceToNode, abandonRun } from './runFlow';
export type { RunOptions, EncounterTurnResult } from './runFlow';
export { buyFromShop, leaveShop, chooseEventOption, restAtNode, leaveRest } from './runNodes';
export type { ShopBuyResult } from './runNodes';

// ── Save/load port + deterministic scripted policies (headless play) ─────────
export { InMemoryRunStore, saveOnNodeCompletion } from './runStore';
export type { RunStorePort } from './runStore';
export { greedyComboPath, trivialSwapPath, stepRun, driveRun } from './runPolicy';
export type { DriveResult } from './runPolicy';

// ── Stage 4: starting variants (power-neutral run-start sidegrades) ───────────
export {
  VARIANTS,
  VARIANT_REGISTRY,
  VARIANT_IDS,
  MIN_VARIANT_MAX_HP,
  getVariant,
  resolveVariantStart,
  assertVariantsWellFormed,
} from './variants';
export type { RunVariant, VariantModifiers, ResolvedVariantStart } from './variants';

// ── Stage 4: meta-progression (cumulative score, tranche unlocks, persistence) ─
export {
  META_SCORE_PER_FLOOR,
  META_SCORE_PER_ENCOUNTER_WON,
  META_VICTORY_BONUS,
  INITIAL_META_STATE,
  UNLOCK_TRANCHES,
  scoreRun,
  runScoreInput,
  scoreForRun,
  unlockedAtScore,
  applyUnlocks,
  bankRun,
  isVariantUnlocked,
  selectableStarts,
  loadMeta,
  InMemoryMetaStore,
} from './meta';
export type { MetaState, MetaStorePort, RunScoreInput, UnlockTranche } from './meta';
