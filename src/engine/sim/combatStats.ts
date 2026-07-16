/**
 * Combat aggregation + report formatting.
 *
 * Everything here is deterministic: `summarizeCombat` / `formatCombatReport` consume
 * ONLY the deterministic per-encounter data (outcomes, turn counts, per-move
 * damage/heal/combos), so the same harness config ⇒ byte-identical report string.
 * Wall-clock timing never touches this module (the CLI measures it and sends it to
 * stderr).
 *
 * The three balance-band numbers the report surfaces prominently:
 *   - win rate %  (greedy-combat ≥ 80, random ≤ 40),
 *   - median turns-to-win over WINS only (4–12),
 *   - avg damage per move.
 */
import { getEnemy } from '../combat';
import type { HistogramBin } from './stats';
import type { CombatGameResult, CombatHarnessConfig } from './combatTypes';

/** Deterministic summary of a combat-harness run — stable per config. */
export interface CombatSummary {
  readonly config: CombatHarnessConfig;
  readonly enemyMaxHp: number;
  readonly wins: number;
  readonly losses: number;
  readonly timeouts: number;
  /** wins / games × 100. */
  readonly winRatePct: number;
  readonly totalMoves: number;
  readonly totalDamage: number;
  readonly totalHeal: number;
  readonly avgDamagePerMove: number;
  readonly avgHealPerMove: number;
  /** Median turns among WINNING encounters (0 when there are no wins). */
  readonly medianTurnsToWin: number;
  readonly minTurnsToWin: number;
  readonly maxTurnsToWin: number;
  /** Turns-to-win histogram over wins only, contiguous from min to max observed. */
  readonly turnsToWinBins: readonly HistogramBin[];
}

/** Median of an already-ascending list; even count ⇒ mean of the two middle values. */
function medianSorted(sorted: readonly number[]): number {
  const n = sorted.length;
  if (n === 0) {
    return 0;
  }
  const mid = n >> 1;
  return n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Build a contiguous histogram over [min, max] of the given integer values. */
function buildRangeBins(values: readonly number[]): HistogramBin[] {
  if (values.length === 0) {
    return [];
  }
  let min = values[0];
  let max = values[0];
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const counts = new Map<number, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const bins: HistogramBin[] = [];
  for (let value = min; value <= max; value++) {
    bins.push({ value, count: counts.get(value) ?? 0 });
  }
  return bins;
}

/** Aggregate raw encounter results into a deterministic summary. */
export function summarizeCombat(
  config: CombatHarnessConfig,
  results: readonly CombatGameResult[],
): CombatSummary {
  let wins = 0;
  let losses = 0;
  let timeouts = 0;
  let totalMoves = 0;
  let totalDamage = 0;
  let totalHeal = 0;
  const winTurns: number[] = [];

  for (const game of results) {
    if (game.outcome === 'won') {
      wins++;
      winTurns.push(game.turns);
    } else if (game.outcome === 'lost') {
      losses++;
    } else {
      timeouts++;
    }
    for (const move of game.moves) {
      totalMoves++;
      totalDamage += move.damage;
      totalHeal += move.heal;
    }
  }

  winTurns.sort((a, b) => a - b);
  const games = config.games;

  return {
    config,
    enemyMaxHp: getEnemy(config.enemy).maxHp,
    wins,
    losses,
    timeouts,
    winRatePct: games === 0 ? 0 : (wins / games) * 100,
    totalMoves,
    totalDamage,
    totalHeal,
    avgDamagePerMove: totalMoves === 0 ? 0 : totalDamage / totalMoves,
    avgHealPerMove: totalMoves === 0 ? 0 : totalHeal / totalMoves,
    medianTurnsToWin: medianSorted(winTurns),
    minTurnsToWin: winTurns.length === 0 ? 0 : winTurns[0],
    maxTurnsToWin: winTurns.length === 0 ? 0 : winTurns[winTurns.length - 1],
    turnsToWinBins: buildRangeBins(winTurns),
  };
}

// ---- Formatting (deterministic; stdout) ----

const AVG_PRECISION = 4;
const PCT_PRECISION = 1;
const MEDIAN_PRECISION = 1;

function pct(count: number, total: number): string {
  const value = total === 0 ? 0 : (count / total) * 100;
  return value.toFixed(PCT_PRECISION);
}

function botConfigEcho(summary: CombatSummary): string {
  if (summary.config.bot === 'random') {
    return `pathLen ~ Uniform[${summary.config.botConfig.randomMinSteps}, ${summary.config.botConfig.randomMaxSteps}]`;
  }
  return `exhaustive search depth = ${summary.config.botConfig.greedyMaxDepth}`;
}

/** Render the deterministic combat report (goes to stdout). Ends with a trailing newline. */
export function formatCombatReport(summary: CombatSummary): string {
  const c = summary.config;
  const winBins = summary.turnsToWinBins;
  const maxValueWidth =
    winBins.length === 0 ? 1 : String(winBins[winBins.length - 1].value).length;
  const maxCount = winBins.reduce((m, b) => Math.max(m, b.count), 0);
  const countWidth = String(maxCount).length;

  const histogramLines =
    winBins.length === 0
      ? ['  (no wins)']
      : winBins.map((bin) => {
          const value = String(bin.value).padStart(maxValueWidth, ' ');
          const count = String(bin.count).padStart(countWidth, ' ');
          return `  ${value} turns: ${count} wins (${pct(bin.count, summary.wins)}%)`;
        });

  const lines: string[] = [
    'Dungeon Cascades — Combat Sim Report',
    '====================================',
    `Enemy:            ${c.enemy} (HP ${summary.enemyMaxHp})`,
    `Bot:              ${c.bot}`,
    `Bot config:       ${botConfigEcho(summary)}`,
    `Base seed:        ${c.baseSeed}`,
    `Games:            ${c.games}`,
    '------------------------------------',
    `Wins:             ${summary.wins} (${pct(summary.wins, c.games)}%)`,
    `Losses:           ${summary.losses} (${pct(summary.losses, c.games)}%)`,
    `Timeouts:         ${summary.timeouts} (${pct(summary.timeouts, c.games)}%)`,
    `Win rate:         ${summary.winRatePct.toFixed(PCT_PRECISION)}%`,
    `Total moves:      ${summary.totalMoves}`,
    `Avg damage/move:  ${summary.avgDamagePerMove.toFixed(AVG_PRECISION)}`,
    `Avg heal/move:    ${summary.avgHealPerMove.toFixed(AVG_PRECISION)}`,
    `Median turns-win: ${summary.medianTurnsToWin.toFixed(MEDIAN_PRECISION)}`,
    `Turns-win range:  ${summary.minTurnsToWin}–${summary.maxTurnsToWin}`,
    '',
    'Turns-to-win distribution (wins only):',
    ...histogramLines,
  ];
  return lines.join('\n') + '\n';
}
