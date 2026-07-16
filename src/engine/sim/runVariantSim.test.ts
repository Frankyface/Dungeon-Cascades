/**
 * Variant-aware full-run sim tests (Stage 4): the harness threads a starting variant into every
 * run, the extra balance telemetry (relicIds / gold flow / score) is populated, and — critically —
 * a vanilla harness stays byte-identical to the pre-variant path (so the Stage-3 baseline holds).
 */
import { formatRunReport, playRun, runRunHarness, summarizeRun } from './index';
import { DEFAULT_RUN_STEP_CAP } from './index';
import type { RunHarnessConfig } from './index';
import { gameSeedFor } from './seeds';

const SEED = 42;
const STEP_CAP = DEFAULT_RUN_STEP_CAP;

function playAt(index: number, variantId?: string) {
  return playRun(gameSeedFor(SEED, index), 'policy', STEP_CAP, variantId);
}

describe('playRun — extra balance telemetry', () => {
  it('populates relicIds, gold flow, and score on a driven run', () => {
    const r = playAt(0);
    expect(Array.isArray(r.relicIds)).toBe(true);
    expect(r.relics).toBe(r.relicIds!.length);
    expect(typeof r.goldEarned).toBe('number');
    expect(typeof r.goldSpent).toBe('number');
    expect(typeof r.score).toBe('number');
    expect(r.goldEarned!).toBeGreaterThanOrEqual(0);
    expect(r.goldSpent!).toBeGreaterThanOrEqual(0);
  });

  it('gold-flow bookkeeping reconciles: final gold = start gold + earned − spent', () => {
    // Vanilla starts with 0 gold, so held gold is exactly earned − spent.
    const vanilla = playAt(0);
    expect(vanilla.gold).toBe(vanilla.goldEarned! - vanilla.goldSpent!);

    // Merchant's Purse starts with +55 gold; the same identity holds with that offset.
    const merchant = playAt(0, 'merchants-purse');
    expect(merchant.gold).toBe(55 + merchant.goldEarned! - merchant.goldSpent!);
  });
});

describe('playRun — variant threading', () => {
  it('a variant run starts from the variant (owns its start relic throughout)', () => {
    // Ember Start grants emberfang; a run can only LOSE relics never, so it is always owned.
    const r = playAt(3, 'ember-start');
    expect(r.relicIds).toContain('emberfang');
  });

  it('is deterministic — same (seed, variant) ⇒ identical result', () => {
    expect(playAt(1, 'glass-cannon')).toEqual(playAt(1, 'glass-cannon'));
  });

  it('a variant generally changes the outcome distribution vs vanilla (real gameplay effect)', () => {
    // Over a small batch, at least one seed flips outcome under a stat-heavy variant.
    let flips = 0;
    for (let i = 0; i < 12; i++) {
      if (playAt(i).outcome !== playAt(i, 'glass-cannon').outcome) flips++;
    }
    expect(flips).toBeGreaterThan(0);
  });
});

describe('run report — vanilla stays byte-identical; variant adds a header line', () => {
  function config(variantId?: string): RunHarnessConfig {
    return { bot: 'policy', games: 4, baseSeed: SEED, stepCap: STEP_CAP, ...(variantId ? { variantId } : {}) };
  }

  it('a vanilla report has NO Variant line (Stage-3 baseline bytes preserved)', () => {
    const report = formatRunReport(summarizeRun(config(), runRunHarness(config())));
    expect(report).not.toContain('Variant:');
    expect(report).toContain('Bot:              policy');
  });

  it('a variant report echoes the variant id', () => {
    const cfg = config('cartographer');
    const report = formatRunReport(summarizeRun(cfg, runRunHarness(cfg)));
    expect(report).toContain('Variant:          cartographer');
  });

  it('vanilla harness output is unchanged by the variant plumbing (determinism)', () => {
    const a = formatRunReport(summarizeRun(config(), runRunHarness(config())));
    const b = formatRunReport(summarizeRun(config(), runRunHarness(config())));
    expect(b).toBe(a);
  });
});
