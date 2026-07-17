/**
 * Full-run aggregation + report formatting.
 *
 * Everything here is deterministic: `summarizeRun` / `formatRunReport` consume ONLY the
 * deterministic per-run telemetry (outcomes, encounter/turn counts, gold, relics, death
 * attribution), so the same harness config ⇒ a byte-identical report string. Wall-clock
 * timing never touches this module (the CLI measures it and sends it to stderr).
 *
 * The headline gate numbers the report surfaces prominently:
 *   - win rate %                                     (policy 25–75, trivial strictly below),
 *   - encounters per COMPLETED (victory) run         (8–12),
 *   - median total moves per COMPLETED run           (30–90),
 *   - wedges                                          (must be 0),
 *   - boss-reached rate.
 * "Completed run" = a run driven to victory (the full map traversal) — the 8–12 / 30–90
 * bands are the shape of a WHOLE run, so early deaths (fewer encounters/moves) are excluded
 * from those two bands and reported separately in the all-runs and death sections.
 */
import { ACT2_BIOME_IDS } from '../run';
import type { BiomeId } from '../combat';
import type { RunGameResult, RunHarnessConfig } from './runSimTypes';

/** One width-10 moves bucket: runs whose total moves fell in [lo, hi]. */
export interface RunBucketBin {
  readonly lo: number;
  readonly hi: number;
  readonly count: number;
}

/**
 * One Act-2 biome's fairness bucket: the runs that REACHED Act 2 in this biome and how many of them
 * won. `winRatePct` is 0 when no run reached the biome (report the 0 games alongside it, not a rate).
 */
export interface RunBiomeBin {
  readonly biomeId: BiomeId;
  readonly games: number;
  readonly wins: number;
  readonly winRatePct: number;
}

/** Deaths attributed to one cause label (e.g. `fight:slime`, `boss`). */
export interface RunCauseBin {
  readonly cause: string;
  readonly count: number;
}

/** Deaths that occurred on one floor. */
export interface RunFloorBin {
  readonly floor: number;
  readonly count: number;
}

/** Deterministic summary of a run-harness run — stable per config. */
export interface RunSummary {
  readonly config: RunHarnessConfig;
  readonly games: number;
  readonly victories: number;
  readonly defeats: number;
  readonly wedges: number;
  readonly winRatePct: number;
  readonly bossReachedCount: number;
  readonly bossReachedPct: number;
  // ── Completed (victory) runs — the 8–12 / 30–90 gate bands ──
  readonly completedCount: number;
  readonly encMinCompleted: number;
  readonly encMedianCompleted: number;
  readonly encMaxCompleted: number;
  readonly movesMinCompleted: number;
  readonly movesMedianCompleted: number;
  readonly movesMaxCompleted: number;
  readonly movesMeanCompleted: number;
  readonly goldMeanCompleted: number;
  readonly relicsMeanCompleted: number;
  // ── All runs (transparency) ──
  readonly movesMinAll: number;
  readonly movesMedianAll: number;
  readonly movesMaxAll: number;
  readonly goldMeanAll: number;
  readonly relicsMeanAll: number;
  readonly movesBinsAll: readonly RunBucketBin[];
  // ── Act-2 biome fairness (runs that REACHED Act 2; canonical Act-2 biome order) ──
  readonly biomeBins: readonly RunBiomeBin[];
  /** Runs that never reached Act 2 (Act-1 defeats/wedges) — excluded from every biome bucket. */
  readonly act1Deaths: number;
  /**
   * The fairness metric: max win% − min win% across the biomes that had ≥1 reached-Act-2 run, in
   * percentage points (0 when fewer than two biomes were played). The per-biome gate is spread ≤10pp.
   */
  readonly biomeSpreadPp: number;
  // ── Deaths (defeats only) ──
  readonly deathsByCause: readonly RunCauseBin[];
  readonly deathsByFloor: readonly RunFloorBin[];
}

/** Median of an already-ascending list; even count ⇒ mean of the two middle values. */
function medianSorted(sorted: readonly number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = n >> 1;
  return n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function minOf(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((m, v) => (v < m ? v : m), values[0]);
}

function maxOf(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((m, v) => (v > m ? v : m), values[0]);
}

function mean(total: number, count: number): number {
  return count === 0 ? 0 : total / count;
}

/** Width-10 buckets [0,9],[10,19],… covering 0 through the max value (empty ⇒ no bins). */
function bucketByTen(values: readonly number[]): RunBucketBin[] {
  if (values.length === 0) return [];
  const max = maxOf(values);
  const bucketCount = Math.floor(max / 10) + 1;
  const counts = new Array<number>(bucketCount).fill(0);
  for (const v of values) counts[Math.floor(v / 10)]++;
  const bins: RunBucketBin[] = [];
  for (let k = 0; k < bucketCount; k++) {
    bins.push({ lo: k * 10, hi: k * 10 + 9, count: counts[k] });
  }
  return bins;
}

/** Aggregate raw run results into a deterministic summary. */
export function summarizeRun(config: RunHarnessConfig, results: readonly RunGameResult[]): RunSummary {
  let victories = 0;
  let defeats = 0;
  let wedges = 0;
  let bossReachedCount = 0;

  const completedEncounters: number[] = [];
  const completedMoves: number[] = [];
  const allMoves: number[] = [];
  let completedGoldTotal = 0;
  let completedRelicsTotal = 0;
  let allGoldTotal = 0;
  let allRelicsTotal = 0;

  const causeCounts = new Map<string, number>();
  const floorCounts = new Map<number, number>();
  let maxDeathFloor = 0;
  let anyDeath = false;

  // Act-2 biome fairness: bucket each run that REACHED Act 2 by its biome; the rest are Act-1 deaths.
  const biomeGames = new Map<BiomeId, number>();
  const biomeWins = new Map<BiomeId, number>();
  let act1Deaths = 0;

  for (const r of results) {
    allMoves.push(r.moves);
    allGoldTotal += r.gold;
    allRelicsTotal += r.relics;
    if (r.bossReached) bossReachedCount++;

    // A run counts toward a biome bucket only if it actually reached Act 2 (its biome is otherwise
    // recorded but never played). Runs that never reached Act 2 fall into the act1-deaths tally.
    if (r.reachedAct2 === true && r.act2BiomeId !== undefined) {
      biomeGames.set(r.act2BiomeId, (biomeGames.get(r.act2BiomeId) ?? 0) + 1);
      if (r.outcome === 'victory') biomeWins.set(r.act2BiomeId, (biomeWins.get(r.act2BiomeId) ?? 0) + 1);
    } else {
      act1Deaths++;
    }

    if (r.outcome === 'victory') {
      victories++;
      completedEncounters.push(r.encounters);
      completedMoves.push(r.moves);
      completedGoldTotal += r.gold;
      completedRelicsTotal += r.relics;
    } else if (r.outcome === 'defeat') {
      defeats++;
      if (r.death !== null) {
        causeCounts.set(r.death.cause, (causeCounts.get(r.death.cause) ?? 0) + 1);
        floorCounts.set(r.death.floor, (floorCounts.get(r.death.floor) ?? 0) + 1);
        if (r.death.floor > maxDeathFloor) maxDeathFloor = r.death.floor;
        anyDeath = true;
      }
    } else {
      wedges++;
    }
  }

  completedEncounters.sort((a, b) => a - b);
  completedMoves.sort((a, b) => a - b);
  const allMovesSorted = [...allMoves].sort((a, b) => a - b);

  // Deaths by cause: sorted by count desc, then cause asc (deterministic).
  const deathsByCause: RunCauseBin[] = [...causeCounts.entries()]
    .map(([cause, count]) => ({ cause, count }))
    .sort((a, b) => (b.count - a.count) || (a.cause < b.cause ? -1 : a.cause > b.cause ? 1 : 0));

  // Deaths by floor: contiguous 0..maxDeathFloor (0 counts where none died there).
  const deathsByFloor: RunFloorBin[] = [];
  if (anyDeath) {
    for (let floor = 0; floor <= maxDeathFloor; floor++) {
      deathsByFloor.push({ floor, count: floorCounts.get(floor) ?? 0 });
    }
  }

  // One bin per Act-2 biome in canonical order (stdout-stable); spread is measured only over the
  // biomes that were actually reached, so an unplayed biome never masquerades as a 0% outlier.
  const biomeBins: RunBiomeBin[] = ACT2_BIOME_IDS.map((biomeId) => {
    const biomeGamesCount = biomeGames.get(biomeId) ?? 0;
    const biomeWinsCount = biomeWins.get(biomeId) ?? 0;
    return {
      biomeId,
      games: biomeGamesCount,
      wins: biomeWinsCount,
      winRatePct: biomeGamesCount === 0 ? 0 : (biomeWinsCount / biomeGamesCount) * 100,
    };
  });
  const playedRates = biomeBins.filter((b) => b.games > 0).map((b) => b.winRatePct);
  const biomeSpreadPp = playedRates.length < 2 ? 0 : maxOf(playedRates) - minOf(playedRates);

  const games = config.games;
  return {
    config,
    games,
    victories,
    defeats,
    wedges,
    winRatePct: games === 0 ? 0 : (victories / games) * 100,
    bossReachedCount,
    bossReachedPct: games === 0 ? 0 : (bossReachedCount / games) * 100,
    completedCount: victories,
    encMinCompleted: minOf(completedEncounters),
    encMedianCompleted: medianSorted(completedEncounters),
    encMaxCompleted: maxOf(completedEncounters),
    movesMinCompleted: minOf(completedMoves),
    movesMedianCompleted: medianSorted(completedMoves),
    movesMaxCompleted: maxOf(completedMoves),
    movesMeanCompleted: mean(completedMoves.reduce((s, v) => s + v, 0), victories),
    goldMeanCompleted: mean(completedGoldTotal, victories),
    relicsMeanCompleted: mean(completedRelicsTotal, victories),
    movesMinAll: minOf(allMovesSorted),
    movesMedianAll: medianSorted(allMovesSorted),
    movesMaxAll: maxOf(allMovesSorted),
    goldMeanAll: mean(allGoldTotal, games),
    relicsMeanAll: mean(allRelicsTotal, games),
    movesBinsAll: bucketByTen(allMoves),
    biomeBins,
    act1Deaths,
    biomeSpreadPp,
    deathsByCause,
    deathsByFloor,
  };
}

// ---- Formatting (deterministic; stdout) ----

const PCT_PRECISION = 1;
const MEAN_PRECISION = 2;
const MEDIAN_PRECISION = 1;
/** Column width for a biome id label (`sunken-catacombs` is the longest at 16). */
const BIOME_NAME_WIDTH = 16;

function pct(count: number, total: number): string {
  const value = total === 0 ? 0 : (count / total) * 100;
  return value.toFixed(PCT_PRECISION);
}

/** Render the deterministic full-run report (goes to stdout). Ends with a trailing newline. */
export function formatRunReport(summary: RunSummary): string {
  const c = summary.config;

  const causeLines =
    summary.deathsByCause.length === 0
      ? ['  (no deaths)']
      : summary.deathsByCause.map((b) => `  ${b.cause.padEnd(16, ' ')} ${b.count} (${pct(b.count, summary.defeats)}%)`);

  const floorLines =
    summary.deathsByFloor.length === 0
      ? ['  (no deaths)']
      : summary.deathsByFloor.map((b) => {
          const floor = String(b.floor).padStart(2, ' ');
          return `  floor ${floor}: ${b.count} (${pct(b.count, summary.defeats)}%)`;
        });

  const movesBinLines =
    summary.movesBinsAll.length === 0
      ? ['  (no runs)']
      : summary.movesBinsAll.map((b) => {
          const range = `${String(b.lo).padStart(3, ' ')}-${String(b.hi).padStart(3, ' ')}`;
          return `  ${range} moves: ${b.count} (${pct(b.count, summary.games)}%)`;
        });

  const biomeLines = summary.biomeBins.map((b) => {
    const name = b.biomeId.padEnd(BIOME_NAME_WIDTH, ' ');
    const n = String(b.games).padStart(4, ' ');
    const wins = String(b.wins).padStart(4, ' ');
    const wr = b.games === 0 ? '   —' : b.winRatePct.toFixed(PCT_PRECISION);
    return `  ${name} n ${n}  wins ${wins}  win% ${wr}`;
  });

  const lines: string[] = [
    'Dungeon Cascades — Full-Run Sim Report',
    '======================================',
    `Bot:              ${c.bot}`,
    // The variant line is emitted ONLY for a variant run, so a vanilla report is byte-identical
    // to the pre-Stage-4 output (the Stage-3 baseline reproduces exactly).
    ...(c.variantId !== undefined ? [`Variant:          ${c.variantId}`] : []),
    `Base seed:        ${c.baseSeed}`,
    `Games:            ${c.games}`,
    `Step cap:         ${c.stepCap}`,
    '--------------------------------------',
    `Victories:        ${summary.victories} (${pct(summary.victories, c.games)}%)`,
    `Defeats:          ${summary.defeats} (${pct(summary.defeats, c.games)}%)`,
    `Wedges:           ${summary.wedges} (${pct(summary.wedges, c.games)}%)`,
    `Win rate:         ${summary.winRatePct.toFixed(PCT_PRECISION)}%`,
    `Boss-reached:     ${summary.bossReachedCount} (${summary.bossReachedPct.toFixed(PCT_PRECISION)}%)`,
    '',
    'Completed (victory) runs — gate bands:',
    `  Encounters/run:   min ${summary.encMinCompleted}  median ${summary.encMedianCompleted.toFixed(MEDIAN_PRECISION)}  max ${summary.encMaxCompleted}   [gate 8–12]`,
    `  Moves/run:        min ${summary.movesMinCompleted}  median ${summary.movesMedianCompleted.toFixed(MEDIAN_PRECISION)}  max ${summary.movesMaxCompleted}   [gate median 30–90]`,
    `  Moves/run mean:   ${summary.movesMeanCompleted.toFixed(MEAN_PRECISION)}`,
    `  Gold earned mean: ${summary.goldMeanCompleted.toFixed(MEAN_PRECISION)}`,
    `  Relics mean:      ${summary.relicsMeanCompleted.toFixed(MEAN_PRECISION)}`,
    '',
    'All runs:',
    `  Moves/run:        min ${summary.movesMinAll}  median ${summary.movesMedianAll.toFixed(MEDIAN_PRECISION)}  max ${summary.movesMaxAll}`,
    `  Gold earned mean: ${summary.goldMeanAll.toFixed(MEAN_PRECISION)}`,
    `  Relics mean:      ${summary.relicsMeanAll.toFixed(MEAN_PRECISION)}`,
    '',
    'Act-2 biome fairness (reached-Act-2 runs):',
    ...biomeLines,
    `  act1-deaths: ${summary.act1Deaths}`,
    `  max spread:  ${summary.biomeSpreadPp.toFixed(PCT_PRECISION)}pp`,
    '',
    'Moves-per-run distribution (all runs):',
    ...movesBinLines,
    '',
    'Deaths by cause:',
    ...causeLines,
    '',
    'Deaths by floor:',
    ...floorLines,
  ];
  return lines.join('\n') + '\n';
}
