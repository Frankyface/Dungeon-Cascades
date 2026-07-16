/**
 * One combat game = a full encounter played to a terminal state by a bot.
 *
 * `startEncounter(enemyId, gameSeed)` splits `gameSeed` internally into independent
 * board-creation and move-refill streams (encounter.ts). The BOT decision stream is
 * a THIRD independent stream, derived here as `deriveSeed(gameSeed, SEED_TAG_BOT)`,
 * so a bot's path choices never perturb the refills it is judged against — the same
 * three-stream separation the board harness uses (see seeds.ts).
 *
 * The loop plays `playTurn` until the encounter is won/lost, or until `maxTurns` is
 * reached (a safety cap — every Stage-2 enemy attacks on a bounded cadence, so the
 * player's HP strictly trends down and real fights terminate far below the cap;
 * hitting it is recorded as `timeout`, never counted as a win). Pure and
 * deterministic: no clock, no ambient randomness.
 */
import { createRng, uniformTileSource } from '../board';
import { getEnemy, playTurn, startEncounter } from '../combat';
import type { EnemyId } from '../combat';
import { deriveSeed, SEED_TAG_BOT } from './seeds';
import type { BotConfig } from './types';
import type { CombatConfig } from '../combat';
import type { CombatBot, CombatBotContext, CombatGameResult, CombatMoveStat, EncounterOutcome } from './combatTypes';

export function playEncounter(
  enemyId: EnemyId,
  gameSeed: number,
  bot: CombatBot,
  botConfig: BotConfig,
  combatConfig: CombatConfig,
  maxTurns: number,
): CombatGameResult {
  const enemy = getEnemy(enemyId);
  let state = startEncounter(enemyId, gameSeed, uniformTileSource, combatConfig);
  let botRng = createRng(deriveSeed(gameSeed, SEED_TAG_BOT));

  const moves: CombatMoveStat[] = [];
  while (state.status === 'ongoing' && moves.length < maxTurns) {
    const ctx: CombatBotContext = {
      enemy,
      combatConfig,
      botConfig,
      playerHp: state.playerHp,
      playerMaxHp: state.playerMaxHp,
    };
    const decision = bot(state.board, botRng, ctx);
    botRng = decision.rngState;

    const res = playTurn(state, decision.path, uniformTileSource, combatConfig);
    moves.push({ damage: res.damage, heal: res.heal, combos: res.move.totalCombos });
    state = res.state;
  }

  const outcome: EncounterOutcome =
    state.status === 'won' ? 'won' : state.status === 'lost' ? 'lost' : 'timeout';

  return { seed: gameSeed, outcome, turns: moves.length, moves };
}
