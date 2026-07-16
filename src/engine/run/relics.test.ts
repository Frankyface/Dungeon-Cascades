/**
 * Roster fixtures: the v1 relic data covers every required category and every hook, ids
 * are unique, tiers span both rarities, and each entry is well-formed (name + flavor +
 * known hooks). These guard the DATA contract the hook engine and draft rely on.
 */
import { HOOK_NAMES } from './relicTypes';
import { ROSTER, RELIC_IDS, RELIC_REGISTRY, assertRosterWellFormed, getRelic } from './relics';
import type { HookName, Relic } from './relicTypes';

function relicsWithHook(hook: HookName): Relic[] {
  return ROSTER.filter((r) => r.hooks[hook] !== undefined);
}

describe('relic roster — size & identity', () => {
  it('has 12 relics with unique ids and matching registry / id list', () => {
    expect(ROSTER).toHaveLength(12);
    expect(new Set(RELIC_IDS).size).toBe(12);
    expect(RELIC_IDS).toEqual(ROSTER.map((r) => r.id));
    expect(Object.keys(RELIC_REGISTRY).sort()).toEqual([...RELIC_IDS].sort());
  });

  it('gives every relic a name, flavor, and a valid tier', () => {
    for (const r of ROSTER) {
      expect(r.name.length).toBeGreaterThan(0);
      expect(r.flavor.length).toBeGreaterThan(0);
      expect(['normal', 'elite']).toContain(r.tier);
      expect(Object.keys(r.hooks).length).toBeGreaterThan(0);
    }
  });

  it('is well-formed (only known hooks) and spans both tiers', () => {
    expect(() => assertRosterWellFormed()).not.toThrow();
    expect(ROSTER.some((r) => r.tier === 'normal')).toBe(true);
    expect(ROSTER.some((r) => r.tier === 'elite')).toBe(true);
  });
});

describe('relic roster — required category coverage', () => {
  it('has 4 affinity-keyed damage relics, one per damage color', () => {
    const colors = relicsWithHook('onDamageComputed')
      .map((r) => r.hooks.onDamageComputed!.color)
      .filter((c): c is NonNullable<typeof c> => c !== undefined);
    expect(new Set(colors)).toEqual(new Set(['R', 'G', 'B', 'Y']));
  });

  it('has a heal-scaling relic', () => {
    expect(relicsWithHook('onHealComputed').length).toBeGreaterThanOrEqual(1);
  });

  it('has a cascade-multiplier relic (perCombo damage scaling)', () => {
    expect(relicsWithHook('onDamageComputed').some((r) => r.hooks.onDamageComputed!.perCombo)).toBe(true);
  });

  it('has an economy relic (gold %)', () => {
    expect(relicsWithHook('onGoldEarned').length).toBeGreaterThanOrEqual(1);
  });

  it('has a flat damage-reduction (defensive) relic', () => {
    const def = relicsWithHook('onIncomingDamage');
    expect(def.length).toBeGreaterThanOrEqual(1);
    expect(def[0].hooks.onIncomingDamage!.op).toBe('add');
    expect(def[0].hooks.onIncomingDamage!.amount).toBeLessThan(0);
  });

  it('has 2+ combat-start relics (enemy chip and player heal channels)', () => {
    const starts = relicsWithHook('onCombatStart');
    expect(starts.length).toBeGreaterThanOrEqual(2);
    const kinds = new Set(starts.map((r) => r.hooks.onCombatStart!.kind));
    expect(kinds).toEqual(new Set(['enemyChip', 'playerHeal']));
  });

  it('covers every one of the declared hooks with at least one relic', () => {
    for (const hook of HOOK_NAMES) {
      expect(relicsWithHook(hook).length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('getRelic', () => {
  it('fetches by id and throws on an unknown id', () => {
    expect(getRelic('emberfang').name).toBe('Emberfang Charm');
    expect(() => getRelic('nope')).toThrow();
  });
});

describe('assertRosterWellFormed', () => {
  it('throws when a relic references an unknown hook', () => {
    const bad: Relic[] = [
      { id: 'x', name: 'X', flavor: '.', tier: 'normal', hooks: { onBogusHook: { op: 'add', amount: 1 } } as never },
    ];
    expect(() => assertRosterWellFormed(bad)).toThrow();
  });
});
