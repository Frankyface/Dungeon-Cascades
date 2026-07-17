/**
 * Boss Rush tests (Stage-6 wave 2, spec §6): the unlock GATE, the fixed thematic ORDER, a
 * serializable/resumable state, structural soundness (no wedge, reaches terminal), the between-boss
 * heal + draft, COMPLETABILITY under a strong dev loadout (all five → victory), and the victory →
 * God of War award. Balance (the no-relic sanity bot dying to boss 0 at Act-2 scaling) is the
 * sim-tuning wave's job — here we prove the machinery, not the numbers.
 */
import { greedyComboPath } from './runPolicy';
import { INITIAL_META_STATE } from './meta';
import { devUnlockAllMeta } from './devMode';
import { applyBossRushVictory } from './unlocks';
import {
  BOSS_RUSH_BOSSES,
  BOSS_RUSH_ORDER,
  BOSS_RUSH_HEAL_FRACTION,
  driveBossRush,
  isBossRushTerminal,
  playBossRushTurn,
  resolveBossRushDraft,
  startBossRush,
} from './bossRush';
import type { BossRushState } from './bossRush';

const STRONG_LOADOUT = [
  'bloodstone-altar',
  'cascade-sigil',
  'whetstone-charm',
  'rowan-chalice',
  'bulwark-rune',
  'crescendo-crown',
  'prism-overcharge',
  'marrow-of-the-colossus',
];

describe('startBossRush — gating (§6)', () => {
  it('throws when Boss Rush is not unlocked', () => {
    expect(() => startBossRush(1, INITIAL_META_STATE)).toThrow(/not unlocked/i);
  });

  it('begins the first boss when unlocked (full HP, no relics, combat phase)', () => {
    const s = startBossRush(1, devUnlockAllMeta());
    expect(s.status).toBe('active');
    expect(s.bossIndex).toBe(0);
    expect(s.playerHp).toBe(s.playerMaxHp);
    expect(s.relicIds).toEqual([]);
    expect(s.phase.kind).toBe('combat');
  });
});

describe('Boss Rush order + data (§6)', () => {
  it('fights the five bosses in the fixed thematic order (dungeon → glacial → ember → rotwood → sunken)', () => {
    expect(BOSS_RUSH_ORDER).toEqual(['bone-colossus', 'rimeheart', 'forgeheart', 'the-rotmother', 'drowned-sovereign']);
    expect(BOSS_RUSH_BOSSES).toHaveLength(5);
  });
});

describe('BossRushState — serializable & resumable', () => {
  it('round-trips through JSON losslessly (a mid-attempt save reloads identically)', () => {
    const s = startBossRush(9, devUnlockAllMeta());
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe('Boss Rush — structural soundness (no wedge, reaches terminal)', () => {
  it('every attempt terminates (the no-relic sanity bot dies to boss 0, but never wedges)', () => {
    const meta = devUnlockAllMeta();
    for (let seed = 0; seed < 6; seed++) {
      const res = driveBossRush(startBossRush(seed, meta), greedyComboPath);
      expect(res.terminated).toBe(true);
      expect(isBossRushTerminal(res.state)).toBe(true);
      expect(['victory', 'defeat']).toContain(res.state.status);
      expect(res.steps).toBeLessThan(2000);
    }
  });
});

describe('Boss Rush — between-boss heal + draft (§6)', () => {
  /** Drive a strong-loadout rush and capture the FIRST between-boss draft phase reached. */
  function firstDraftState(seed: number): BossRushState {
    let state: BossRushState = { ...startBossRush(seed, devUnlockAllMeta()), relicIds: STRONG_LOADOUT };
    for (let i = 0; i < 2000 && state.status === 'active'; i++) {
      if (state.phase.kind === 'draft') return state;
      if (state.phase.kind === 'combat') state = playBossRushTurn(state, greedyComboPath(state.phase.encounter.board)).state;
      else break;
    }
    throw new Error('no draft phase reached');
  }

  it('clearing a non-final boss heals ~30% and opens a draft from the unlocked pool', () => {
    const draft = firstDraftState(3); // seed 3 clears boss 0 with the strong loadout
    expect(draft.phase.kind).toBe('draft');
    if (draft.phase.kind !== 'draft') throw new Error('unreachable');
    expect(draft.bossIndex).toBe(0); // still on boss 0's slot until the draft resolves into boss 1
    expect(draft.phase.options.length).toBeGreaterThan(0);
    expect(draft.playerHp).toBeGreaterThan(0);
    expect(draft.playerHp).toBeLessThanOrEqual(draft.playerMaxHp);
    // Resolving the draft adds the relic and advances to the NEXT boss's combat.
    const picked = draft.phase.options[0];
    const next = resolveBossRushDraft(draft, picked);
    expect(next.phase.kind).toBe('combat');
    expect(next.bossIndex).toBe(1);
    expect(next.relicIds).toContain(picked);
  });

  it('the heal fraction constant is the documented 30%', () => {
    expect(BOSS_RUSH_HEAL_FRACTION).toBe(0.3);
  });
});

describe('Boss Rush — completability + God of War award (§6, §3)', () => {
  it('is COMPLETABLE: a strong loadout clears all five bosses to victory (seed 3)', () => {
    const start: BossRushState = { ...startBossRush(3, devUnlockAllMeta()), relicIds: STRONG_LOADOUT };
    const res = driveBossRush(start, greedyComboPath);
    expect(res.state.status).toBe('victory');
    expect(res.bossesCleared).toBe(5);
    expect(res.terminated).toBe(true);
  });

  it('a Boss-Rush victory awards God of War (first win only)', () => {
    // The mode does not touch meta itself; the caller applies the award on victory.
    const awarded = applyBossRushVictory(INITIAL_META_STATE);
    expect(awarded.meta.godOfWarUnlocked).toBe(true);
    expect(awarded.events).toContainEqual({ kind: 'godOfWarUnlocked' });
  });
});
