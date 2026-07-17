/**
 * Balance-report tests (Stage 4): the full-matrix report is deterministic, well-formed, and its
 * purity verdicts follow the ±5pp rule. A small fixed-seed batch keeps the test fast; the exact
 * pinned report string (drift guard) lives in the `balanceReportPin` describe at the bottom and is
 * recorded from a real run once the variants are tuned (see the Verification Log).
 */
import { runBalanceReport, formatBalanceReport, PURITY_BAND_PP } from './index';
import type { BalanceReport, BalanceReportConfig, BalanceRow } from './index';
import type { RunSummary } from './index';
import { RELIC_IDS, VARIANT_IDS } from '../run';
import { DEFAULT_RUN_STEP_CAP } from './index';

const HEAVY_TIMEOUT_MS = 120_000;

function config(games: number): BalanceReportConfig {
  return { bot: 'policy', games, baseSeed: 42, stepCap: DEFAULT_RUN_STEP_CAP };
}

let report: BalanceReport;

beforeAll(() => {
  report = runBalanceReport(config(8));
}, HEAVY_TIMEOUT_MS);

describe('balance report — structure', () => {
  it('runs vanilla + every variant, vanilla first as the baseline', () => {
    expect(report.rows).toHaveLength(1 + VARIANT_IDS.length);
    expect(report.rows[0].variantId).toBeNull();
    expect(report.rows[0].label).toBe('vanilla');
    expect(report.rows[0].deltaVsVanillaPp).toBe(0);
    expect(report.rows[0].withinBand).toBe(true);
    for (let i = 0; i < VARIANT_IDS.length; i++) {
      expect(report.rows[i + 1].variantId).toBe(VARIANT_IDS[i]);
    }
  });

  it('exposes the purity band and a relic-correlation row per roster relic', () => {
    expect(report.bandPp).toBe(PURITY_BAND_PP);
    expect(report.relicCorrelation).toHaveLength(RELIC_IDS.length);
    expect(report.relicCorrelation.map((r) => r.relicId)).toEqual([...RELIC_IDS]);
  });

  it('the formatted report contains every required section', () => {
    const text = formatBalanceReport(report);
    expect(text).toContain('Balance Report (full matrix)');
    expect(text).toContain('Purity gate (win rate vs vanilla, ±5pp band):');
    expect(text).toContain('Biome fairness gate (vanilla Act-2 win% by biome, ≤10.0pp spread):');
    expect(text).toContain('Fairness verdict:');
    expect(text).toContain('Per-config stats');
    expect(text).toContain('Vanilla deaths by cause:');
    expect(text).toContain('Vanilla deaths by floor:');
    expect(text).toContain('Vanilla moves-per-run distribution');
    expect(text).toContain('Relic draft→win correlation');
    expect(text.endsWith('\n')).toBe(true);
  });
});

describe('balance report — purity verdict follows the ±5pp rule', () => {
  it('withinBand is exactly |delta| ≤ 5pp for every row', () => {
    for (const row of report.rows) {
      expect(row.withinBand).toBe(Math.abs(row.deltaVsVanillaPp) <= PURITY_BAND_PP);
    }
  });

  it('every variant delta is measured against the SAME vanilla reference', () => {
    for (const row of report.rows) {
      if (row.variantId === null) continue;
      expect(row.deltaVsVanillaPp).toBeCloseTo(row.winRatePct - report.vanillaWinRatePct, 6);
    }
  });
});

describe('balance report — determinism (byte-identical stdout)', () => {
  it('same config twice ⇒ identical formatted report', () => {
    const a = formatBalanceReport(runBalanceReport(config(6)));
    const b = formatBalanceReport(runBalanceReport(config(6)));
    expect(b).toBe(a);
  }, HEAVY_TIMEOUT_MS);
});

describe('balance report — fixed-seed pin (drift guard; games 8, seed 42)', () => {
  // RE-RECORDED by the STAGE-6 BALANCE-TUNING wave from a real `--mode report --games 8 --seed 42`
  // AFTER the affinity-aware policy bot + the eased Act-2 constants + the role recalibration. The win
  // rate is now band-centered (vanilla 37.5% at N=8). At N=8 one flipped run moves a rate by 12.5pp,
  // so PASS/FAIL HERE is sampling NOISE, NOT the balance signal — the real ±5pp purity gate (spec §9)
  // is measured over 1000+ runs (see the balance-tuning wave's report: all six roles in band there).
  // This pin only locks the current output so ANY drift in the engine, policy, a variant number, or
  // the formatting fails `npm test` loudly. If an authorized change moves these values, re-record and
  // log why (never fake them).
  it('reproduces the recorded report lines byte-for-byte', () => {
    const text = formatBalanceReport(report);
    expect(text).toContain('Vanilla win rate: 37.5%');
    expect(text).toContain('  vanilla             37.5       —  —    (baseline)');
    expect(text).toContain('  cartographer        37.5    +0.0  PASS');
    expect(text).toContain('  ember-start         50.0   +12.5  FAIL');
    expect(text).toContain('  merchants-purse     50.0   +12.5  FAIL');
    expect(text).toContain('  vitality-pact       50.0   +12.5  FAIL');
    expect(text).toContain('  ironhide            50.0   +12.5  FAIL');
    expect(text).toContain('  glass-cannon        50.0   +12.5  FAIL');
    // N=8 noise: the small batch happens to over-count variant wins (this is why the real gate is
    // 1000 runs). Stat rows re-recorded from the same run.
    expect(text).toContain('  vanilla            37.5   62.5    22.0  114.0    46.4   305.4     0.0');
    expect(text).toContain('  ironhide           50.0   75.0    21.5   91.5    60.8   446.9     0.0');
    expect(text).toContain('  boss                  2 (40.0%)');
    expect(text).toContain('  bulwark-rune              6    50.0   +12.5');
    expect(text).toContain('  misers-knuckle            4    75.0   +37.5');
    // FAIRNESS-INSTRUMENTATION PIN (2026-07-17): the vanilla Act-2 per-biome win rates at N=8. Only
    // 4 of 8 runs reached Act 2 (2 biomes played), so the 33.3pp spread is small-batch NOISE — the
    // real ≤10pp gate is measured at scale (500 games ⇒ 3.7pp; see this wave's report). Semantic
    // whitespace-tolerant pins lock the values; the verdict line is exact.
    expect(text).toMatch(/glacial-crypt\s+3\s+2\s+66\.7/);
    expect(text).toMatch(/emberworks\s+0\s+0\s+—/);
    expect(text).toMatch(/sunken-catacombs\s+1\s+1\s+100\.0/);
    expect(text).toContain('Fairness verdict: FAIL (spread 33.3pp > 10.0pp)');
  });

  it('pins the recorded win rates as raw values', () => {
    expect(report.vanillaWinRatePct).toBe(37.5);
    expect(report.rows.map((r) => r.winRatePct)).toEqual([37.5, 37.5, 50, 50, 50, 50, 50]);
  });

  it('pins the recorded vanilla per-biome fairness (counts + spread)', () => {
    const vs = report.rows[0].summary;
    // biome games + act1-deaths partition all 8 runs; biome wins sum to the 3 vanilla victories.
    expect(vs.biomeBins.map((b) => [b.biomeId, b.games, b.wins])).toEqual([
      ['glacial-crypt', 3, 2],
      ['emberworks', 0, 0],
      ['rotwood', 0, 0],
      ['sunken-catacombs', 1, 1],
    ]);
    expect(vs.act1Deaths).toBe(4);
    expect(vs.biomeBins.reduce((a, b) => a + b.games, 0) + vs.act1Deaths).toBe(8);
    expect(vs.biomeBins.reduce((a, b) => a + b.wins, 0)).toBe(vs.victories);
    // Spread over PLAYED biomes only (glacial 66.7%, sunken 100.0%) ⇒ 33.3pp (small-batch noise).
    expect(vs.biomeSpreadPp).toBeCloseTo(33.333, 3);
  });
});

describe('formatBalanceReport — synthetic edge cases (no engine drive)', () => {
  // Hand-built report to exercise the empty-section, FAIL-verdict, and negative-delta format
  // branches a healthy real batch never hits — fast.
  function summary(over: Partial<RunSummary> = {}): RunSummary {
    return {
      config: { bot: 'policy', games: 0, baseSeed: 42, stepCap: DEFAULT_RUN_STEP_CAP },
      games: 0,
      victories: 0,
      defeats: 0,
      wedges: 0,
      winRatePct: 0,
      bossReachedCount: 0,
      bossReachedPct: 0,
      completedCount: 0,
      encMinCompleted: 0,
      encMedianCompleted: 0,
      encMaxCompleted: 0,
      movesMinCompleted: 0,
      movesMedianCompleted: 0,
      movesMaxCompleted: 0,
      movesMeanCompleted: 0,
      goldMeanCompleted: 0,
      relicsMeanCompleted: 0,
      movesMinAll: 0,
      movesMedianAll: 0,
      movesMaxAll: 0,
      goldMeanAll: 0,
      relicsMeanAll: 0,
      movesBinsAll: [],
      biomeBins: [],
      act1Deaths: 0,
      biomeSpreadPp: 0,
      deathsByCause: [],
      deathsByFloor: [],
      ...over,
    };
  }
  function row(over: Partial<BalanceRow>): BalanceRow {
    return {
      variantId: null,
      label: 'vanilla',
      summary: summary(),
      extras: { meanScore: 0, goldEarnedMean: 0, goldSpentMean: 0 },
      winRatePct: 0,
      deltaVsVanillaPp: 0,
      withinBand: true,
      ...over,
    };
  }

  it('renders empty sections and a FAIL verdict with a negative delta', () => {
    const report: BalanceReport = {
      bot: 'policy',
      baseSeed: 42,
      games: 0,
      stepCap: DEFAULT_RUN_STEP_CAP,
      bandPp: PURITY_BAND_PP,
      vanillaWinRatePct: 40,
      rows: [
        row({}), // vanilla: empty deaths/dist → "(no deaths)" / "(no runs)"
        row({ variantId: 'weak', label: 'weak', winRatePct: 30, deltaVsVanillaPp: -10, withinBand: false }),
      ],
      relicCorrelation: [
        { relicId: 'unused-relic', picks: 0, winRateWithPct: 0, deltaVsBasePp: 0 },
        { relicId: 'emberfang', picks: 5, winRateWithPct: 20, deltaVsBasePp: -20 },
      ],
    };
    const text = formatBalanceReport(report);
    expect(text).toContain('(no deaths)');
    expect(text).toContain('(no runs)');
    expect(text).toContain('FAIL');
    expect(text).toContain('-10.0'); // negative signed delta
    expect(text).toContain('FAIL — a variant is out of band');
    // A zero-pick relic renders '—' rather than a fabricated win rate.
    expect(text).toMatch(/unused-relic\s+0\s+—\s+—/);
  });
});
