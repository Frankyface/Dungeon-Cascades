/**
 * Balance report at scale (Stage 4 — the project's tuning instrument).
 *
 * One deterministic command drives the FULL matrix in a single pass — vanilla + every starting
 * variant, the same policy bot over the same shared seed sequence (`gameSeedFor(baseSeed, i)` is
 * identical across configs, so a variant's win-rate delta isolates the variant's own effect) —
 * and emits the whole balance picture:
 *   • per-variant win rate with the ±5pp PURITY VERDICT (the hard gate),
 *   • a per-config stat matrix (boss-reached, completed enc/move medians, meta score, gold flow),
 *   • vanilla deaths by cause / by floor and the moves-per-run distribution,
 *   • the per-relic draft→win correlation (win% of runs that owned it vs the base rate + pick count).
 *
 * BYTE-DETERMINISTIC: `runBalanceReport` consumes only deterministic per-run telemetry, so the
 * same config ⇒ an identical `formatBalanceReport` string. Wall-clock timing never enters here (the
 * CLI measures it and sends it to stderr). Pure: no React/RN, no ambient time or randomness.
 */
import { RELIC_IDS, VARIANT_IDS } from '../run';
import { runRunHarness } from './runHarness';
import { summarizeRun } from './runStats';
import type { RunSummary } from './runStats';
import type { RunBotName, RunGameResult, RunHarnessConfig } from './runSimTypes';

/** The purity band (percentage points): a variant's win rate must be within ±this of vanilla. */
export const PURITY_BAND_PP = 5;

/**
 * The fairness band (percentage points): the vanilla Act-2 per-biome win-rate spread must be ≤ this.
 * This is the hard per-biome gate — no Act-2 biome should be materially harder or easier than another.
 */
export const BIOME_FAIRNESS_BAND_PP = 10;

/** Configuration of a balance-report run (drives vanilla + every listed variant). */
export interface BalanceReportConfig {
  readonly bot: RunBotName;
  readonly games: number;
  readonly baseSeed: number;
  readonly stepCap: number;
  /** Variants to include (default: the full shipped slate, in canonical order). */
  readonly variantIds?: readonly string[];
}

/** Extra per-config aggregates the base `RunSummary` doesn't carry. */
interface ConfigExtras {
  readonly meanScore: number;
  readonly goldEarnedMean: number;
  readonly goldSpentMean: number;
}

/** One matrix row: a config (vanilla or a variant), its summary, and its purity verdict. */
export interface BalanceRow {
  /** null = vanilla; otherwise the variant id. */
  readonly variantId: string | null;
  readonly label: string;
  readonly summary: RunSummary;
  readonly extras: ConfigExtras;
  readonly winRatePct: number;
  /** Win-rate delta vs vanilla in percentage points (0 for the vanilla row). */
  readonly deltaVsVanillaPp: number;
  /** PASS iff |delta| ≤ PURITY_BAND_PP (always PASS for vanilla). */
  readonly withinBand: boolean;
}

/** One relic's draft→win correlation (computed over the vanilla runs). */
export interface RelicCorrelationRow {
  readonly relicId: string;
  /** Runs (of the config) that ended OWNING this relic (drafted or bought). */
  readonly picks: number;
  /** Win rate (%) among the runs that owned it. */
  readonly winRateWithPct: number;
  /** winRateWith − base win rate, in percentage points. */
  readonly deltaVsBasePp: number;
}

/** The full deterministic report data. */
export interface BalanceReport {
  readonly bot: RunBotName;
  readonly baseSeed: number;
  readonly games: number;
  readonly stepCap: number;
  readonly bandPp: number;
  readonly vanillaWinRatePct: number;
  readonly rows: readonly BalanceRow[];
  readonly relicCorrelation: readonly RelicCorrelationRow[];
}

function mean(total: number, count: number): number {
  return count === 0 ? 0 : total / count;
}

/** Aggregate the score / gold-flow means a base RunSummary doesn't include. */
function configExtras(results: readonly RunGameResult[]): ConfigExtras {
  let scoreTotal = 0;
  let earnedTotal = 0;
  let spentTotal = 0;
  for (const r of results) {
    scoreTotal += r.score ?? 0;
    earnedTotal += r.goldEarned ?? 0;
    spentTotal += r.goldSpent ?? 0;
  }
  const n = results.length;
  return {
    meanScore: mean(scoreTotal, n),
    goldEarnedMean: mean(earnedTotal, n),
    goldSpentMean: mean(spentTotal, n),
  };
}

/**
 * Per-relic draft→win correlation over a set of runs: for each roster relic, the count of runs
 * that owned it at the end and the win rate among them, versus the base win rate. Low-pick relics
 * are inherently noisy — the pick count is reported so a reader can weigh the signal.
 */
function relicCorrelation(results: readonly RunGameResult[], baseWinRatePct: number): RelicCorrelationRow[] {
  const rows: RelicCorrelationRow[] = [];
  for (const relicId of RELIC_IDS) {
    let picks = 0;
    let wins = 0;
    for (const r of results) {
      if ((r.relicIds ?? []).includes(relicId)) {
        picks++;
        if (r.outcome === 'victory') wins++;
      }
    }
    const winRateWithPct = picks === 0 ? 0 : (wins / picks) * 100;
    rows.push({
      relicId,
      picks,
      winRateWithPct,
      deltaVsBasePp: picks === 0 ? 0 : winRateWithPct - baseWinRatePct,
    });
  }
  return rows;
}

/** Drive one config (vanilla when `variantId` is null) and build its matrix row. */
function buildRow(
  base: BalanceReportConfig,
  variantId: string | null,
  vanillaWinRatePct: number | null,
): { row: BalanceRow; results: RunGameResult[] } {
  const harnessConfig: RunHarnessConfig = {
    bot: base.bot,
    games: base.games,
    baseSeed: base.baseSeed,
    stepCap: base.stepCap,
    ...(variantId !== null ? { variantId } : {}),
  };
  const results = runRunHarness(harnessConfig);
  const summary = summarizeRun(harnessConfig, results);
  const winRatePct = summary.winRatePct;
  const baseWin = vanillaWinRatePct ?? winRatePct; // vanilla row compares to itself (Δ 0)
  const deltaVsVanillaPp = winRatePct - baseWin;
  return {
    row: {
      variantId,
      label: variantId ?? 'vanilla',
      summary,
      extras: configExtras(results),
      winRatePct,
      deltaVsVanillaPp,
      withinBand: Math.abs(deltaVsVanillaPp) <= PURITY_BAND_PP,
    },
    results,
  };
}

/**
 * Run the full balance matrix: vanilla first (its win rate is the purity reference), then each
 * variant over the identical seed sequence. Relic correlation is computed over the vanilla runs
 * (the base game's draft signal). Deterministic — a pure function of the config.
 */
export function runBalanceReport(config: BalanceReportConfig): BalanceReport {
  const variantIds = config.variantIds ?? VARIANT_IDS;

  const vanilla = buildRow(config, null, null);
  const vanillaWinRatePct = vanilla.row.winRatePct;

  const rows: BalanceRow[] = [vanilla.row];
  for (const id of variantIds) {
    rows.push(buildRow(config, id, vanillaWinRatePct).row);
  }

  return {
    bot: config.bot,
    baseSeed: config.baseSeed,
    games: config.games,
    stepCap: config.stepCap,
    bandPp: PURITY_BAND_PP,
    vanillaWinRatePct,
    rows,
    relicCorrelation: relicCorrelation(vanilla.results, vanillaWinRatePct),
  };
}

// ---- Formatting (deterministic; stdout) ----

function padEndTo(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function padStartTo(s: string, n: number): string {
  return s.length >= n ? s : ' '.repeat(n - s.length) + s;
}

function fixed(value: number, dp: number): string {
  return value.toFixed(dp);
}

/** Signed percentage-point string, e.g. `+3.2` / `-4.1` / `+0.0`. */
function signedPp(value: number): string {
  return `${value >= 0 ? '+' : '-'}${Math.abs(value).toFixed(1)}`;
}

/** Render the deterministic balance report (goes to stdout). Ends with a trailing newline. */
export function formatBalanceReport(report: BalanceReport): string {
  const lines: string[] = [];
  const overallPass = report.rows.every((r) => r.withinBand);
  const vanillaRow = report.rows[0];
  const vs = vanillaRow.summary;

  lines.push('Dungeon Cascades — Balance Report (full matrix)');
  lines.push('===============================================');
  lines.push(`Bot:              ${report.bot}`);
  lines.push(`Base seed:        ${report.baseSeed}`);
  lines.push(`Games/config:     ${report.games}`);
  lines.push(`Step cap:         ${report.stepCap}`);
  lines.push(`Purity band:      ±${report.bandPp.toFixed(1)}pp of vanilla`);
  lines.push(`Vanilla win rate: ${fixed(report.vanillaWinRatePct, 1)}%`);
  lines.push('');

  // ── Purity verdict table ──
  lines.push('Purity gate (win rate vs vanilla, ±5pp band):');
  lines.push(`  ${padEndTo('config', 16)} ${padStartTo('win%', 7)}  ${padStartTo('Δpp', 6)}  verdict`);
  for (const r of report.rows) {
    const verdict = r.variantId === null ? '—    (baseline)' : r.withinBand ? 'PASS' : 'FAIL';
    lines.push(
      `  ${padEndTo(r.label, 16)} ${padStartTo(fixed(r.winRatePct, 1), 7)}  ${padStartTo(
        r.variantId === null ? '—' : signedPp(r.deltaVsVanillaPp),
        6,
      )}  ${verdict}`,
    );
  }
  lines.push('');
  lines.push(`Purity verdict:   ${overallPass ? 'ALL PASS' : 'FAIL — a variant is out of band'}`);
  lines.push('');

  // ── Act-2 biome fairness gate (vanilla per-biome win rates; the ≤10pp spread gate) ──
  const fairnessPass = vs.biomeSpreadPp <= BIOME_FAIRNESS_BAND_PP;
  lines.push(`Biome fairness gate (vanilla Act-2 win% by biome, ≤${fixed(BIOME_FAIRNESS_BAND_PP, 1)}pp spread):`);
  lines.push(`  ${padEndTo('biome', 16)} ${padStartTo('n', 5)} ${padStartTo('wins', 5)}  ${padStartTo('win%', 6)}`);
  for (const b of vs.biomeBins) {
    lines.push(
      `  ${padEndTo(b.biomeId, 16)} ${padStartTo(String(b.games), 5)} ${padStartTo(String(b.wins), 5)}  ${padStartTo(
        b.games === 0 ? '—' : fixed(b.winRatePct, 1),
        6,
      )}`,
    );
  }
  lines.push(`  ${padEndTo('act1-deaths', 16)} ${padStartTo(String(vs.act1Deaths), 5)}`);
  lines.push(`  Max spread:       ${fixed(vs.biomeSpreadPp, 1)}pp`);
  lines.push(`Fairness verdict: ${fairnessPass ? 'PASS' : 'FAIL'} (spread ${fixed(vs.biomeSpreadPp, 1)}pp ${fairnessPass ? '≤' : '>'} ${fixed(BIOME_FAIRNESS_BAND_PP, 1)}pp)`);
  lines.push('');

  // ── Per-config stat matrix ──
  lines.push('Per-config stats (completed = victory runs):');
  lines.push(
    `  ${padEndTo('config', 16)} ${padStartTo('win%', 6)} ${padStartTo('boss%', 6)} ${padStartTo(
      'encMed',
      7,
    )} ${padStartTo('mvMed', 6)} ${padStartTo('score', 7)} ${padStartTo('gEarn', 7)} ${padStartTo('gSpend', 7)}`,
  );
  for (const r of report.rows) {
    const s = r.summary;
    lines.push(
      `  ${padEndTo(r.label, 16)} ${padStartTo(fixed(r.winRatePct, 1), 6)} ${padStartTo(
        fixed(s.bossReachedPct, 1),
        6,
      )} ${padStartTo(fixed(s.encMedianCompleted, 1), 7)} ${padStartTo(
        fixed(s.movesMedianCompleted, 1),
        6,
      )} ${padStartTo(fixed(r.extras.meanScore, 1), 7)} ${padStartTo(
        fixed(r.extras.goldEarnedMean, 1),
        7,
      )} ${padStartTo(fixed(r.extras.goldSpentMean, 1), 7)}`,
    );
  }
  lines.push('');

  // ── Vanilla deaths by cause ──
  lines.push('Vanilla deaths by cause:');
  if (vs.deathsByCause.length === 0) {
    lines.push('  (no deaths)');
  } else {
    for (const b of vs.deathsByCause) {
      const pctStr = vs.defeats === 0 ? '0.0' : ((b.count / vs.defeats) * 100).toFixed(1);
      lines.push(`  ${padEndTo(b.cause, 16)} ${padStartTo(String(b.count), 6)} (${pctStr}%)`);
    }
  }
  lines.push('');

  // ── Vanilla deaths by floor ──
  lines.push('Vanilla deaths by floor:');
  if (vs.deathsByFloor.length === 0) {
    lines.push('  (no deaths)');
  } else {
    for (const b of vs.deathsByFloor) {
      const pctStr = vs.defeats === 0 ? '0.0' : ((b.count / vs.defeats) * 100).toFixed(1);
      lines.push(`  floor ${padStartTo(String(b.floor), 2)}: ${padStartTo(String(b.count), 5)} (${pctStr}%)`);
    }
  }
  lines.push('');

  // ── Vanilla moves-per-run distribution ──
  lines.push('Vanilla moves-per-run distribution (all runs):');
  if (vs.movesBinsAll.length === 0) {
    lines.push('  (no runs)');
  } else {
    for (const b of vs.movesBinsAll) {
      const pctStr = report.games === 0 ? '0.0' : ((b.count / report.games) * 100).toFixed(1);
      const range = `${padStartTo(String(b.lo), 3)}-${padStartTo(String(b.hi), 3)}`;
      lines.push(`  ${range} moves: ${padStartTo(String(b.count), 5)} (${pctStr}%)`);
    }
  }
  lines.push('');

  // ── Relic draft→win correlation (vanilla) ──
  lines.push('Relic draft→win correlation (vanilla; base = vanilla win rate):');
  lines.push(`  ${padEndTo('relic', 20)} ${padStartTo('picks', 6)} ${padStartTo('win%', 7)} ${padStartTo('Δpp', 7)}`);
  for (const rc of report.relicCorrelation) {
    const winStr = rc.picks === 0 ? '—' : fixed(rc.winRateWithPct, 1);
    const deltaStr = rc.picks === 0 ? '—' : signedPp(rc.deltaVsBasePp);
    lines.push(
      `  ${padEndTo(rc.relicId, 20)} ${padStartTo(String(rc.picks), 6)} ${padStartTo(winStr, 7)} ${padStartTo(
        deltaStr,
        7,
      )}`,
    );
  }

  return lines.join('\n') + '\n';
}
