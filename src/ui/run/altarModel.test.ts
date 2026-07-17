/**
 * The altar view-model: the odds row mirrors the engine's depth-scaled `altarOdds` table exactly,
 * the locked-pool count reflects the profile, and "nothing left" trips only when every relic is owned.
 */
import {
  ALTAR_ODDS_SHALLOW,
  INITIAL_META_STATE,
  RELIC_IDS,
  UNLOCKED_BY_DEFAULT_IDS,
  altarOdds,
  getRelic,
  startRun,
} from '../../engine/run';
import type { MetaState, RunState } from '../../engine/run';
import { computeAltarView } from './altarModel';

/** A run parked in the `altar` phase. A fresh run's current node sits at floor 0 (Act 1). */
function atAltar(seed: number): RunState {
  return { ...startRun(seed), phase: { kind: 'altar', rngState: { seed: 1 } as never } };
}

describe('computeAltarView', () => {
  it('mirrors the engine odds for the current (act, floor) and formats them as percentages', () => {
    const state = atAltar(5);
    const view = computeAltarView(state, INITIAL_META_STATE);
    expect(view.act).toBe(1);
    expect(view.floor).toBe(0);
    expect(view.globalFloor).toBe(0);
    // Floor 0 of Act 1 sits at the shallow anchor.
    expect(view.odds).toEqual(altarOdds(1, 0));
    expect(view.odds).toEqual(ALTAR_ODDS_SHALLOW);
    expect(view.oddsPct).toEqual({ common: '90%', epic: '10%', legendary: '0%' });
  });

  it('counts the locked pool a sacrifice could draw from (fresh = everything but the base 12)', () => {
    const view = computeAltarView(atAltar(5), INITIAL_META_STATE);
    expect(view.lockedCount).toBe(RELIC_IDS.length - UNLOCKED_BY_DEFAULT_IDS.length);
    expect(view.nothingLeft).toBe(false);
  });

  it('reports nothing left to unlock once every relic is owned', () => {
    const maxed: MetaState = { ...INITIAL_META_STATE, unlockedRelicIds: [...RELIC_IDS] };
    const view = computeAltarView(atAltar(5), maxed);
    expect(view.lockedCount).toBe(0);
    expect(view.nothingLeft).toBe(true);
  });

  it('shows EFFECTIVE odds — a rarity with no locked relics reads 0%, not the raw ramp (review M2)', () => {
    const legendaryIds = RELIC_IDS.filter((id) => getRelic(id).tier === 'legendary');
    // All legendaries (and the base) unlocked ⇒ the locked pool has zero legendaries left to draw.
    const noLegendaries: MetaState = {
      ...INITIAL_META_STATE,
      unlockedRelicIds: [...UNLOCKED_BY_DEFAULT_IDS, ...legendaryIds],
    };
    // A deep (Act-2) altar where the RAW ramp would promise a legendary.
    const deep = { ...startRun(5), act: 2, phase: { kind: 'altar', rngState: { seed: 1 } as never } } as RunState;
    expect(altarOdds(2, 0).legendary).toBeGreaterThan(0); // raw ramp at this depth has legendary mass

    const view = computeAltarView(deep, noLegendaries);
    expect(view.odds.legendary).toBe(0); // effective — none left to unlock, so the pill reads 0%
    expect(view.oddsPct.legendary).toBe('0%');
    expect(view.odds.common + view.odds.epic + view.odds.legendary).toBeCloseTo(1, 10);
  });
});
