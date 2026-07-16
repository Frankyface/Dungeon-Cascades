/**
 * Performance-scaled gold fixtures — the reward is base + a faster-than-median bonus + an
 * HP-retained bonus, elites multiply it, and the `onGoldEarned` relic hook folds in last.
 * Every fixture is hand-computed from economyConfig constants (GOLD_BASE 10,
 * GOLD_SPEED_BONUS_MAX 8, GOLD_MEDIAN_TURNS 6, GOLD_HP_BONUS_MAX 6, ELITE_GOLD_MULT 2).
 */
import { computeGoldReward } from './gold';

// median 6 ⇒ speedFraction = clamp((6 − turns)/5, 0, 1); speedBonus = 8 × that.
// hpFraction = clamp(hp/max, 0, 1); hpBonus = 6 × that.
// raw = (10 + speedBonus + hpBonus) × (elite ? 2 : 1); then onGoldEarned, rounded once.

describe('computeGoldReward — performance-scaled gold', () => {
  it('fast + clean win pays the maximum (turns 1, full HP, normal)', () => {
    // speed = 8×(5/5)=8, hp = 6×1 = 6 ⇒ (10+8+6) = 24
    expect(computeGoldReward({ turns: 1, hpRetained: 60, maxHp: 60, isElite: false }, [])).toBe(24);
  });

  it('slow + hurt win pays little (turns 6 = median, half HP, normal)', () => {
    // speed = 8×(0/5)=0, hp = 6×0.5 = 3 ⇒ (10+0+3) = 13
    expect(computeGoldReward({ turns: 6, hpRetained: 30, maxHp: 60, isElite: false }, [])).toBe(13);
  });

  it('winning slower than the median never dips the speed bonus below zero (turns 10)', () => {
    // speed clamps at 0; hp = 6×(15/60)=1.5 ⇒ 10+0+1.5 = 11.5 → round → 12
    expect(computeGoldReward({ turns: 10, hpRetained: 15, maxHp: 60, isElite: false }, [])).toBe(12);
  });

  it('a mid-speed clean win (turns 3, full HP, normal) rounds once at the aggregate', () => {
    // speed = 8×(3/5)=4.8, hp = 6 ⇒ 10+4.8+6 = 20.8 → round → 21
    expect(computeGoldReward({ turns: 3, hpRetained: 60, maxHp: 60, isElite: false }, [])).toBe(21);
  });

  it('elite multiplies the whole reward (fast clean elite = 24 × 2)', () => {
    expect(computeGoldReward({ turns: 1, hpRetained: 60, maxHp: 60, isElite: true }, [])).toBe(48);
  });

  it("applies the onGoldEarned relic hook last (Miser's Knuckle +25% on 24 → 30)", () => {
    expect(computeGoldReward({ turns: 1, hpRetained: 60, maxHp: 60, isElite: false }, ['misers-knuckle'])).toBe(30);
  });

  it('never returns negative gold and floors bonuses at zero HP / very slow', () => {
    // speed 0, hp 0 ⇒ raw 10
    expect(computeGoldReward({ turns: 20, hpRetained: 0, maxHp: 60, isElite: false }, [])).toBe(10);
  });

  it('is deterministic (same inputs ⇒ same gold)', () => {
    const a = computeGoldReward({ turns: 4, hpRetained: 42, maxHp: 60, isElite: true }, ['misers-knuckle']);
    const b = computeGoldReward({ turns: 4, hpRetained: 42, maxHp: 60, isElite: true }, ['misers-knuckle']);
    expect(a).toBe(b);
  });
});
