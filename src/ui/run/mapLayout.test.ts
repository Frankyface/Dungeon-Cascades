import { startRun } from '../../engine/run';
import {
  MAP_HORIZONTAL_PAD,
  MAP_VERTICAL_PAD,
  computeMapLayout,
  edgeGeometry,
  floorY,
  nodeX,
} from './mapLayout';

const WIDTH = 390;

describe('computeMapLayout', () => {
  it('places every map node exactly once', () => {
    const map = startRun(42).map;
    const layout = computeMapLayout(map, WIDTH);
    expect(layout.nodes).toHaveLength(map.nodes.length);
    const ids = new Set(layout.nodes.map((n) => n.id));
    expect(ids.size).toBe(map.nodes.length);
  });

  it('puts the start floor at the bottom and the boss floor at the top', () => {
    const map = startRun(42).map;
    const layout = computeMapLayout(map, WIDTH);
    const start = layout.nodes.find((n) => n.id === map.startId)!;
    const boss = layout.nodes.find((n) => n.id === map.bossId)!;
    expect(start.y).toBeGreaterThan(boss.y); // larger y = lower on screen
    expect(boss.y).toBe(MAP_VERTICAL_PAD);
  });

  it('gives every node on a floor the same y', () => {
    const map = startRun(7).map;
    const layout = computeMapLayout(map, WIDTH);
    for (let floor = 0; floor < map.floorCount; floor++) {
      const ys = layout.nodes.filter((n) => n.floor === floor).map((n) => n.y);
      expect(new Set(ys).size).toBe(1);
      expect(ys[0]).toBe(floorY(floor, map.floorCount));
    }
  });

  it('keeps node x within the horizontal padding', () => {
    const map = startRun(7).map;
    const layout = computeMapLayout(map, WIDTH);
    for (const node of layout.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(MAP_HORIZONTAL_PAD);
      expect(node.x).toBeLessThanOrEqual(WIDTH - MAP_HORIZONTAL_PAD);
    }
  });

  it('builds one edge per forward link, connecting real nodes', () => {
    const map = startRun(7).map;
    const layout = computeMapLayout(map, WIDTH);
    const expected = map.nodes.reduce((sum, n) => sum + n.next.length, 0);
    expect(layout.edges).toHaveLength(expected);
    const ids = new Set(layout.nodes.map((n) => n.id));
    for (const edge of layout.edges) {
      expect(ids.has(edge.fromId)).toBe(true);
      expect(ids.has(edge.toId)).toBe(true);
    }
  });

  it('is deterministic for a given map and width', () => {
    const map = startRun(99).map;
    expect(computeMapLayout(map, WIDTH)).toEqual(computeMapLayout(map, WIDTH));
  });
});

describe('nodeX', () => {
  it('centers a single node and spreads multiple evenly', () => {
    expect(nodeX(0, 1, WIDTH)).toBeCloseTo(WIDTH / 2, 5);
    const a = nodeX(0, 3, WIDTH);
    const b = nodeX(1, 3, WIDTH);
    const c = nodeX(2, 3, WIDTH);
    expect(b).toBeCloseTo(WIDTH / 2, 5);
    expect(b - a).toBeCloseTo(c - b, 5); // equal spacing
  });
});

describe('edgeGeometry', () => {
  it('reports a horizontal segment as angle 0 and the right length', () => {
    const g = edgeGeometry(0, 100, 40, 100);
    expect(g.length).toBeCloseTo(40, 5);
    expect(g.angleDeg).toBeCloseTo(0, 5);
    expect(g.top).toBeCloseTo(100, 5);
  });

  it('reports a vertical segment as angle 90', () => {
    const g = edgeGeometry(50, 0, 50, 60);
    expect(g.length).toBeCloseTo(60, 5);
    expect(Math.abs(g.angleDeg)).toBeCloseTo(90, 5);
  });
});
