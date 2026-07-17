/**
 * Meta-progression tests: run scoring (formula + terminal-state derivation), cumulative-score
 * tranche unlocks (idempotent, exactly-once), MetaState persistence round-trip, and the
 * no-power-creep invariant (a maxed profile plays vanilla identically to a fresh one).
 */
import { startRun } from './runFlow';
import { driveRun, greedyComboPath, trivialSwapPath } from './runPolicy';
import { nodeById } from './mapNav';
import { actFloorOffset } from './runConfig';
import { VARIANT_IDS } from './variants';
import { currentRunNode } from './runTypes';
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

describe('runScoreInput — derived from a terminal RunState (R2: cumulative across acts)', () => {
  it('a 2-ACT VICTORY counts BOTH acts: global boss floor + prior-act + Act-2 encounters + boss', () => {
    // Seed 7 wins the full TWO-ACT run (beats both bosses). R2: scoring is CUMULATIVE — floors read
    // the GLOBAL boss floor (Act-2 boss floor + the full Act-1 span beneath it) and encounters credit
    // the Act-1 tally banked at the transition (`priorActsEncountersWon`) plus the Act-2 path + boss.
    const state = driveRun(startRun(7), greedyComboPath).state;
    expect(state.status).toBe('victory');
    expect(state.act).toBe(2);
    const prior = state.priorActsEncountersWon ?? 0;
    expect(prior).toBeGreaterThan(0); // Act 1 (its fights/elites + the Act-1 boss) was banked
    const input = runScoreInput(state);
    expect(input.victory).toBe(true);
    // Global floor = Act-2 boss floor + Act-1 depth (offset 13) = 12 + 13 = 25.
    expect(input.floorsCleared).toBe(state.map.floorCount - 1 + actFloorOffset(state.act));
    // Both acts: prior (Act-1 fights/elites + its boss) + Act-2 fights/elites + the Act-2 boss.
    expect(input.encountersWon).toBe(prior + visitedEncounters(state) + 1);
    expect(scoreForRun(state)).toBe(scoreRun(input));
  });

  it('an immediate floor-0 DEFEAT banks nothing (died to the intro slime, no wins)', () => {
    const state = driveRun(startRun(1), trivialSwapPath).state;
    expect(state.status).toBe('defeat');
    expect(state.act).toBe(1); // died in Act 1 — no prior acts, global floor 0
    const input = runScoreInput(state);
    expect(input.floorsCleared).toBe(0);
    expect(input.encountersWon).toBe(0);
    expect(input.victory).toBe(false);
    expect(scoreForRun(state)).toBe(0);
  });

  it('a mid-run combat DEFEAT does NOT count the encounter it died in (cumulative-aware)', () => {
    // Seed 2 dies IN an Act-1 fight/elite past floor 0 — a real mid-map death (NOT a boss death,
    // whose node is a `boss` type and so is never in the fight/elite count). Act 1 ⇒ no prior acts.
    const state = driveRun(startRun(2), greedyComboPath).state;
    const diedInType = nodeById(state.map, state.mapState.currentNodeId).type;
    expect(state.status).toBe('defeat');
    expect(state.act).toBe(1);
    expect(runScoreInput(state).floorsCleared).toBeGreaterThan(0);
    expect(diedInType === 'fight' || diedInType === 'elite').toBe(true);
    // The current node is the fight it lost — counted in visitedEncounters but NOT a win.
    expect(runScoreInput(state).encountersWon).toBe(
      (state.priorActsEncountersWon ?? 0) + visitedEncounters(state) - 1,
    );
  });

  it('a mid-ACT-2 DEFEAT credits Act 1 cumulatively (R2 cross-act banking)', () => {
    // Seed 18 clears Act 1, then dies in an Act-2 fight/elite. Its banked score MUST include Act 1
    // (both its floors, via the global offset, and its encounters, via `priorActsEncountersWon`).
    // STAGE-6 RETUNE: re-pointed seed 5→18 — the eased Act-2 constants let seed 5 now WIN, so a fresh
    // seed that still dies mid-Act-2 with the color-blind greedyComboPath was selected for the scenario.
    const state = driveRun(startRun(18), greedyComboPath).state;
    const diedInType = nodeById(state.map, state.mapState.currentNodeId).type;
    expect(state.status).toBe('defeat');
    expect(state.act).toBe(2);
    expect(diedInType === 'fight' || diedInType === 'elite').toBe(true);
    const prior = state.priorActsEncountersWon ?? 0;
    expect(prior).toBeGreaterThan(0); // Act 1's whole traversal was banked at the transition
    const input = runScoreInput(state);
    // Global floor is past the Act-1 span (≥ 13), proving Act-1 depth is credited.
    expect(input.floorsCleared).toBe(currentRunNode(state).floor + actFloorOffset(2));
    expect(input.floorsCleared).toBeGreaterThan(actFloorOffset(2)); // strictly into Act 2
    // Encounters = Act-1 bank + (Act-2 fights/elites minus the one it died in).
    expect(input.encountersWon).toBe(prior + visitedEncounters(state) - 1);
    expect(scoreForRun(state)).toBe(scoreRun(input));
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
