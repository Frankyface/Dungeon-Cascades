/**
 * Rest-site fixtures: a rest heals REST_HEAL_FRACTION (30%) of MAX HP, capped at max, and
 * is single-use per node (its state machine rejects a second rest). REST_HEAL_FRACTION is
 * a config knob; 60 max HP ⇒ round(60×0.3) = 18 healed.
 */
import { createRestState, restHeal, applyRest } from './rest';

describe('restHeal — heal 30% of max, capped', () => {
  it('heals round(30% of max) from a wounded state', () => {
    expect(restHeal(20, 60)).toBe(38); // 20 + 18
  });

  it('caps the heal at max HP', () => {
    expect(restHeal(50, 60)).toBe(60); // 50 + 18 → capped at 60
  });

  it('never reduces HP (already full stays full)', () => {
    expect(restHeal(60, 60)).toBe(60);
  });
});

describe('rest state machine — single use per node', () => {
  it('a fresh rest state is unused', () => {
    expect(createRestState().rested).toBe(false);
  });

  it('applying a rest heals and flips the state to used', () => {
    const result = applyRest(createRestState(), 20, 60);
    expect(result.hp).toBe(38);
    expect(result.state.rested).toBe(true);
  });

  it('rejects a second rest at the same node', () => {
    const once = applyRest(createRestState(), 20, 60);
    expect(() => applyRest(once.state, once.hp, 60)).toThrow(/already rested/i);
  });
});
