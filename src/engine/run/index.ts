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
