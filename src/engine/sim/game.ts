/**
 * One game = a fresh board + a fixed number of bot-driven moves.
 *
 * Seed threading (see seeds.ts for the full tree). From the game seed we derive
 * three INDEPENDENT streams:
 *   - boardSeed → createBoard (consumed internally; board-creation stream A)
 *   - moveSeed  → resolveMove refills, threaded move-to-move (stream B)
 *   - botSeed   → bot decisions, threaded move-to-move (stream C)
 * Board-creation (A) and move-refill (B) are independent as the engine requires;
 * bot randomness (C) is a third independent stream so a bot's path choices never
 * perturb the refill it is judged against.
 *
 * The `now` clock is injected so the deterministic core never reaches for ambient
 * time; only per-move timing (MoveStat.timeMs, stderr-only) uses it. Passing a
 * constant clock (e.g. `() => 0`) makes even timeMs deterministic for tests.
 */
import { createBoard, createRng, resolveMove } from '../board';
import { deriveSeed, SEED_TAG_BOARD, SEED_TAG_BOT, SEED_TAG_MOVE } from './seeds';
import type { Bot, BotConfig, GameResult, MoveStat } from './types';

export function playGame(
  gameSeed: number,
  bot: Bot,
  moves: number,
  config: BotConfig,
  now: () => number,
): GameResult {
  const boardSeed = deriveSeed(gameSeed, SEED_TAG_BOARD);
  const moveSeed = deriveSeed(gameSeed, SEED_TAG_MOVE);
  const botSeed = deriveSeed(gameSeed, SEED_TAG_BOT);

  let board = createBoard(boardSeed);
  let moveRng = createRng(moveSeed);
  let botRng = createRng(botSeed);

  const moveStats: MoveStat[] = [];
  for (let m = 0; m < moves; m++) {
    const decision = bot(board, botRng, config);
    botRng = decision.rngState;

    const t0 = now();
    const res = resolveMove(board, decision.path, moveRng);
    const t1 = now();

    moveRng = res.rngState;
    moveStats.push({
      combos: res.totalCombos,
      cascadeDepth: res.waves.length,
      timeMs: t1 - t0,
    });
    board = res.finalBoard;
  }

  return { seed: gameSeed, moves: moveStats };
}
