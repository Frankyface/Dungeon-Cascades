/**
 * Serializable data model for the run node-map (Stage 3).
 *
 * Mirrors the board/combat engines' discipline: every shape here is plain JSON-safe
 * data (no classes, no methods, no hidden state) so a RunMap / MapState can cross the
 * engine/UI boundary, be snapshotted by tests, and be persisted. All fields are
 * `readonly` — generation and navigation return new objects, never mutating input.
 *
 * PURE ENGINE: no React / React Native imports; no ambient time or randomness (seeded
 * PRNG only, threaded through the board engine's RNG). See CLAUDE.md.
 */

/**
 * The six node types (docs/decisions.md "Stage 3 structural defaults"). `fight` and
 * `elite` are ENCOUNTERS (they run a combat); `event`/`shop`/`rest` are utility stops;
 * `boss` is the single terminal node. The taxonomy is closed for v1 — a future verb is
 * added by extending this union and the generator's role table.
 */
export type NodeType = 'fight' | 'elite' | 'event' | 'shop' | 'rest' | 'boss';

/**
 * One node in the layered DAG. `id` is a stable, human-readable coordinate string
 * (`"f{floor}n{index}"`, e.g. "f3n1"); `floor` is 0-indexed depth (0 = start floor,
 * the largest floor index = the boss); `index` is the node's position within its floor
 * (0-indexed, left→right); `next` lists the ids of the nodes on floor+1 this node routes
 * to (adjacent-floor edges only). The boss node has an empty `next`.
 */
export interface MapNode {
  readonly id: string;
  readonly floor: number;
  readonly index: number;
  readonly type: NodeType;
  readonly next: readonly string[];
}

/**
 * A fully generated run map. `nodes` (flat, ordered by floor then index) is the single
 * source of truth — `floorCount`, `startId`, and `bossId` are convenience anchors.
 * Storing one flat list (rather than a nested-by-floor structure plus a lookup map)
 * avoids any redundant/desyncable copy; navigation helpers index into it.
 */
export interface RunMap {
  /** The seed this map was generated from (echoed for reproducibility / persistence). */
  readonly seed: number;
  readonly floorCount: number;
  readonly startId: string;
  readonly bossId: string;
  readonly nodes: readonly MapNode[];
}

/**
 * Serializable navigation state: where the player currently is, and the ordered path of
 * nodes visited so far (including the start, ending at `currentNodeId`). Plain data so a
 * run can be saved/resumed. The RunMap it refers to is passed alongside to the nav
 * helpers rather than embedded, keeping this state small.
 */
export interface MapState {
  readonly currentNodeId: string;
  readonly visited: readonly string[];
}
