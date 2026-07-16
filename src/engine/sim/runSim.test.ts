/**
 * Full-run sim regression + determinism + gate-band tests.
 *
 * Like sim.test.ts (board) and combatSim.test.ts (combat), these lock in the CURRENT run
 * engine + policy behavior on a small fixed-seed batch (seed 42) so `npm test` fails loudly
 * if a change to the run engine, the policy/routing heuristic, or a run-layer CONSTANT
 * shifts the balance numbers. Expected values were recorded from a real 24-run batch under
 * the default run/economy/map config; if the config or engine legitimately changes, re-record
 * them and note why in the Verification Log (never fake a fixture to a formula).
 *
 * The batch is driven ONCE in beforeAll (the greedy DFS is compute-heavy — ~8s for 24 full
 * runs) and every assertion reads the shared summary. The batch also asserts the stage gates
 * in miniature (win rate 25–75, encounters/run 8–12, median moves/run 30–90, zero wedges) and
 * the skill-floor sanity (policy strictly out-wins the trivial control).
 */
import {
  DEFAULT_RUN_STEP_CAP,
  formatRunReport,
  runRunHarness,
  summarizeRun,
} from './index';
import type { RunBotName, RunGameResult, RunHarnessConfig, RunSummary } from './index';

const SEED = 42;
const BATCH = 24;
const HEAVY_TIMEOUT_MS = 120_000;

function configFor(bot: RunBotName, games: number): RunHarnessConfig {
  return { bot, games, baseSeed: SEED, stepCap: DEFAULT_RUN_STEP_CAP };
}

let policyResults: RunGameResult[];
let policy: RunSummary;
let trivial: RunSummary;

beforeAll(() => {
  const policyConfig = configFor('policy', BATCH);
  policyResults = runRunHarness(policyConfig);
  policy = summarizeRun(policyConfig, policyResults);

  const trivialConfig = configFor('trivial', BATCH);
  trivial = summarizeRun(trivialConfig, runRunHarness(trivialConfig));
}, HEAVY_TIMEOUT_MS);

describe('full-run sim — policy fixed-seed regression (24 runs, seed 42)', () => {
  it('posts the recorded outcome counts (victories / defeats / wedges)', () => {
    expect(policy.victories).toBe(10);
    expect(policy.defeats).toBe(14);
    expect(policy.wedges).toBe(0);
    expect(policy.victories + policy.defeats + policy.wedges).toBe(BATCH);
    expect(policy.bossReachedCount).toBe(13);
  });

  it('posts the recorded completed-run encounter and move bands', () => {
    expect(policy.encMinCompleted).toBe(10);
    expect(policy.encMedianCompleted).toBe(11);
    expect(policy.encMaxCompleted).toBe(11);
    expect(policy.movesMinCompleted).toBe(43);
    expect(policy.movesMedianCompleted).toBe(53.5);
    expect(policy.movesMaxCompleted).toBe(70);
  });

  it('posts the recorded aggregate totals (drift guards)', () => {
    const totalMoves = policyResults.reduce((a, r) => a + r.moves, 0);
    const totalRelics = policyResults.reduce((a, r) => a + r.relics, 0);
    const totalEncounters = policyResults.reduce((a, r) => a + r.encounters, 0);
    expect(totalMoves).toBe(1003);
    expect(totalRelics).toBe(173);
    expect(totalEncounters).toBe(183);
  });

  it('posts the recorded death-by-cause breakdown', () => {
    expect(policy.deathsByCause).toEqual([
      { cause: 'fight:skeleton', count: 6 },
      { cause: 'elite:skeleton', count: 4 },
      { cause: 'boss', count: 3 },
      { cause: 'fight:slime', count: 1 },
    ]);
    // The cause counts sum to the defeats total (every defeat is attributed).
    const sum = policy.deathsByCause.reduce((a, b) => a + b.count, 0);
    expect(sum).toBe(policy.defeats);
  });
});

describe('full-run sim — stage gates in miniature (seed 42)', () => {
  it('every run terminates (zero wedges — no crashes / infinite loops)', () => {
    expect(policy.wedges).toBe(0);
    expect(trivial.wedges).toBe(0);
    for (const r of policyResults) {
      expect(r.outcome === 'victory' || r.outcome === 'defeat').toBe(true);
    }
  });

  it('policy win rate lands in the 25–75% band', () => {
    expect(policy.winRatePct).toBeGreaterThanOrEqual(25);
    expect(policy.winRatePct).toBeLessThanOrEqual(75);
  });

  it('encounters per completed run land in the 8–12 band', () => {
    expect(policy.encMinCompleted).toBeGreaterThanOrEqual(8);
    expect(policy.encMaxCompleted).toBeLessThanOrEqual(12);
    expect(policy.encMedianCompleted).toBeGreaterThanOrEqual(8);
    expect(policy.encMedianCompleted).toBeLessThanOrEqual(12);
  });

  it('median total moves per completed run land in the 30–90 band', () => {
    expect(policy.movesMedianCompleted).toBeGreaterThanOrEqual(30);
    expect(policy.movesMedianCompleted).toBeLessThanOrEqual(90);
  });
});

describe('full-run sim — trivial control (skill floor)', () => {
  it('the trivial bot is shut out on this batch (all die to the floor-0 intro slime)', () => {
    expect(trivial.victories).toBe(0);
    expect(trivial.defeats).toBe(BATCH);
    expect(trivial.wedges).toBe(0);
    expect(trivial.bossReachedCount).toBe(0);
    expect(trivial.deathsByCause).toEqual([{ cause: 'fight:slime', count: 24 }]);
  });

  it('policy win rate is strictly above the trivial control (skill-floor sanity)', () => {
    expect(policy.winRatePct).toBeGreaterThan(trivial.winRatePct);
  });
});

describe('full-run sim — aggregation edge cases (synthetic data, no engine drive)', () => {
  // Hand-built RunGameResults exercise summarizeRun / formatRunReport branches directly
  // (the empty / all-victory / wedged fallbacks a real seed batch rarely hits), fast.
  function result(over: Partial<RunGameResult>): RunGameResult {
    return {
      seed: 0,
      outcome: 'victory',
      encounters: 10,
      moves: 50,
      gold: 100,
      relics: 5,
      bossReached: true,
      floorReached: 12,
      steps: 60,
      death: null,
      ...over,
    };
  }

  it('summarizes an empty batch without dividing by zero', () => {
    const config = configFor('policy', 0);
    const s = summarizeRun(config, []);
    expect(s.winRatePct).toBe(0);
    expect(s.bossReachedPct).toBe(0);
    expect(s.movesMedianCompleted).toBe(0);
    expect(s.deathsByCause).toEqual([]);
    expect(s.deathsByFloor).toEqual([]);
    const report = formatRunReport(s);
    expect(report).toContain('(no deaths)');
    expect(report).toContain('(no runs)');
  });

  it('counts a wedged outcome without attributing a death', () => {
    const config = configFor('policy', 2);
    const s = summarizeRun(config, [
      result({ outcome: 'wedged', bossReached: false, death: null }),
      result({ outcome: 'victory' }),
    ]);
    expect(s.wedges).toBe(1);
    expect(s.victories).toBe(1);
    expect(s.deathsByCause).toEqual([]); // wedge is not a death
  });

  it('orders deaths by count desc then cause asc, and floors contiguously from 0', () => {
    const config = configFor('policy', 4);
    const s = summarizeRun(config, [
      result({ outcome: 'defeat', death: { cause: 'fight:bat', encounterKind: 'fight', floor: 3 } }),
      result({ outcome: 'defeat', death: { cause: 'boss', encounterKind: 'boss', floor: 12 } }),
      result({ outcome: 'defeat', death: { cause: 'boss', encounterKind: 'boss', floor: 12 } }),
      result({ outcome: 'defeat', death: { cause: 'aaa:early', encounterKind: 'fight', floor: 1 } }),
    ]);
    expect(s.deathsByCause[0]).toEqual({ cause: 'boss', count: 2 }); // count desc
    expect(s.deathsByCause[1]).toEqual({ cause: 'aaa:early', count: 1 }); // tie → cause asc
    expect(s.deathsByCause[2]).toEqual({ cause: 'fight:bat', count: 1 });
    expect(s.deathsByFloor).toHaveLength(13); // contiguous 0..12
    expect(s.deathsByFloor[0]).toEqual({ floor: 0, count: 0 });
    expect(s.deathsByFloor[12]).toEqual({ floor: 12, count: 2 });
    const report = formatRunReport(s);
    expect(report).toContain('boss');
    expect(report).toContain('floor 12:');
  });
});

describe('full-run sim — determinism', () => {
  it('produces byte-identical reports across two harness runs (policy)', () => {
    const config = configFor('policy', 6);
    const a = formatRunReport(summarizeRun(config, runRunHarness(config)));
    const b = formatRunReport(summarizeRun(config, runRunHarness(config)));
    expect(b).toBe(a);
  }, HEAVY_TIMEOUT_MS);

  it('the report is well-formed and echoes the gate sections', () => {
    const report = formatRunReport(policy);
    expect(report.endsWith('\n')).toBe(true);
    expect(report).toContain('Full-Run Sim Report');
    expect(report).toContain('Win rate:');
    expect(report).toContain('Encounters/run:');
    expect(report).toContain('Deaths by cause:');
    expect(report).toContain('Deaths by floor:');
  });
});
