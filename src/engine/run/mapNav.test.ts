/**
 * Navigation fixtures: fresh state on the start, legal-next = current node's forward
 * edges, moveTo accepts legal jumps and REJECTS illegal ones, visited path accrues, and
 * a full start→boss walk completes. Uses a real generated map (small, deterministic).
 */
import { generateMap } from './mapGen';
import {
  canMoveTo,
  createMapState,
  currentNode,
  isComplete,
  legalNextNodes,
  moveTo,
  nodeById,
  nodesOnFloor,
} from './mapNav';

const MAP = generateMap(42);

describe('createMapState', () => {
  it('parks the player on the start node with a one-element visited path', () => {
    const s = createMapState(MAP);
    expect(s.currentNodeId).toBe(MAP.startId);
    expect(s.visited).toEqual([MAP.startId]);
    expect(isComplete(MAP, s)).toBe(false);
  });
});

describe('legalNextNodes', () => {
  it('equals exactly the current node\'s forward edges', () => {
    const s = createMapState(MAP);
    expect(legalNextNodes(MAP, s)).toEqual(currentNode(MAP, s).next);
    expect(legalNextNodes(MAP, s).length).toBeGreaterThan(0);
  });
});

describe('moveTo', () => {
  it('advances to a legal next node and appends it to the visited path', () => {
    const s0 = createMapState(MAP);
    const target = legalNextNodes(MAP, s0)[0];
    const s1 = moveTo(MAP, s0, target);
    expect(s1.currentNodeId).toBe(target);
    expect(s1.visited).toEqual([MAP.startId, target]);
    expect(nodeById(MAP, target).floor).toBe(1); // adjacent-floor only
  });

  it('does not mutate the prior state (immutability)', () => {
    const s0 = createMapState(MAP);
    const snapshot = JSON.stringify(s0);
    moveTo(MAP, s0, legalNextNodes(MAP, s0)[0]);
    expect(JSON.stringify(s0)).toBe(snapshot);
  });

  it('rejects an illegal jump: a floor-skipping / unconnected target', () => {
    const s0 = createMapState(MAP);
    // A node two floors down is never an adjacent forward edge.
    const twoFloorsDown = nodesOnFloor(MAP, 2)[0].id;
    expect(canMoveTo(MAP, s0, twoFloorsDown)).toBe(false);
    expect(() => moveTo(MAP, s0, twoFloorsDown)).toThrow();
  });

  it('rejects an unknown node id', () => {
    const s0 = createMapState(MAP);
    expect(() => moveTo(MAP, s0, 'nope')).toThrow();
  });
});

describe('full traversal', () => {
  it('a greedy first-choice walk reaches the boss with a legal, adjacent path', () => {
    let s = createMapState(MAP);
    const floorsVisited: number[] = [currentNode(MAP, s).floor];
    while (!isComplete(MAP, s)) {
      const next = legalNextNodes(MAP, s);
      expect(next.length).toBeGreaterThan(0); // never a dead end before the boss
      s = moveTo(MAP, s, next[0]);
      floorsVisited.push(currentNode(MAP, s).floor);
    }
    expect(currentNode(MAP, s).type).toBe('boss');
    expect(isComplete(MAP, s)).toBe(true);
    // Visited exactly one node per floor, 0..lastFloor, in order.
    expect(floorsVisited).toEqual(Array.from({ length: MAP.floorCount }, (_, i) => i));
    expect(s.visited).toHaveLength(MAP.floorCount);
  });

  it('the boss node offers no legal moves', () => {
    let s = createMapState(MAP);
    while (!isComplete(MAP, s)) s = moveTo(MAP, s, legalNextNodes(MAP, s)[0]);
    expect(legalNextNodes(MAP, s)).toHaveLength(0);
  });
});
