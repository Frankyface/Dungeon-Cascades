/**
 * Property tests over many seeds (fast-check): the graph invariants and per-path
 * distribution constraints that make a generated map a VALID run, asserted structurally
 * (never by enumerating every path — a DAG DP computes the min/max encounter and rest
 * counts over ALL paths in linear time), plus determinism across 1000 regenerations.
 */
import fc from 'fast-check';
import { DEFAULT_MAP_CONFIG, ENCOUNTER_MAX, ENCOUNTER_MIN, REST_MIN } from './mapConfig';
import { generateMap, isEncounter } from './mapGen';
import type { MapNode, RunMap } from './mapTypes';

function byId(map: RunMap): Map<string, MapNode> {
  return new Map(map.nodes.map((n) => [n.id, n]));
}

/** Nodes in reverse floor order (boss first) — a valid reverse-topological order for DP. */
function reverseTopo(map: RunMap): MapNode[] {
  return [...map.nodes].sort((a, b) => b.floor - a.floor || b.index - a.index);
}

/** DP: min & max encounters (fight+elite) on any path from each node to the boss (boss excluded). */
function encounterBounds(map: RunMap): { min: Map<string, number>; max: Map<string, number> } {
  const nodes = byId(map);
  const min = new Map<string, number>();
  const max = new Map<string, number>();
  for (const node of reverseTopo(map)) {
    const self = isEncounter(node.type) ? 1 : 0;
    if (node.next.length === 0) {
      min.set(node.id, self);
      max.set(node.id, self);
      continue;
    }
    let lo = Infinity;
    let hi = -Infinity;
    for (const t of node.next) {
      lo = Math.min(lo, min.get(t)!);
      hi = Math.max(hi, max.get(t)!);
    }
    min.set(node.id, self + lo);
    max.set(node.id, self + hi);
  }
  return { min, max };
}

/** DP: minimum rest sites on any path from each node to the boss. */
function minRestToBoss(map: RunMap): Map<string, number> {
  const min = new Map<string, number>();
  for (const node of reverseTopo(map)) {
    const self = node.type === 'rest' ? 1 : 0;
    if (node.next.length === 0) {
      min.set(node.id, self);
      continue;
    }
    let lo = Infinity;
    for (const t of node.next) lo = Math.min(lo, min.get(t)!);
    min.set(node.id, self + lo);
  }
  return min;
}

/** BFS reachability from the start over forward edges. */
function reachableFromStart(map: RunMap): Set<string> {
  const nodes = byId(map);
  const seen = new Set<string>([map.startId]);
  const queue = [map.startId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const t of nodes.get(id)!.next) {
      if (!seen.has(t)) {
        seen.add(t);
        queue.push(t);
      }
    }
  }
  return seen;
}

/** DP: can a forward walk from each node reach the boss? */
function canReachBoss(map: RunMap): Map<string, boolean> {
  const can = new Map<string, boolean>();
  for (const node of reverseTopo(map)) {
    if (node.id === map.bossId) {
      can.set(node.id, true);
      continue;
    }
    can.set(node.id, node.next.some((t) => can.get(t) === true));
  }
  return can;
}

describe('generateMap — graph invariants (property, many seeds)', () => {
  it('is a layered DAG: edges only ever connect a floor to the next floor', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 31 - 1 }), (seed) => {
        const map = generateMap(seed);
        const nodes = byId(map);
        for (const node of map.nodes) {
          for (const t of node.next) {
            expect(nodes.get(t)!.floor).toBe(node.floor + 1);
          }
        }
      }),
      { numRuns: 250 },
    );
  });

  it('every node is reachable from start, and every node can reach the boss', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 31 - 1 }), (seed) => {
        const map = generateMap(seed);
        const reach = reachableFromStart(map);
        expect(reach.size).toBe(map.nodes.length);
        const can = canReachBoss(map);
        for (const node of map.nodes) expect(can.get(node.id)).toBe(true);
      }),
      { numRuns: 250 },
    );
  });

  it('offers 2–3 route choices per floor, except the pre-boss funnel (out-degree 1)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 31 - 1 }), (seed) => {
        const map = generateMap(seed);
        const last = map.floorCount - 1;
        for (const node of map.nodes) {
          if (node.floor === last) {
            expect(node.next).toHaveLength(0); // boss
          } else if (node.floor === last - 1) {
            expect(node.next).toHaveLength(1); // funnel into boss
            expect(node.next[0]).toBe(map.bossId);
          } else {
            expect(node.next.length).toBeGreaterThanOrEqual(DEFAULT_MAP_CONFIG.minChoices);
            expect(node.next.length).toBeLessThanOrEqual(DEFAULT_MAP_CONFIG.maxChoices);
          }
        }
      }),
      { numRuns: 250 },
    );
  });
});

describe('generateMap — distribution constraints (property, ALL paths via DP)', () => {
  it('every start→boss path holds 8–12 encounters and ≥1 rest; map has 1 shop & ≥1 elite', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 31 - 1 }), (seed) => {
        const map = generateMap(seed);

        // Per-path encounter bounds (over ALL paths) must sit inside [8, 12].
        const enc = encounterBounds(map);
        expect(enc.min.get(map.startId)!).toBeGreaterThanOrEqual(ENCOUNTER_MIN);
        expect(enc.max.get(map.startId)!).toBeLessThanOrEqual(ENCOUNTER_MAX);

        // Every path visits at least one rest.
        expect(minRestToBoss(map).get(map.startId)!).toBeGreaterThanOrEqual(REST_MIN);

        // Map-wide singletons.
        expect(map.nodes.filter((n) => n.type === 'shop')).toHaveLength(1);
        expect(map.nodes.filter((n) => n.type === 'elite').length).toBeGreaterThanOrEqual(1);
        expect(map.nodes.filter((n) => n.type === 'boss')).toHaveLength(1);
      }),
      { numRuns: 400 },
    );
  });
});

describe('generateMap — determinism', () => {
  it('same seed ⇒ deep-equal map across 1000 regenerations', () => {
    for (const seed of [0, 42, 2026]) {
      const reference = JSON.stringify(generateMap(seed));
      for (let i = 0; i < 1000; i++) {
        expect(JSON.stringify(generateMap(seed))).toBe(reference);
      }
    }
  });
});
