/**
 * randomBot — the null-model baseline. It picks a legal drag path uniformly at
 * random and knows nothing about matches, so its combos/move is the "just wiggle a
 * tile" floor that greedy must beat.
 *
 * Path construction (all draws from the bot's seeded decision-RNG, threaded in and
 * out — no ambient randomness):
 *   1. length L ~ Uniform[randomMinSteps, randomMaxSteps]  (default [1, 8]);
 *   2. start cell ~ Uniform over all board cells;
 *   3. a random orthogonal walk of L steps: at each cell pick uniformly among the
 *      in-bounds directions (DIRECTIONS order, so the draw index is well-defined).
 *      Reversals are allowed — this is the honest "random" walk, not a smart one.
 *
 * The result is always a valid path: L >= 1 and every board cell on a >=2-wide/tall
 * board has at least one in-bounds neighbor, so the first step always lands.
 */
import { DIRECTIONS, inBounds, nextInt, positionOf, step } from '../board';
import type { Direction, Position } from '../board';
import type { Bot } from './types';

export const randomBot: Bot = (board, rngState, config) => {
  const cellCount = board.cols * board.rows;

  // 1. Draw path length L in [min, max].
  const span = config.randomMaxSteps - config.randomMinSteps + 1;
  const lenDraw = nextInt(rngState, span);
  const length = config.randomMinSteps + lenDraw.value;
  let state = lenDraw.state;

  // 2. Draw a start cell.
  const startDraw = nextInt(state, cellCount);
  state = startDraw.state;
  const start = positionOf(board, startDraw.value);

  // 3. Random orthogonal walk.
  const steps: Direction[] = [];
  let current: Position = start;
  for (let k = 0; k < length; k++) {
    const legal: Direction[] = [];
    for (const dir of DIRECTIONS) {
      if (inBounds(board, step(current, dir))) {
        legal.push(dir);
      }
    }
    if (legal.length === 0) {
      break; // unreachable on a >=2x2 board; guard against degenerate boards.
    }
    const dirDraw = nextInt(state, legal.length);
    state = dirDraw.state;
    const dir = legal[dirDraw.value];
    steps.push(dir);
    current = step(current, dir);
  }

  return { path: { start, steps }, rngState: state };
};
