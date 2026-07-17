/**
 * Altar mechanics tests (Stage-6 wave 2, spec §2c): the depth-scaled rarity ODDS TABLE (each row
 * sums to 1; deeper skews to epic/legendary), and the seeded LOCKED-pool PICK (deterministic, never
 * an already-unlocked relic, graceful degradation when a rarity pool is empty, null when nothing is
 * left). Plus the sacrifice / leave flow: sacrifice ends the run `sacrificed`, banks score as a
 * defeat, and unlocks the relic in meta; leaving is a no-op.
 */
import { createRng } from '../board';
import {
  ALTAR_ODDS_DEEP,
  ALTAR_ODDS_SHALLOW,
  altarOdds,
  pickAltarUnlock,
} from './altar';
import { RELIC_IDS, UNLOCKED_BY_DEFAULT_IDS } from './relics';
import { INITIAL_META_STATE } from './meta';
import { startRun, enterNode, sacrificeAtAltar, leaveAltar } from './runFlow';
import { scoreForRun, runScoreInput } from './meta';
import type { RunState } from './runTypes';

describe('altarOdds — depth-scaled rarity odds table', () => {
  it('every (act, floor) row sums to 1', () => {
    for (const act of [1, 2]) {
      for (let floor = 0; floor <= 12; floor++) {
        const o = altarOdds(act, floor);
        expect(o.common + o.epic + o.legendary).toBeCloseTo(1, 10);
        expect(o.common).toBeGreaterThanOrEqual(0);
        expect(o.epic).toBeGreaterThanOrEqual(0);
        expect(o.legendary).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('hits the shallow anchor at Act-1 floor 0 and the deep anchor at Act-2 floor 12', () => {
    expect(altarOdds(1, 0)).toEqual(ALTAR_ODDS_SHALLOW); // 90/10/0
    const deep = altarOdds(2, 12); // global depth 25 = the deep anchor
    expect(deep.common).toBeCloseTo(ALTAR_ODDS_DEEP.common, 10);
    expect(deep.epic).toBeCloseTo(ALTAR_ODDS_DEEP.epic, 10);
    expect(deep.legendary).toBeCloseTo(ALTAR_ODDS_DEEP.legendary, 10);
  });

  it('common falls and legendary rises monotonically with global depth', () => {
    const rows = [altarOdds(1, 0), altarOdds(1, 12), altarOdds(2, 0), altarOdds(2, 12)];
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].common).toBeLessThan(rows[i - 1].common);
      expect(rows[i].legendary).toBeGreaterThan(rows[i - 1].legendary);
    }
  });
});

describe('pickAltarUnlock — seeded pick from the LOCKED pool', () => {
  it('is deterministic for a given seed + unlocked set', () => {
    const a = pickAltarUnlock(createRng(7), [...UNLOCKED_BY_DEFAULT_IDS], 2, 8);
    const b = pickAltarUnlock(createRng(7), [...UNLOCKED_BY_DEFAULT_IDS], 2, 8);
    expect(a.relicId).toBe(b.relicId);
    expect(a.rarity).toBe(b.rarity);
  });

  it('only ever picks a LOCKED relic (never one already unlocked)', () => {
    const unlocked = [...UNLOCKED_BY_DEFAULT_IDS];
    for (let seed = 0; seed < 200; seed++) {
      const pick = pickAltarUnlock(createRng(seed), unlocked, 1, 3);
      expect(pick.relicId).not.toBeNull();
      expect(unlocked).not.toContain(pick.relicId);
      expect(RELIC_IDS).toContain(pick.relicId); // still a real roster relic
    }
  });

  it('returns null when every relic is already unlocked', () => {
    const pick = pickAltarUnlock(createRng(1), [...RELIC_IDS], 1, 5);
    expect(pick.relicId).toBeNull();
    expect(pick.rarity).toBeNull();
  });

  it('degrades gracefully when the rolled rarity pool is empty (falls back to the whole locked pool)', () => {
    // Unlock every relic EXCEPT one common ⇒ that common is the ONLY locked relic. A deep floor rolls
    // mostly legendary/epic — both empty — so the pick must fall back to the lone common, never null.
    const lockedCommon = 'cinderbrand-nail';
    const unlocked = RELIC_IDS.filter((id) => id !== lockedCommon);
    for (let seed = 0; seed < 50; seed++) {
      const pick = pickAltarUnlock(createRng(seed), unlocked, 2, 12);
      expect(pick.relicId).toBe(lockedCommon);
      expect(pick.rarity).toBe('common');
    }
  });

  it('deep-floor picks skew to legendary while shallow picks never are (the odds actually bite)', () => {
    const unlocked = [...UNLOCKED_BY_DEFAULT_IDS]; // 76 locked relics across all three rarities
    const legendaryRate = (act: number, floor: number): number => {
      let leg = 0;
      for (let seed = 0; seed < 300; seed++) {
        if (pickAltarUnlock(createRng(seed), unlocked, act, floor).rarity === 'legendary') leg++;
      }
      return leg / 300;
    };
    const shallow = legendaryRate(1, 0); // legendary odds 0 ⇒ ~0
    const deep = legendaryRate(2, 12); // legendary odds 0.25 ⇒ clearly higher
    expect(shallow).toBeLessThan(0.02);
    expect(deep).toBeGreaterThan(shallow);
    expect(deep).toBeGreaterThan(0.15);
  });
});

describe('sacrifice / leave flow (spec §2c)', () => {
  /** Park a fresh run at a synthetic altar phase (enterNode on a node coerced to `altar`). */
  function atAltar(seed: number, act: 1 | 2 = 1): RunState {
    const base = startRun(seed);
    // Coerce the current node's type to 'altar' so enterNode routes to the altar phase deterministically.
    const nodes = base.map.nodes.map((n) => (n.id === base.mapState.currentNodeId ? { ...n, type: 'altar' as const } : n));
    const withAltar: RunState = { ...base, act, map: { ...base.map, nodes } };
    return enterNode(withAltar);
  }

  it('entering an altar node yields the altar phase with its own seeded rng', () => {
    const state = atAltar(3);
    expect(state.phase.kind).toBe('altar');
  });

  it('sacrifice ends the run `sacrificed`, banks score as a defeat, and unlocks a locked relic in meta', () => {
    const state = atAltar(3);
    const { state: after, meta, events, relicId } = sacrificeAtAltar(state, INITIAL_META_STATE);
    expect(after.status).toBe('sacrificed');
    expect(after.phase.kind).toBe('ended');
    // Counts as a defeat for scoring: NOT a victory, so no victory bonus.
    expect(runScoreInput(after).victory).toBe(false);
    expect(scoreForRun(after)).toBe(scoreForRun({ ...after, status: 'defeat' })); // same as a defeat
    // A brand-new relic was unlocked into meta (from the 76 locked), with a matching event.
    expect(relicId).not.toBeNull();
    expect(UNLOCKED_BY_DEFAULT_IDS).not.toContain(relicId);
    expect(meta.unlockedRelicIds).toContain(relicId);
    expect(meta.altarUnlockCount).toBe(1);
    expect(events).toContainEqual({ kind: 'relic', relicId, source: 'altar' });
  });

  it('leaving the altar is a no-op that advances to the move phase (run stays active)', () => {
    const state = atAltar(3);
    const after = leaveAltar(state);
    expect(after.status).toBe('active');
    expect(after.phase.kind).toBe('awaiting_move');
  });

  it('the sacrifice pick is deterministic for a given (run, meta)', () => {
    const a = sacrificeAtAltar(atAltar(11), INITIAL_META_STATE);
    const b = sacrificeAtAltar(atAltar(11), INITIAL_META_STATE);
    expect(a.relicId).toBe(b.relicId);
  });
});
