/**
 * Meta-progression tests: run scoring (formula + terminal-state derivation), cumulative-score
 * tranche unlocks (idempotent, exactly-once), MetaState persistence round-trip, and the
 * no-power-creep invariant (a maxed profile plays vanilla identically to a fresh one).
 */
import { startRun } from './runFlow';
import { driveRun, greedyComboPath, trivialSwapPath } from './runPolicy';
import { nodeById } from './mapNav';
import { VARIANT_IDS } from './variants';
import type { RunState } from './runTypes';
import {
  META_VICTORY_BONUS,
  META_SCORE_PER_FLOOR,
  META_SCORE_PER_ENCOUNTER_WON,
  INITIAL_META_STATE,
  UNLOCK_TRANCHES,
  scoreRun,
  runScoreInput,
  scoreForRun,
  unlockedAtScore,
  applyUnlocks,
  bankRun,
  isVariantUnlocked,
  selectableStarts,
  loadMeta,
  InMemoryMetaStore,
} from './meta';

/** Count the fight/elite nodes on a run's visited path (encounters entered). */
function visitedEncounters(state: RunState): number {
  return state.mapState.visited.filter((id) => {
    const t = nodeById(state.map, id).type;
    return t === 'fight' || t === 'elite';
  }).length;
}

describe('scoreRun — the run-score formula', () => {
  it('sums floors, encounters won, and a victory bonus', () => {
    expect(scoreRun({ floorsCleared: 12, encountersWon: 11, victory: true })).toBe(
      12 * META_SCORE_PER_FLOOR + 11 * META_SCORE_PER_ENCOUNTER_WON + META_VICTORY_BONUS,
    );
  });

  it('omits the victory bonus for a defeat (but still banks floors + encounters)', () => {
    expect(scoreRun({ floorsCleared: 5, encountersWon: 4, victory: false })).toBe(
      5 * META_SCORE_PER_FLOOR + 4 * META_SCORE_PER_ENCOUNTER_WON,
    );
  });

  it('a run that made zero progress banks zero', () => {
    expect(scoreRun({ floorsCleared: 0, encountersWon: 0, victory: false })).toBe(0);
  });
});

describe('runScoreInput — derived from a terminal RunState', () => {
  it('a VICTORY counts every visited encounter plus the boss, at the boss floor', () => {
    const state = driveRun(startRun(10), greedyComboPath).state;
    expect(state.status).toBe('victory');
    const input = runScoreInput(state);
    expect(input.victory).toBe(true);
    expect(input.floorsCleared).toBe(state.map.floorCount - 1); // boss floor
    expect(input.encountersWon).toBe(visitedEncounters(state) + 1); // + the boss
    expect(scoreForRun(state)).toBe(scoreRun(input));
  });

  it('an immediate floor-0 DEFEAT banks nothing (died to the intro slime, no wins)', () => {
    const state = driveRun(startRun(1), trivialSwapPath).state;
    expect(state.status).toBe('defeat');
    const input = runScoreInput(state);
    expect(input.floorsCleared).toBe(0);
    expect(input.encountersWon).toBe(0);
    expect(input.victory).toBe(false);
    expect(scoreForRun(state)).toBe(0);
  });

  it('a mid-run combat DEFEAT does NOT count the encounter it died in', () => {
    // Find a greedy defeat that reached past floor 0 (a real mid-map death).
    let dead: RunState | null = null;
    for (let seed = 1; seed <= 40 && dead === null; seed++) {
      const s = driveRun(startRun(seed), greedyComboPath).state;
      if (s.status === 'defeat' && runScoreInput(s).floorsCleared > 0) dead = s;
    }
    expect(dead).not.toBeNull();
    const state = dead as RunState;
    // The current node is the fight it lost — counted in visitedEncounters but NOT a win.
    expect(runScoreInput(state).encountersWon).toBe(visitedEncounters(state) - 1);
  });
});

describe('tranche table — pacing structure', () => {
  it('has one strictly-ascending tranche per variant, in canonical order', () => {
    expect(UNLOCK_TRANCHES).toHaveLength(VARIANT_IDS.length);
    for (let i = 0; i < UNLOCK_TRANCHES.length; i++) {
      expect(UNLOCK_TRANCHES[i].variantId).toBe(VARIANT_IDS[i]);
      if (i > 0) expect(UNLOCK_TRANCHES[i].score).toBeGreaterThan(UNLOCK_TRANCHES[i - 1].score);
    }
  });

  it('unlockedAtScore returns exactly the variants whose threshold is met', () => {
    expect(unlockedAtScore(0)).toEqual([]);
    expect(unlockedAtScore(UNLOCK_TRANCHES[0].score - 1)).toEqual([]);
    expect(unlockedAtScore(UNLOCK_TRANCHES[0].score)).toEqual([VARIANT_IDS[0]]);
    expect(unlockedAtScore(UNLOCK_TRANCHES[2].score)).toEqual(VARIANT_IDS.slice(0, 3));
    expect(unlockedAtScore(999999)).toEqual([...VARIANT_IDS]);
  });
});

describe('applyUnlocks / bankRun — idempotent, exactly-once unlocks', () => {
  it('applyUnlocks is idempotent and returns the same reference when already current', () => {
    const once = applyUnlocks({ score: UNLOCK_TRANCHES[1].score, unlockedVariantIds: [] });
    expect(once.unlockedVariantIds).toEqual(VARIANT_IDS.slice(0, 2));
    const twice = applyUnlocks(once);
    expect(twice).toBe(once); // no-op ⇒ same object
  });

  it('never revokes an already-earned variant even if its threshold is not met by score', () => {
    const meta = applyUnlocks({ score: 0, unlockedVariantIds: [VARIANT_IDS[0]] });
    expect(meta.unlockedVariantIds).toContain(VARIANT_IDS[0]);
  });

  it('bankRun accumulates score and unlocks newly-earned variants exactly once', () => {
    let meta = INITIAL_META_STATE;
    meta = bankRun(meta, UNLOCK_TRANCHES[0].score); // crosses T1
    expect(meta.score).toBe(UNLOCK_TRANCHES[0].score);
    expect(meta.unlockedVariantIds).toEqual([VARIANT_IDS[0]]);

    meta = bankRun(meta, 0); // bank a zero-score run — no new unlock, no duplicate
    expect(meta.unlockedVariantIds).toEqual([VARIANT_IDS[0]]);

    meta = bankRun(meta, UNLOCK_TRANCHES[UNLOCK_TRANCHES.length - 1].score); // vault to the top
    expect(meta.unlockedVariantIds).toEqual([...VARIANT_IDS]); // full slate, no dupes
    expect(new Set(meta.unlockedVariantIds).size).toBe(VARIANT_IDS.length);
  });

  it('a negative run score cannot reduce the profile score', () => {
    const meta = bankRun({ score: 100, unlockedVariantIds: [] }, -50);
    expect(meta.score).toBe(100);
  });

  it('reload-then-reapply (replay) never double-unlocks', () => {
    const banked = bankRun(INITIAL_META_STATE, UNLOCK_TRANCHES[3].score);
    const reloaded = applyUnlocks(banked); // simulate load → applyUnlocks
    expect(reloaded.unlockedVariantIds).toEqual(banked.unlockedVariantIds);
  });
});

describe('MetaStorePort — persistence round-trip', () => {
  it('saves and loads a MetaState losslessly through the in-memory store', () => {
    const store = new InMemoryMetaStore();
    const meta = bankRun(INITIAL_META_STATE, UNLOCK_TRANCHES[2].score);
    store.save(meta);
    expect(store.load()).toEqual(meta);
  });

  it('loadMeta returns a fresh profile when nothing is saved, and re-applies unlocks on load', () => {
    const store = new InMemoryMetaStore();
    expect(loadMeta(store)).toEqual(INITIAL_META_STATE);

    // A stored state whose unlocks lag its score is repaired on load (forward-compat).
    store.save({ score: UNLOCK_TRANCHES[1].score, unlockedVariantIds: [] });
    expect(loadMeta(store).unlockedVariantIds).toEqual(VARIANT_IDS.slice(0, 2));
  });

  it('clear() resets the profile (a full meta reset is possible)', () => {
    const store = new InMemoryMetaStore();
    store.save(bankRun(INITIAL_META_STATE, 999));
    store.clear();
    expect(store.load()).toBeNull();
    expect(loadMeta(store)).toEqual(INITIAL_META_STATE);
  });
});

describe('selectableStarts / isVariantUnlocked', () => {
  it('vanilla (null) is always first; unlocked variants follow in canonical order', () => {
    expect(selectableStarts(INITIAL_META_STATE)).toEqual([null]);
    const maxed = bankRun(INITIAL_META_STATE, 999999);
    expect(selectableStarts(maxed)).toEqual([null, ...VARIANT_IDS]);
  });

  it('isVariantUnlocked reflects the unlocked set', () => {
    const meta = bankRun(INITIAL_META_STATE, UNLOCK_TRANCHES[0].score);
    expect(isVariantUnlocked(meta, VARIANT_IDS[0])).toBe(true);
    expect(isVariantUnlocked(meta, VARIANT_IDS[5])).toBe(false);
  });
});

describe('NO POWER CREEP — a maxed profile plays vanilla identically to a fresh one', () => {
  it('startRun(seed) is byte-identical regardless of meta progression', () => {
    const maxed = bankRun(INITIAL_META_STATE, 999999);
    expect(selectableStarts(maxed)).toEqual([null, ...VARIANT_IDS]); // fully unlocked

    // The vanilla start does not read meta at all, so fresh and maxed produce the same RunState.
    const fresh = startRun(42);
    const fromMaxed = startRun(42); // meta is not an argument — it CANNOT influence this
    expect(JSON.stringify(fromMaxed)).toBe(JSON.stringify(fresh));
    expect('variantId' in fresh).toBe(false);
  });
});
