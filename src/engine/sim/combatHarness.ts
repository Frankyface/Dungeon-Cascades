/**
 * Combat harness — run N encounters for one (enemy, bot) over a deterministic seed
 * sequence.
 *
 * Game i uses seed `deriveSeed(baseSeed, i)` (the SAME seed tree the board harness
 * uses, so the two harnesses share one reproducibility contract), and each encounter
 * is played to a terminal state. Re-running with the same config reproduces every
 * per-move stat and every outcome exactly.
 */
import { greedyCombatBot, randomCombatBot } from './combatBots';
import { playEncounter } from './combatGame';
import { gameSeedFor } from './seeds';
import type { CombatBot, CombatBotName, CombatGameResult, CombatHarnessConfig } from './combatTypes';

/** Registry of the combat bots, keyed by CLI name. */
export const COMBAT_BOTS: Readonly<Record<CombatBotName, CombatBot>> = {
  'greedy-combat': greedyCombatBot,
  random: randomCombatBot,
};

/** Run a full combat harness, returning one result per encounter (in game-index order). */
export function runCombatHarness(config: CombatHarnessConfig): CombatGameResult[] {
  const bot = COMBAT_BOTS[config.bot];
  const results: CombatGameResult[] = [];
  for (let i = 0; i < config.games; i++) {
    const seed = gameSeedFor(config.baseSeed, i);
    results.push(
      playEncounter(config.enemy, seed, bot, config.botConfig, config.combatConfig, config.maxTurns),
    );
  }
  return results;
}
