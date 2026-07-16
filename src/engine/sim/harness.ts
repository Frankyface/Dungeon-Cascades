/**
 * Harness — run N games for one bot over a deterministic seed sequence.
 *
 * Game i uses seed `deriveSeed(baseSeed, i)`, so the whole run is a pure function
 * of (bot, games, baseSeed, moves, botConfig): re-running with the same config
 * reproduces every per-move stat exactly. Timing is the sole exception and is kept
 * off the deterministic report (see stats.ts / cli.ts).
 */
import { greedyBot } from './greedyBot';
import { randomBot } from './randomBot';
import { playGame } from './game';
import { gameSeedFor } from './seeds';
import type { Bot, BotName, GameResult, HarnessConfig } from './types';

/** Registry of the Stage-1 bots, keyed by CLI name. */
export const BOTS: Readonly<Record<BotName, Bot>> = {
  random: randomBot,
  greedy: greedyBot,
};

/** Run a full harness, returning one GameResult per game (in game-index order). */
export function runHarness(config: HarnessConfig, now: () => number): GameResult[] {
  const bot = BOTS[config.bot];
  const results: GameResult[] = [];
  for (let i = 0; i < config.games; i++) {
    const seed = gameSeedFor(config.baseSeed, i);
    results.push(playGame(seed, bot, config.moves, config.botConfig, now));
  }
  return results;
}
