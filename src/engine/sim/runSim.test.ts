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
 * STAGE-6 BALANCE-TUNE RE-RECORD: these pins were re-recorded a SECOND time by the balance-tuning
 * wave after (a) upgrading the policy bot to the affinity-aware combat scorer and (b) easing the
 * Act-2 difficulty constants to the spec §9 win-rate band. On this 24-run batch the policy now wins
 * 7/24; the FULL band verification (win rate 20–60%, act-1-boss ≥40%, 0 wedges, biome fairness) is
 * measured separately at 1000 games (see the balance-tuning wave's report). These remain RUN-DERIVED
 * regression pins (recorded actuals), and this test proves STRUCTURAL INTEGRITY + DETERMINISM: zero
 * wedges, every run terminates, both outcomes reachable, policy strictly out-wins the trivial control.
 *
 * The batch is driven ONCE in beforeAll (the greedy DFS is compute-heavy) and every assertion reads
 * the shared summary.
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

describe('full-run sim — policy fixed-seed regression (24 runs, seed 42, TWO-ACT)', () => {
  it('posts the recorded outcome counts (victories / defeats / wedges)', () => {
    // STAGE-6 BALANCE-TUNE RE-RECORD: the affinity-aware policy bot + the eased Act-2 difficulty
    // constants (spec §9 win-rate retune) lift the win rate from ~2/24 to 7/24 on this batch.
    expect(policy.victories).toBe(7);
    expect(policy.defeats).toBe(17);
    expect(policy.wedges).toBe(0);
    expect(policy.victories + policy.defeats + policy.wedges).toBe(BATCH);
    expect(policy.bossReachedCount).toBe(14); // reached the Act-1 boss in 14/24 runs
  });

  it('posts the recorded completed-run encounter and move bands (both acts)', () => {
    // A completed run spans BOTH acts (~22 encounters). STAGE-6 RE-RECORD: with the affinity bot
    // hitting weaknesses, winning runs finish combats in far fewer moves than the old color-blind
    // bot. FAIRNESS-AMENDMENT RE-RECORD (2026-07-17): the ember/rotwood enemy + Forgeheart nerfs make
    // those Act-2 fights end sooner, so the completed-MOVES FLOOR dropped 79→74 (median/max 98/123
    // unchanged — the shortest winning run is the one that traversed a nerfed biome). The Altar
    // (spec §2c) can skip one encounter, so encMin stays 21 while the median run stays at 22.
    expect(policy.encMinCompleted).toBe(21);
    expect(policy.encMedianCompleted).toBe(22);
    expect(policy.encMaxCompleted).toBe(22);
    expect(policy.movesMinCompleted).toBe(74);
    expect(policy.movesMedianCompleted).toBe(98);
    expect(policy.movesMaxCompleted).toBe(123);
  });

  it('posts the recorded aggregate totals (drift guards)', () => {
    const totalMoves = policyResults.reduce((a, r) => a + r.moves, 0);
    const totalRelics = policyResults.reduce((a, r) => a + r.relics, 0);
    const totalEncounters = policyResults.reduce((a, r) => a + r.encounters, 0);
    // STAGE-6 RE-RECORD: more runs survive deeper (more encounters entered ⇒ 262→308, more relics
    // drafted ⇒ 184→190) and total combat moves rose 1401→1510 as more runs reach Act 2.
    // FAIRNESS-AMENDMENT RE-RECORD (2026-07-17): the eased ember/rotwood Act-2 fights shift the
    // policy's HP-driven routing, so total combat moves dip 1510→1498 and encounters entered edge
    // 308→309 (relics unchanged at 190; no win/loss outcome flipped on this 24-run batch).
    expect(totalMoves).toBe(1498);
    expect(totalRelics).toBe(190);
    expect(totalEncounters).toBe(309);
  });

  it('posts the recorded death-by-cause breakdown (now includes Act-2 biome enemies)', () => {
    // STAGE-6 RE-RECORD: with more runs reaching the bosses, the boss becomes the top killer.
    expect(policy.deathsByCause).toEqual([
      { cause: 'boss', count: 6 },
      { cause: 'fight:skeleton', count: 5 },
      { cause: 'fight:slime', count: 3 },
      { cause: 'elite:skeleton', count: 2 },
      { cause: 'elite:permafrost-warden', count: 1 },
    ]);
    // The cause counts sum to the defeats total (every defeat is attributed).
    const sum = policy.deathsByCause.reduce((a, b) => a + b.count, 0);
    expect(sum).toBe(policy.defeats);
  });
});

describe('full-run sim — structural invariants (spec balance BANDS re-tune next wave)', () => {
  it('every run terminates (zero wedges — no crashes / infinite loops)', () => {
    expect(policy.wedges).toBe(0);
    expect(trivial.wedges).toBe(0);
    for (const r of policyResults) {
      expect(r.outcome === 'victory' || r.outcome === 'defeat').toBe(true);
    }
  });

  it('both outcomes are reachable across the two-act structure', () => {
    // The spec's 20–60% win-rate band is the SIM-TUNING wave's gate; here we only prove that a
    // two-act run can be BOTH won and lost by the policy bot (jeopardy + winnability both exist).
    expect(policy.victories).toBeGreaterThan(0);
    expect(policy.defeats).toBeGreaterThan(0);
    expect(policy.winRatePct).toBeGreaterThan(0);
    expect(policy.winRatePct).toBeLessThan(100);
  });

  it('a completed run spans BOTH acts (encounters + moves exceed a single act)', () => {
    // A single act tops out at ~11 encounters / ~70 moves; a completed two-act run clears that,
    // proving victory truly requires traversing both maps.
    expect(policy.encMedianCompleted).toBeGreaterThan(12);
    expect(policy.movesMedianCompleted).toBeGreaterThan(90);
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
