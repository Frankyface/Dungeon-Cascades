/**
 * Aggregation + report formatting.
 *
 * Two strict boundaries keep the CLI's stdout byte-deterministic:
 *   - `summarize` / `formatReport` use ONLY deterministic per-move data (combos,
 *     cascade depth). Same harness config ⇒ identical report string, always.
 *   - `summarizeTiming` / `formatTiming` handle the nondeterministic wall-time and
 *     are the ONLY thing the CLI sends to stderr. Timing never touches stdout.
 */
import type { BotConfig, BotName, GameResult, HarnessConfig } from './types';

/** One histogram bar: how many moves had exactly `value` (combos, or waves). */
export interface HistogramBin {
  readonly value: number;
  readonly count: number;
}

/** Deterministic summary of a harness run — everything on this object is stable per config. */
export interface SimSummary {
  readonly bot: BotName;
  readonly games: number;
  readonly moves: number;
  readonly baseSeed: number;
  readonly botConfig: BotConfig;
  readonly totalMoves: number;
  readonly totalCombos: number;
  readonly avgCombosPerMove: number;
  /** Combos-per-move histogram, contiguous from 0 to the max observed. */
  readonly comboBins: readonly HistogramBin[];
  /** Cascade-depth (waves) histogram, contiguous from 0 to the max observed. */
  readonly cascadeDepthBins: readonly HistogramBin[];
}

function buildBins(counts: number[]): HistogramBin[] {
  const bins: HistogramBin[] = [];
  for (let value = 0; value < counts.length; value++) {
    bins.push({ value, count: counts[value] ?? 0 });
  }
  return bins;
}

/** Aggregate raw game results into a deterministic summary. */
export function summarize(config: HarnessConfig, results: readonly GameResult[]): SimSummary {
  const comboCounts: number[] = [];
  const depthCounts: number[] = [];
  let totalMoves = 0;
  let totalCombos = 0;

  for (const game of results) {
    for (const move of game.moves) {
      totalMoves++;
      totalCombos += move.combos;
      comboCounts[move.combos] = (comboCounts[move.combos] ?? 0) + 1;
      depthCounts[move.cascadeDepth] = (depthCounts[move.cascadeDepth] ?? 0) + 1;
    }
  }

  return {
    bot: config.bot,
    games: config.games,
    moves: config.moves,
    baseSeed: config.baseSeed,
    botConfig: config.botConfig,
    totalMoves,
    totalCombos,
    avgCombosPerMove: totalMoves === 0 ? 0 : totalCombos / totalMoves,
    comboBins: buildBins(comboCounts),
    cascadeDepthBins: buildBins(depthCounts),
  };
}

// ---- Formatting (deterministic; stdout) ----

const AVG_PRECISION = 4;
const PCT_PRECISION = 1;

function pct(count: number, total: number): string {
  const value = total === 0 ? 0 : (count / total) * 100;
  return value.toFixed(PCT_PRECISION);
}

function botConfigEcho(summary: SimSummary): string {
  if (summary.bot === 'random') {
    return `pathLen ~ Uniform[${summary.botConfig.randomMinSteps}, ${summary.botConfig.randomMaxSteps}]`;
  }
  return `exhaustive search depth = ${summary.botConfig.greedyMaxDepth}`;
}

function formatHistogram(
  label: string,
  unit: string,
  bins: readonly HistogramBin[],
  total: number,
): string[] {
  const lines: string[] = [label];
  const maxValueWidth = bins.length === 0 ? 1 : String(bins[bins.length - 1].value).length;
  const maxCount = bins.reduce((m, b) => Math.max(m, b.count), 0);
  const countWidth = String(maxCount).length;
  for (const bin of bins) {
    const value = String(bin.value).padStart(maxValueWidth, ' ');
    const count = String(bin.count).padStart(countWidth, ' ');
    lines.push(`  ${value} ${unit}: ${count} moves (${pct(bin.count, total)}%)`);
  }
  return lines;
}

/** Render the deterministic stats report (goes to stdout). Ends with a trailing newline. */
export function formatReport(summary: SimSummary): string {
  const lines: string[] = [
    'Dungeon Cascades — Sim Report',
    '=============================',
    `Bot:              ${summary.bot}`,
    `Bot config:       ${botConfigEcho(summary)}`,
    `Base seed:        ${summary.baseSeed}`,
    `Games:            ${summary.games}`,
    `Moves per game:   ${summary.moves}`,
    '-----------------------------',
    `Total games:      ${summary.games}`,
    `Total moves:      ${summary.totalMoves}`,
    `Total combos:     ${summary.totalCombos}`,
    `Avg combos/move:  ${summary.avgCombosPerMove.toFixed(AVG_PRECISION)}`,
    '',
    ...formatHistogram('Combos-per-move distribution:', 'combos', summary.comboBins, summary.totalMoves),
    '',
    ...formatHistogram('Cascade-depth (waves) histogram:', 'waves ', summary.cascadeDepthBins, summary.totalMoves),
  ];
  return lines.join('\n') + '\n';
}

// ---- Timing (NONDETERMINISTIC; stderr only) ----

export interface TimingSummary {
  readonly games: number;
  readonly totalMoves: number;
  readonly totalTimeMs: number;
  readonly avgMoveTimeMs: number;
  readonly avgGameTimeMs: number;
  readonly maxMoveTimeMs: number;
}

export function summarizeTiming(results: readonly GameResult[]): TimingSummary {
  let totalMoves = 0;
  let totalTimeMs = 0;
  let maxMoveTimeMs = 0;
  for (const game of results) {
    for (const move of game.moves) {
      totalMoves++;
      totalTimeMs += move.timeMs;
      if (move.timeMs > maxMoveTimeMs) {
        maxMoveTimeMs = move.timeMs;
      }
    }
  }
  const games = results.length;
  return {
    games,
    totalMoves,
    totalTimeMs,
    avgMoveTimeMs: totalMoves === 0 ? 0 : totalTimeMs / totalMoves,
    avgGameTimeMs: games === 0 ? 0 : totalTimeMs / games,
    maxMoveTimeMs,
  };
}

/** Render the timing report (goes to stderr; never affects stdout determinism). */
export function formatTiming(t: TimingSummary, detailed: boolean): string {
  const lines: string[] = [
    `[timing] total resolution: ${t.totalTimeMs.toFixed(1)} ms over ${t.totalMoves} moves`,
    `[timing] avg/move: ${t.avgMoveTimeMs.toFixed(4)} ms · avg/game: ${t.avgGameTimeMs.toFixed(2)} ms`,
  ];
  if (detailed) {
    lines.push(`[timing] slowest single move: ${t.maxMoveTimeMs.toFixed(4)} ms`);
  }
  return lines.join('\n') + '\n';
}
