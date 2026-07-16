/**
 * Sim harness regression + determinism tests.
 *
 * These lock in the CURRENT engine+bot behavior on a small fixed-seed run so that
 * `npm test` fails loudly if a change to the board engine or either bot shifts the
 * balance numbers. The expected values were recorded from a real run (seed 42,
 * 25 games x 10 moves) — if the engine legitimately changes, re-record them and note
 * why in the Verification Log.
 */
import fc from 'fast-check';
import { CELL_COUNT, COLS, ROWS, TILE_COLORS, findMatches } from '../board';
import type { Board, TileColor } from '../board';
import {
  DEFAULT_BOT_CONFIG,
  countMatchGroups,
  formatReport,
  runHarness,
  summarize,
} from './index';
import type { BotName, HarnessConfig } from './index';

/** Constant clock so per-move timeMs is 0 and nothing deterministic depends on wall time. */
const FIXED_NOW = (): number => 0;

function makeConfig(bot: BotName, games: number, moves: number): HarnessConfig {
  return { bot, games, baseSeed: 42, moves, botConfig: DEFAULT_BOT_CONFIG };
}

describe('sim harness — fixed-seed regression (locks engine + bot behavior)', () => {
  it('greedy over 25 games x 10 moves matches the recorded expected numbers', () => {
    const config = makeConfig('greedy', 25, 10);
    const summary = summarize(config, runHarness(config, FIXED_NOW));

    expect(summary.totalMoves).toBe(250);
    expect(summary.totalCombos).toBe(868);
    expect(summary.avgCombosPerMove.toFixed(4)).toBe('3.4720');
  });

  it('random over 25 games x 10 moves matches the recorded expected numbers', () => {
    const config = makeConfig('random', 25, 10);
    const summary = summarize(config, runHarness(config, FIXED_NOW));

    expect(summary.totalMoves).toBe(250);
    expect(summary.totalCombos).toBe(100);
    expect(summary.avgCombosPerMove.toFixed(4)).toBe('0.4000');
  });

  it('greedy scores at least as well as random on avg combos/move (sanity signal)', () => {
    const greedy = summarize(makeConfig('greedy', 25, 10), runHarness(makeConfig('greedy', 25, 10), FIXED_NOW));
    const random = summarize(makeConfig('random', 25, 10), runHarness(makeConfig('random', 25, 10), FIXED_NOW));

    expect(greedy.avgCombosPerMove).toBeGreaterThanOrEqual(random.avgCombosPerMove);
  });
});

describe('sim harness — determinism', () => {
  it('produces byte-identical reports across two runs, independent of the wall clock', () => {
    const config = makeConfig('greedy', 15, 10);
    // Two DIFFERENT clocks prove the report never leaks nondeterministic timing.
    const reportA = formatReport(summarize(config, runHarness(config, () => 0)));
    const reportB = formatReport(summarize(config, runHarness(config, () => 999999)));

    expect(reportB).toBe(reportA);
  });

  it('random bot report is also byte-identical across identical runs', () => {
    const config = makeConfig('random', 30, 10);
    const reportA = formatReport(summarize(config, runHarness(config, FIXED_NOW)));
    const reportB = formatReport(summarize(config, runHarness(config, FIXED_NOW)));

    expect(reportB).toBe(reportA);
  });
});

describe('countMatchGroups — parity with the engine findMatches', () => {
  it('equals findMatches(board).length for arbitrary boards (incl. matches present)', () => {
    const tilesArb = fc.array(fc.constantFrom(...TILE_COLORS), {
      minLength: CELL_COUNT,
      maxLength: CELL_COUNT,
    });
    fc.assert(
      fc.property(tilesArb, (tiles) => {
        const board: Board = { cols: COLS, rows: ROWS, tiles: tiles as TileColor[] };
        expect(countMatchGroups(board)).toBe(findMatches(board).length);
      }),
      { numRuns: 300 },
    );
  });
});
