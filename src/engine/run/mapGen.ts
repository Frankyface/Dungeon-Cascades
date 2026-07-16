/**
 * Seeded generation of the run node-map: a layered DAG of typed nodes.
 *
 * The map is a stack of floors (floor 0 = start, last floor = boss). A player visits
 * exactly ONE node per floor, so per-path distribution constraints are guaranteed BY
 * CONSTRUCTION via the per-floor role template (mapConfig.FloorRole): encounter/rest/
 * shop/event roles decide which node TYPES a floor may hold, so every path picks up the
 * same encounter/rest profile regardless of which node it takes. Edges connect adjacent
 * floors only, with out-degree (route choices) in [minChoices, maxChoices] on every floor
 * except the pre-boss funnel (out-degree 1 into the single boss — the one intentional
 * exception, standard Slay-the-Spire shape).
 *
 * Determinism: a single mulberry32 stream (from the map seed) is threaded through width
 * choices → type choices → edges, in a fixed order. Same seed ⇒ deep-equal map. Pure: no
 * React/RN, no Math.random/Date.now — only the board engine's seeded PRNG.
 */
import { createRng, nextFloat, nextInt } from '../board';
import type { RngState } from '../board';
import { DEFAULT_MAP_CONFIG } from './mapConfig';
import type { FloorRole, MapConfig } from './mapConfig';
import type { MapNode, NodeType, RunMap } from './mapTypes';

/** Stable, readable node id for a (floor, index) coordinate. */
function nodeId(floor: number, index: number): string {
  return `f${floor}n${index}`;
}

/** True for encounter node types (a node that runs a combat). */
export function isEncounter(type: NodeType): boolean {
  return type === 'fight' || type === 'elite';
}

/**
 * Per-floor difficulty scalar the encounter generator (a later agent) multiplies enemy
 * stats by: `difficultyBase + difficultyPerFloor × floor`. Monotonic in floor depth.
 */
export function difficultyAt(floor: number, config: MapConfig = DEFAULT_MAP_CONFIG): number {
  if (floor < 0) {
    throw new Error(`difficultyAt: floor must be >= 0, got ${floor}`);
  }
  return config.difficultyBase + config.difficultyPerFloor * floor;
}

/** The node count of a floor, by role. Threads RNG for the variable-width roles. */
function floorWidth(role: FloorRole, state: RngState, config: MapConfig): { width: number; state: RngState } {
  switch (role) {
    case 'start':
    case 'boss':
      return { width: 1, state };
    case 'shop':
    case 'event':
      return { width: config.mixedFloorWidth, state };
    case 'encounter':
    case 'rest': {
      const span = config.maxFloorWidth - config.minFloorWidth + 1;
      const roll = nextInt(state, span);
      return { width: config.minFloorWidth + roll.value, state: roll.state };
    }
  }
}

/** Roll one encounter node: `elite` with probability `eliteChance`, else `fight`. */
function rollEncounter(state: RngState, config: MapConfig): { type: NodeType; state: RngState } {
  const roll = nextFloat(state);
  return { type: roll.value < config.eliteChance ? 'elite' : 'fight', state: roll.state };
}

/** Assign the node TYPES of one floor (given its width and role), threading RNG. */
function floorTypes(
  role: FloorRole,
  width: number,
  state: RngState,
  config: MapConfig,
): { types: NodeType[]; state: RngState } {
  let s = state;
  const types: NodeType[] = [];

  if (role === 'start') return { types: ['fight'], state: s };
  if (role === 'boss') return { types: ['boss'], state: s };
  if (role === 'rest') return { types: Array.from({ length: width }, () => 'rest' as NodeType), state: s };

  // Mixed floors (shop/event): choose the single special node's index, encounters elsewhere.
  let specialIndex = -1;
  if (role === 'shop' || role === 'event') {
    const pick = nextInt(s, width);
    specialIndex = pick.value;
    s = pick.state;
  }
  for (let i = 0; i < width; i++) {
    if (i === specialIndex) {
      types.push(role === 'shop' ? 'shop' : 'event');
    } else {
      const enc = rollEncounter(s, config);
      types.push(enc.type);
      s = enc.state;
    }
  }
  return { types, state: s };
}

/** Normalized column position of node `i` on a floor of `width`, in [0, 1]. */
function columnPos(i: number, width: number): number {
  return width === 1 ? 0.5 : i / (width - 1);
}

/**
 * Build the forward edges from floor A (widthA) to floor B (widthB), returning, for each
 * A index, the ascending list of B indices it routes to. Guarantees: every B index has
 * ≥1 in-edge (reachability), and every A index has out-degree in [minChoices, maxChoices]
 * — EXCEPT the boss funnel (widthB === 1 ⇒ every A → the single B, out-degree 1).
 */
function buildEdges(
  widthA: number,
  widthB: number,
  state: RngState,
  config: MapConfig,
): { edges: number[][]; state: RngState } {
  const edges: number[][] = Array.from({ length: widthA }, () => []);

  // Boss funnel: everything points to the single next node.
  if (widthB === 1) {
    for (let i = 0; i < widthA; i++) edges[i] = [0];
    return { edges, state };
  }

  const sets: Set<number>[] = Array.from({ length: widthA }, () => new Set<number>());
  const outDeg = (i: number): number => sets[i].size;
  const posA = (i: number): number => columnPos(i, widthA);
  const posB = (j: number): number => columnPos(j, widthB);

  // 1) Coverage — every B node gets an in-edge from the least-loaded, then nearest, A node.
  for (let j = 0; j < widthB; j++) {
    let best = 0;
    for (let i = 1; i < widthA; i++) {
      const better =
        outDeg(i) < outDeg(best) ||
        (outDeg(i) === outDeg(best) && Math.abs(posA(i) - posB(j)) < Math.abs(posA(best) - posB(j)));
      if (better) best = i;
    }
    sets[best].add(j);
  }

  // 2) Out-degree floor — top each A up to minChoices using nearest not-yet-linked B nodes.
  for (let i = 0; i < widthA; i++) {
    while (outDeg(i) < config.minChoices) {
      let best = -1;
      for (let j = 0; j < widthB; j++) {
        if (sets[i].has(j)) continue;
        if (best === -1 || Math.abs(posB(j) - posA(i)) < Math.abs(posB(best) - posA(i))) best = j;
      }
      if (best === -1) break; // b < minChoices — impossible for non-boss floors, but safe.
      sets[i].add(best);
    }
  }

  // 3) Optional extra edge — seeded, up to maxChoices, for map-shape variety.
  let s = state;
  for (let i = 0; i < widthA; i++) {
    if (outDeg(i) >= config.maxChoices || outDeg(i) >= widthB) continue;
    const roll = nextFloat(s);
    s = roll.state;
    if (roll.value < 0.5) {
      let best = -1;
      for (let j = 0; j < widthB; j++) {
        if (sets[i].has(j)) continue;
        if (best === -1 || Math.abs(posB(j) - posA(i)) < Math.abs(posB(best) - posA(i))) best = j;
      }
      if (best !== -1) sets[i].add(best);
    }
  }

  for (let i = 0; i < widthA; i++) edges[i] = Array.from(sets[i]).sort((x, y) => x - y);
  return { edges, state: s };
}

/**
 * Validate a generated map against every structural invariant, throwing on the first
 * violation (fail-fast boundary check — a broken custom config surfaces immediately
 * rather than producing a silently-unroutable run). Also exported for direct testing.
 */
export function validateMap(map: RunMap, config: MapConfig = DEFAULT_MAP_CONFIG): void {
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const lastFloor = map.floorCount - 1;
  const inDegree = new Map<string, number>();

  for (const node of map.nodes) {
    const isPreBoss = node.floor === lastFloor - 1;
    const isBoss = node.floor === lastFloor;
    // Edge targets must exist and live on the very next floor.
    for (const t of node.next) {
      const target = byId.get(t);
      if (!target) throw new Error(`validateMap: node ${node.id} → missing target ${t}`);
      if (target.floor !== node.floor + 1) {
        throw new Error(`validateMap: non-adjacent edge ${node.id} (floor ${node.floor}) → ${t} (floor ${target.floor})`);
      }
      inDegree.set(t, (inDegree.get(t) ?? 0) + 1);
    }
    // Out-degree: boss has none; pre-boss funnels (1); everyone else has [minChoices,maxChoices].
    if (isBoss) {
      if (node.next.length !== 0) throw new Error(`validateMap: boss ${node.id} must have no outgoing edges`);
    } else if (isPreBoss) {
      if (node.next.length !== 1) throw new Error(`validateMap: pre-boss ${node.id} must funnel to exactly the boss`);
    } else if (node.next.length < config.minChoices || node.next.length > config.maxChoices) {
      throw new Error(`validateMap: ${node.id} out-degree ${node.next.length} outside [${config.minChoices},${config.maxChoices}]`);
    }
  }

  // Every non-start node must be reachable (have ≥1 in-edge). The start needs none.
  for (const node of map.nodes) {
    if (node.id === map.startId) continue;
    if ((inDegree.get(node.id) ?? 0) === 0) throw new Error(`validateMap: unreachable node ${node.id}`);
  }
}

/**
 * Generate the run map for a seed. `config` is the tunable floor plan / curve. Throws on
 * a structurally invalid config (validated post-build). Deterministic and pure.
 */
export function generateMap(seed: number, config: MapConfig = DEFAULT_MAP_CONFIG): RunMap {
  const plan = config.floorPlan;
  if (plan.length < 2 || plan[0] !== 'start' || plan[plan.length - 1] !== 'boss') {
    throw new Error(`generateMap: floorPlan must start with 'start' and end with 'boss'`);
  }

  let state = createRng(seed >>> 0);

  // Pass 1: widths, then node types, per floor (in order → deterministic RNG threading).
  const widths: number[] = [];
  const typesByFloor: NodeType[][] = [];
  for (let f = 0; f < plan.length; f++) {
    const w = floorWidth(plan[f], state, config);
    state = w.state;
    widths.push(w.width);
    const t = floorTypes(plan[f], w.width, state, config);
    state = t.state;
    typesByFloor.push(t.types);
  }

  // Guarantee ≥1 elite in the whole map: if the rolls produced none, promote one encounter
  // (fight→elite) — an encounter stays an encounter, so per-path counts are unaffected.
  let hasElite = typesByFloor.some((row) => row.includes('elite'));
  if (!hasElite) {
    const fightCoords: Array<[number, number]> = [];
    for (let f = 0; f < typesByFloor.length; f++) {
      for (let i = 0; i < typesByFloor[f].length; i++) {
        if (typesByFloor[f][i] === 'fight' && plan[f] !== 'start') fightCoords.push([f, i]);
      }
    }
    if (fightCoords.length > 0) {
      const pick = nextInt(state, fightCoords.length);
      state = pick.state;
      const [f, i] = fightCoords[pick.value];
      typesByFloor[f][i] = 'elite';
      hasElite = true;
    }
  }

  // Pass 2: edges between adjacent floors.
  const edgesByFloor: number[][][] = [];
  for (let f = 0; f < plan.length - 1; f++) {
    const e = buildEdges(widths[f], widths[f + 1], state, config);
    state = e.state;
    edgesByFloor.push(e.edges);
  }

  // Assemble nodes (flat, ordered by floor then index).
  const nodes: MapNode[] = [];
  for (let f = 0; f < plan.length; f++) {
    for (let i = 0; i < widths[f]; i++) {
      const next = f < plan.length - 1 ? edgesByFloor[f][i].map((j) => nodeId(f + 1, j)) : [];
      nodes.push({ id: nodeId(f, i), floor: f, index: i, type: typesByFloor[f][i], next });
    }
  }

  const map: RunMap = {
    seed: seed >>> 0,
    floorCount: plan.length,
    startId: nodeId(0, 0),
    bossId: nodeId(plan.length - 1, 0),
    nodes,
  };

  validateMap(map, config);
  return map;
}
