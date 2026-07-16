/**
 * Enemy data + intent-script fixtures. Asserts the three Stage-2 enemies match the
 * feature-enemy-encounters.md shapes, their affinity tables resolve correctly, and
 * their cyclic intent scripts wrap as specified.
 */
import {
  ENEMY_IDS,
  getEnemy,
  affinityFor,
  scriptStep,
  nextIntentIndex,
  initialTelegraph,
} from './enemies';
import type { EnemyId } from './types';

describe('enemy registry — definitions match the spec shapes', () => {
  it('exposes exactly the three Stage-2 enemies', () => {
    expect([...ENEMY_IDS].sort()).toEqual(['bat', 'skeleton', 'slime']);
  });

  it('Slime — ~80 HP, weak R, no resists, attack 8 loop', () => {
    const slime = getEnemy('slime');
    expect(slime.maxHp).toBe(80);
    expect(slime.affinity).toEqual({ R: 2.0 });
    expect(slime.script).toEqual([{ type: 'attack', value: 8 }]);
  });

  it('Skeleton — ~120 HP, resist R (0.5×), weak B (2×), attack8→charge→attack16', () => {
    const skeleton = getEnemy('skeleton');
    expect(skeleton.maxHp).toBe(120);
    expect(skeleton.affinity).toEqual({ R: 0.5, B: 2.0 });
    expect(skeleton.script).toEqual([
      { type: 'attack', value: 8 },
      { type: 'charge', value: 0 },
      { type: 'attack', value: 16 },
    ]);
  });

  it('Bat — ~90 HP, weak G (2×), resist B (0.5×), attack6↔heal8', () => {
    const bat = getEnemy('bat');
    expect(bat.maxHp).toBe(90);
    expect(bat.affinity).toEqual({ G: 2.0, B: 0.5 });
    expect(bat.script).toEqual([
      { type: 'attack', value: 6 },
      { type: 'heal', value: 8 },
    ]);
  });

  it('throws on an unknown enemy id (boundary validation)', () => {
    expect(() => getEnemy('dragon' as EnemyId)).toThrow();
  });
});

describe('affinityFor — per-enemy weak/normal/resist lookup', () => {
  it('resolves each enemy affinity, defaulting unlisted colors to normal 1.0', () => {
    expect(affinityFor(getEnemy('slime'), 'R')).toBe(2.0); // weak
    expect(affinityFor(getEnemy('slime'), 'G')).toBe(1.0); // normal (unlisted)
    expect(affinityFor(getEnemy('skeleton'), 'R')).toBe(0.5); // resist
    expect(affinityFor(getEnemy('skeleton'), 'B')).toBe(2.0); // weak
    expect(affinityFor(getEnemy('skeleton'), 'G')).toBe(1.0); // normal
    expect(affinityFor(getEnemy('bat'), 'G')).toBe(2.0); // weak
    expect(affinityFor(getEnemy('bat'), 'B')).toBe(0.5); // resist
  });
});

describe('intent scripts — deterministic cyclic walk', () => {
  it('initialTelegraph is the first script entry', () => {
    expect(initialTelegraph(getEnemy('slime'))).toEqual({ type: 'attack', value: 8 });
    expect(initialTelegraph(getEnemy('skeleton'))).toEqual({ type: 'attack', value: 8 });
    expect(initialTelegraph(getEnemy('bat'))).toEqual({ type: 'attack', value: 6 });
  });

  it("skeleton's 3-step cycle wraps: attack8 → charge → attack16 → attack8 …", () => {
    const skel = getEnemy('skeleton');
    const seen = [0, 1, 2, 3, 4, 5].map((i) => scriptStep(skel, i));
    expect(seen).toEqual([
      { type: 'attack', value: 8 },
      { type: 'charge', value: 0 },
      { type: 'attack', value: 16 },
      { type: 'attack', value: 8 }, // wraps
      { type: 'charge', value: 0 },
      { type: 'attack', value: 16 },
    ]);
    expect(nextIntentIndex(skel, 2)).toBe(0); // wraps to start
  });

  it("bat's 2-step cycle alternates: attack6 ↔ heal8", () => {
    const bat = getEnemy('bat');
    const seen = [0, 1, 2, 3].map((i) => scriptStep(bat, i));
    expect(seen).toEqual([
      { type: 'attack', value: 6 },
      { type: 'heal', value: 8 },
      { type: 'attack', value: 6 },
      { type: 'heal', value: 8 },
    ]);
    expect(nextIntentIndex(bat, 1)).toBe(0);
  });

  it("slime's 1-step loop stays on attack8", () => {
    const slime = getEnemy('slime');
    expect(scriptStep(slime, 0)).toEqual({ type: 'attack', value: 8 });
    expect(scriptStep(slime, 7)).toEqual({ type: 'attack', value: 8 });
    expect(nextIntentIndex(slime, 0)).toBe(0);
  });
});
