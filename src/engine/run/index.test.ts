/**
 * Barrel smoke test: the public run-engine API is reachable from the package root and an
 * end-to-end slice (generate a map → navigate it → draft a relic → apply a hook) runs
 * through the barrel exports alone. Guards against a missing / renamed re-export breaking
 * the run-lifecycle layer, the sim, and the UI.
 */
import { createRng } from '../board';
import * as run from './index';

describe('run barrel — public API surface', () => {
  it('re-exports map, seed, relic, and draft entry points', () => {
    expect(typeof run.generateMap).toBe('function');
    expect(typeof run.difficultyAt).toBe('function');
    expect(typeof run.createMapState).toBe('function');
    expect(typeof run.moveTo).toBe('function');
    expect(typeof run.mapSeedFor).toBe('function');
    expect(typeof run.applyRelicHooks).toBe('function');
    expect(typeof run.buildCombatModifiers).toBe('function');
    expect(typeof run.draftOptions).toBe('function');
    expect(typeof run.startEncounterWithRelics).toBe('function');
    expect(run.ROSTER).toHaveLength(12);
    expect(run.RELIC_IDS).toHaveLength(12);
    expect(run.DEFAULT_MAP_CONFIG.floorPlan.length).toBeGreaterThan(0);
    expect(run.DRAFT_OPTION_COUNT).toBe(3);
  });

  it('runs a generate → navigate → draft → hook slice via the barrel only', () => {
    const map = run.generateMap(run.mapSeedFor(2026));
    let state = run.createMapState(map);
    while (!run.isComplete(map, state)) {
      state = run.moveTo(map, state, run.legalNextNodes(map, state)[0]);
    }
    expect(run.currentNode(map, state).type).toBe('boss');

    const { options } = run.draftOptions([], createRng(run.draftSeedFor(2026, 0)), 'elite');
    expect(options.length).toBeGreaterThan(0);
    const owned = run.applyDraft([], options[0]);
    expect(owned).toEqual([options[0]]);

    // A hook fold on the drafted relic is a plain number transform.
    const v = run.applyRelicHooks('onDamageComputed', 10, { color: 'R', totalCombos: 2 }, owned);
    expect(typeof v).toBe('number');
  });

  it('reaches every re-exported function through the barrel (no broken re-export)', () => {
    const map = run.generateMap(7);
    const s0 = run.createMapState(map);
    // Map helpers.
    expect(run.difficultyAt(3)).toBeGreaterThan(run.difficultyAt(0));
    expect(run.isEncounter('elite')).toBe(true);
    expect(() => run.validateMap(map)).not.toThrow();
    expect(run.nodeById(map, map.startId).id).toBe(map.startId);
    expect(run.nodesOnFloor(map, 0)).toHaveLength(1);
    expect(run.canMoveTo(map, s0, run.legalNextNodes(map, s0)[0])).toBe(true);
    // Seed helpers.
    expect(run.deriveSeed(1, run.RUN_TAG_MAP)).toBe(run.mapSeedFor(1));
    expect(typeof run.draftSeedFor(1, 0)).toBe('number');
    // Relic registry + roster helpers.
    expect(run.getRelic('emberfang').tier).toBe('normal');
    expect(() => run.assertRosterWellFormed()).not.toThrow();
    // Relic hook helpers.
    expect(typeof run.buildCombatModifiers(['emberfang']).damageGroup).toBe('function');
    expect(run.combatStartEnemyChip(['ambushers-cowl'])).toBe(10);
    expect(run.combatStartPlayerHeal(['phoenix-feather'])).toBe(8);
    expect(run.turnStartRegen(['second-wind'])).toBe(1);
    expect(run.applyGoldRelics(100, ['misers-knuckle'])).toBe(125);
    // Relic-aware combat wrappers.
    const enc = run.startEncounterWithRelics('slime', 7, ['ambushers-cowl']);
    expect(enc.enemyHp).toBe(70);
    const res = run.playTurnWithRelics(enc, { start: { col: 2, row: 2 }, steps: ['up', 'left'] }, ['second-wind']);
    expect(['ongoing', 'won', 'lost']).toContain(res.status);
  });
});
