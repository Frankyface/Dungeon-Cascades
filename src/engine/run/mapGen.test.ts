/**
 * Node-map generator fixtures (concrete-seed white-box checks). Broad graph invariants,
 * distribution constraints, and determinism-across-1000-regenerations live in the
 * property suite (mapGen.property.test.ts); this file pins specific, readable facts.
 */
import { DEFAULT_MAP_CONFIG, ELITE_MIN_TOTAL, SHOP_COUNT } from './mapConfig';
import { difficultyAt, generateMap, isEncounter, validateMap } from './mapGen';
import type { NodeType } from './mapTypes';

function countType(nodes: readonly { type: NodeType }[], type: NodeType): number {
  return nodes.filter((n) => n.type === type).length;
}

describe('generateMap — structural anchors', () => {
  const map = generateMap(42);

  it('has floor 0 as a single start fight and the last floor as a single boss', () => {
    expect(map.floorCount).toBe(DEFAULT_MAP_CONFIG.floorPlan.length);
    expect(map.startId).toBe('f0n0');
    expect(map.bossId).toBe(`f${map.floorCount - 1}n0`);
    const start = map.nodes.find((n) => n.id === map.startId)!;
    const boss = map.nodes.find((n) => n.id === map.bossId)!;
    expect(start.type).toBe('fight');
    expect(start.floor).toBe(0);
    expect(boss.type).toBe('boss');
    expect(boss.next).toHaveLength(0);
  });

  it('contains exactly one shop node and at least one elite node', () => {
    expect(countType(map.nodes, 'shop')).toBe(SHOP_COUNT);
    expect(countType(map.nodes, 'elite')).toBeGreaterThanOrEqual(ELITE_MIN_TOTAL);
  });

  it('routes every start-node edge into floor 1 (adjacent-floor only)', () => {
    const start = map.nodes.find((n) => n.id === map.startId)!;
    expect(start.next.length).toBeGreaterThanOrEqual(DEFAULT_MAP_CONFIG.minChoices);
    expect(start.next.length).toBeLessThanOrEqual(DEFAULT_MAP_CONFIG.maxChoices);
    for (const id of start.next) {
      const target = map.nodes.find((n) => n.id === id)!;
      expect(target.floor).toBe(1);
    }
  });

  it('passes its own structural validator', () => {
    expect(() => validateMap(map)).not.toThrow();
  });
});

describe('generateMap — determinism', () => {
  it('same seed ⇒ deep-equal map', () => {
    expect(generateMap(2026)).toEqual(generateMap(2026));
  });

  it('different seeds ⇒ structurally different maps (sample)', () => {
    const serialized = [1, 2, 3, 4, 5].map((s) => JSON.stringify(generateMap(s)));
    expect(new Set(serialized).size).toBeGreaterThan(1);
  });

  it('echoes the (normalized) seed it was built from', () => {
    expect(generateMap(42).seed).toBe(42);
  });
});

describe('isEncounter', () => {
  it('is true for fight/elite and false for utility/boss', () => {
    expect(isEncounter('fight')).toBe(true);
    expect(isEncounter('elite')).toBe(true);
    expect(isEncounter('event')).toBe(false);
    expect(isEncounter('shop')).toBe(false);
    expect(isEncounter('rest')).toBe(false);
    expect(isEncounter('boss')).toBe(false);
  });
});

describe('difficultyAt — per-floor scalar curve', () => {
  it('starts at the base and rises linearly per floor', () => {
    expect(difficultyAt(0)).toBeCloseTo(1.0, 10);
    expect(difficultyAt(1)).toBeCloseTo(1.15, 10);
    expect(difficultyAt(10)).toBeCloseTo(2.5, 10);
  });

  it('is strictly monotonic increasing in depth', () => {
    for (let f = 1; f < 13; f++) {
      expect(difficultyAt(f)).toBeGreaterThan(difficultyAt(f - 1));
    }
  });

  it('rejects a negative floor', () => {
    expect(() => difficultyAt(-1)).toThrow();
  });
});

describe('generateMap — config validation', () => {
  it('rejects a floor plan that does not start/end correctly', () => {
    expect(() => generateMap(1, { ...DEFAULT_MAP_CONFIG, floorPlan: ['encounter', 'boss'] })).toThrow();
    expect(() => generateMap(1, { ...DEFAULT_MAP_CONFIG, floorPlan: ['start', 'encounter'] })).toThrow();
  });

  it('still guarantees ≥1 elite even when eliteChance is 0 (forced promotion)', () => {
    // With no natural elite rolls, the generator promotes one fight → elite; per-path
    // encounter counts are unaffected (an elite is still an encounter).
    for (const seed of [1, 2, 3, 42, 2026]) {
      const map = generateMap(seed, { ...DEFAULT_MAP_CONFIG, eliteChance: 0 });
      expect(countType(map.nodes, 'elite')).toBe(1);
      expect(() => validateMap(map, { ...DEFAULT_MAP_CONFIG, eliteChance: 0 })).not.toThrow();
    }
  });
});
