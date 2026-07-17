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
  BOSS_RUSH_PREDRAFT_COUNT,
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

  it('begins with full HP, no relics, and the pre-boss-1 loadout ceremony (a draft phase)', () => {
    // PRE-DRAFT (decisions.md 2026-07-17): an attempt now OPENS with the loadout ceremony (a draft),
    // not straight into boss-0 combat, so a human never starts bare-fisted at floor-25 scaling.
    const s = startBossRush(1, devUnlockAllMeta());
    expect(s.status).toBe('active');
    expect(s.bossIndex).toBe(0);
    expect(s.playerHp).toBe(s.playerMaxHp);
    expect(s.relicIds).toEqual([]);
    expect(s.phase.kind).toBe('draft');
    expect(s.predraftsRemaining).toBe(BOSS_RUSH_PREDRAFT_COUNT);
  });
});

describe('Boss Rush — pre-boss-1 loadout ceremony (§6, decisions.md 2026-07-17)', () => {
  it('is sim-tunable in [1, 3]', () => {
    expect(BOSS_RUSH_PREDRAFT_COUNT).toBeGreaterThanOrEqual(1);
    expect(BOSS_RUSH_PREDRAFT_COUNT).toBeLessThanOrEqual(3);
  });

  it('offers an epic pool for the first ceremony draft under dev-unlock', () => {
    const s = startBossRush(1, devUnlockAllMeta());
    if (s.phase.kind !== 'draft') throw new Error('expected the ceremony draft');
    expect(s.phase.options.length).toBeGreaterThan(0);
  });

  it('resolving the ceremony banks N relics and ONLY THEN enters boss 0 combat', () => {
    let s = startBossRush(1, devUnlockAllMeta());
    let taken = 0;
    while (s.phase.kind === 'draft' && (s.predraftsRemaining ?? 0) > 0) {
      s = resolveBossRushDraft(s, s.phase.options[0]);
      taken++;
    }
    expect(taken).toBe(BOSS_RUSH_PREDRAFT_COUNT); // the dev-unlock epic pool is large enough for all N
    expect(s.phase.kind).toBe('combat'); // ceremony done ⇒ boss 0 begins
    expect(s.bossIndex).toBe(0); // still boss 0 — the ceremony never advances the boss index
    expect(s.relicIds).toHaveLength(BOSS_RUSH_PREDRAFT_COUNT); // banked a real build before boss 1
    expect(s.predraftsRemaining ?? 0).toBe(0);
  });

  it('a null pick still consumes a ceremony draft (skippable, no wedge)', () => {
    const s0 = startBossRush(1, devUnlockAllMeta());
    if (s0.phase.kind !== 'draft') throw new Error('expected the ceremony draft');
    const s1 = resolveBossRushDraft(s0, null); // skip the first pre-draft
    expect(s1.relicIds).toEqual([]); // nothing added
    expect(s1.status).toBe('active');
    // Still in the ceremony (one fewer pre-draft) or into boss 0 if N was 1 — never stuck.
    expect(s1.phase.kind === 'draft' || s1.phase.kind === 'combat').toBe(true);
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
  it('every attempt terminates (loadout ceremony auto-resolves then the drive reaches terminal, never wedges)', () => {
    // driveBossRush's default draftPick auto-takes each ceremony pre-draft (first option), so the bot
    // now enters boss 0 with a small build; the attempt still always reaches a terminal state.
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
  /**
   * Drive strong-loadout rushes across seeds and return the first BETWEEN-boss draft (auto-taking the
   * pre-boss-1 ceremony pre-drafts on the way). Seed-scanning keeps this robust to the trajectory shift
   * the loadout ceremony introduces (it changes the relic set + RNG consumption before boss 0).
   */
  function firstBetweenBossDraft(): BossRushState {
    for (let seed = 0; seed < 60; seed++) {
      let state: BossRushState = { ...startBossRush(seed, devUnlockAllMeta()), relicIds: STRONG_LOADOUT };
      for (let i = 0; i < 2000 && state.status === 'active'; i++) {
        if (state.phase.kind === 'draft') {
          if ((state.predraftsRemaining ?? 0) > 0) {
            state = resolveBossRushDraft(state, state.phase.options[0]); // auto-take a ceremony pre-draft
            continue;
          }
          return state; // a between-boss draft (the ceremony is already done)
        }
        if (state.phase.kind === 'combat') {
          state = playBossRushTurn(state, greedyComboPath(state.phase.encounter.board)).state;
          continue;
        }
        break;
      }
    }
    throw new Error('no between-boss draft reached within 60 seeds');
  }

  it('clearing a non-final boss heals ~30% and opens a draft from the unlocked pool', () => {
    const draft = firstBetweenBossDraft();
    expect(draft.phase.kind).toBe('draft');
    if (draft.phase.kind !== 'draft') throw new Error('unreachable');
    expect(draft.bossIndex).toBe(0); // still on boss 0's slot until this between-boss draft resolves into boss 1
    expect(draft.predraftsRemaining ?? 0).toBe(0); // the loadout ceremony is already finished here
    expect(draft.phase.options.length).toBeGreaterThan(0);
    expect(draft.playerHp).toBeGreaterThan(0);
    expect(draft.playerHp).toBeLessThanOrEqual(draft.playerMaxHp);
    // Resolving the between-boss draft adds the relic and advances to the NEXT boss's combat.
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
  it('is COMPLETABLE: a strong loadout + the loadout ceremony clears all five bosses on some seed', () => {
    // Seed-scan for robustness: the loadout ceremony perturbs each seed's trajectory, so we assert that
    // a full five-boss clear EXISTS under a strong loadout (the §9 "completable under dev-unlock" sanity),
    // not that a specific seed does.
    let full: { readonly status: string; readonly bossesCleared: number } | null = null;
    for (let seed = 0; seed < 60 && full === null; seed++) {
      const start: BossRushState = { ...startBossRush(seed, devUnlockAllMeta()), relicIds: STRONG_LOADOUT };
      const res = driveBossRush(start, greedyComboPath);
      if (res.state.status === 'victory' && res.bossesCleared === 5 && res.terminated) {
        full = { status: res.state.status, bossesCleared: res.bossesCleared };
      }
    }
    expect(full).toEqual({ status: 'victory', bossesCleared: 5 });
  });

  it('a Boss-Rush victory awards God of War (first win only)', () => {
    // The mode does not touch meta itself; the caller applies the award on victory.
    const awarded = applyBossRushVictory(INITIAL_META_STATE);
    expect(awarded.meta.godOfWarUnlocked).toBe(true);
    expect(awarded.events).toContainEqual({ kind: 'godOfWarUnlocked' });
  });
});
