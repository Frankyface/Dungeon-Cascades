/**
 * Node-map configuration — ALL tunable constants of the Stage-3 run map in one module,
 * so retuning route tension is a single-file change (docs/decisions.md: "the interesting
 * design surface is data the sims + Cam tune, not architecture").
 *
 * WHY THE FLOOR COUNT IS ~13, NOT ~7 (flagged deviation): the feature spec's soft target
 * ("~7 floors deep", an explicit Open Question / "starting point") is in tension with its
 * HARD acceptance gate — "any start→boss path contains 8–12 encounters (fights+elite),
 * ≥1 rest, and the boss terminal". Since a path visits exactly one node per floor, ≥8
 * encounters + ≥1 rest + boss forces ≥10 floors. The hard gate wins; the plan below is
 * arithmetically pinned to yield 9–11 encounters/path (see FLOOR_PLAN comment). Floor
 * count is data here, so sim/Cam can reshape it freely.
 *
 * PURE ENGINE: no React / React Native imports; no wall-clock or ambient randomness.
 */

/**
 * The template ROLE of a floor. Node types are assigned per-role so per-path
 * distribution constraints hold BY CONSTRUCTION (every path visits one node per floor):
 * - `start`  : one `fight` node (the run's opening encounter + first branch).
 * - `encounter`: every node is an encounter (`fight` or `elite`).
 * - `shop`   : a "mixed" floor — encounters plus exactly ONE `shop` node.
 * - `event`  : a "mixed" floor — encounters plus exactly ONE `event` node.
 * - `rest`   : every node is a `rest` (guarantees ≥1 rest on every path).
 * - `boss`   : one terminal `boss` node.
 */
export type FloorRole = 'start' | 'encounter' | 'shop' | 'event' | 'rest' | 'boss';

/** Full, serializable tuning surface for map generation. */
export interface MapConfig {
  /** Ordered floor roles, floor 0 → boss. Length = floor count. */
  readonly floorPlan: readonly FloorRole[];
  /** Width range (node count) for variable floors (`encounter`, `rest`). */
  readonly minFloorWidth: number;
  readonly maxFloorWidth: number;
  /** Fixed width of a mixed floor (`shop`/`event`): the special node + encounters. */
  readonly mixedFloorWidth: number;
  /** Out-degree (route choices) range for every non-funnel floor. */
  readonly minChoices: number;
  readonly maxChoices: number;
  /** Probability an encounter node is rolled as an `elite` (0..1). */
  readonly eliteChance: number;
  /** Difficulty curve: `difficultyBase + difficultyPerFloor × floor`. */
  readonly difficultyBase: number;
  readonly difficultyPerFloor: number;
}

/**
 * The default floor plan (13 floors, indices 0–12). Encounters/path count:
 *   always-encounter floors = start(0) + encounter(1,2,4,5,7,9,10,11) = 9
 *   + shop floor (3): {0 or 1}  + event floor (6): {0 or 1}
 *   + rest floor (8): 0         + boss (12): terminal, not counted
 *   ⇒ encounters/path ∈ [9, 11]  ⊆ the required [8, 12], with a margin on both ends.
 * Every path also visits exactly one `rest` (floor 8) and ends at the boss (floor 12).
 */
export const DEFAULT_FLOOR_PLAN: readonly FloorRole[] = [
  'start', // 0  fight (encounter)
  'encounter', // 1
  'encounter', // 2
  'shop', // 3  2 encounters + 1 shop
  'encounter', // 4
  'encounter', // 5
  'event', // 6  2 encounters + 1 event
  'encounter', // 7
  'rest', // 8  all rest  ← guarantees ≥1 rest/path
  'encounter', // 9
  'encounter', // 10
  'encounter', // 11 (pre-boss; funnels into the boss)
  'boss', // 12 terminal
];

/** The default map config (docs/decisions.md 2026-07-15 "Stage 3 structural defaults"). */
export const DEFAULT_MAP_CONFIG: MapConfig = {
  floorPlan: DEFAULT_FLOOR_PLAN,
  minFloorWidth: 2,
  maxFloorWidth: 3,
  mixedFloorWidth: 3,
  minChoices: 2,
  maxChoices: 3,
  eliteChance: 0.22,
  difficultyBase: 1.0,
  difficultyPerFloor: 0.15,
};

// ── Acceptance-gate constants (the constraints the property tests assert against) ────

/** Min/max encounters (fight+elite) on any start→boss path (feature gate). */
export const ENCOUNTER_MIN = 8;
export const ENCOUNTER_MAX = 12;

/** Min rest sites on any start→boss path (feature gate). */
export const REST_MIN = 1;

/** Min elite nodes and exact shop-node count across the whole map (feature gate). */
export const ELITE_MIN_TOTAL = 1;
export const SHOP_COUNT = 1;
