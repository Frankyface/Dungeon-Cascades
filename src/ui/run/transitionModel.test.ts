/**
 * The act-transition view-model: the heal math matches the engine constant, the Act-2 biome reveal
 * names the seeded biome, and the unlock preview fires a first-reach biome ceremony (idempotent —
 * gone once the biome is already unlocked).
 */
import { ACT_TRANSITION_HEAL_FRACTION, INITIAL_META_STATE, startRun } from '../../engine/run';
import type { MetaState, RunState } from '../../engine/run';
import { computeActTransition } from './transitionModel';

/** A run parked in the `act_transition` phase (Act-1 boss just beaten), at a chosen HP. */
function atTransition(seed: number, playerHp: number): RunState {
  return { ...startRun(seed), playerHp, phase: { kind: 'act_transition' } };
}

describe('computeActTransition', () => {
  it('reports the transition heal from the engine fraction, capped at max HP', () => {
    const state = atTransition(3, 20);
    const view = computeActTransition(state, INITIAL_META_STATE);
    const expectedHeal = Math.round(state.playerMaxHp * ACT_TRANSITION_HEAL_FRACTION);
    expect(view.healAmount).toBe(expectedHeal);
    expect(view.healedHp).toBe(Math.min(state.playerMaxHp, 20 + expectedHeal));
  });

  it('does not overheal past max HP', () => {
    const state = atTransition(3, 60); // already full
    const view = computeActTransition(state, INITIAL_META_STATE);
    expect(view.healedHp).toBe(state.playerMaxHp);
  });

  it('includes the onActStart relic bonus heal in the shown total (matches advanceAct)', () => {
    // wayfarers-draught heals +12 at each act start (onActStart playerHeal) on top of the base heal.
    const state: RunState = { ...atTransition(3, 20), relicIds: ['wayfarers-draught'] };
    const view = computeActTransition(state, INITIAL_META_STATE);
    const base = Math.round(state.playerMaxHp * ACT_TRANSITION_HEAL_FRACTION);
    expect(view.healAmount).toBe(base + 12); // total, not base-only
    expect(view.healedHp).toBe(Math.min(state.playerMaxHp, 20 + base + 12));
  });

  it('reveals the run’s seeded Act-2 biome by name + theme', () => {
    const state = atTransition(11, 30);
    const view = computeActTransition(state, INITIAL_META_STATE);
    expect(view.toBiomeId).toBe(state.act2BiomeId);
    expect(view.toBiomeName.length).toBeGreaterThan(0);
    expect(view.theme.id).toBe(state.act2BiomeId);
    expect(view.fromBiomeName).toBe('The Dungeon');
  });

  it('fires a first-reach biome ceremony on a fresh profile', () => {
    const state = atTransition(11, 30);
    const view = computeActTransition(state, INITIAL_META_STATE);
    expect(view.firstReach).toBe(true);
    expect(view.headlines.some((c) => c.tone === 'biome')).toBe(true);
    expect(view.headlines.some((c) => c.tone === 'legendary')).toBe(true); // the biome legendary relic
    expect(view.discoveries.total).toBeGreaterThan(0); // biome enemies + boss revealed
  });

  it('shows NO first-reach ceremony once the biome is already unlocked (idempotent)', () => {
    const state = atTransition(11, 30);
    const already: MetaState = {
      ...INITIAL_META_STATE,
      unlockedBiomeIds: [state.act2BiomeId],
    };
    const view = computeActTransition(state, already);
    expect(view.firstReach).toBe(false);
    expect(view.headlines.filter((c) => c.tone === 'biome')).toEqual([]);
  });
});
