/**
 * Public API of the Dungeon Cascades sim harness.
 *
 * Headless bot players plus a deterministic stats harness that drive the board
 * engine with no UI. Pure and deterministic: ZERO React / React Native imports and
 * no ambient time or randomness (the only wall-clock use is per-move timing, which
 * is confined to the CLI's stderr output). The CLI entry point lives in cli.ts.
 */

// Bot contract + config + result types.
export type {
  Bot,
  BotConfig,
  BotDecision,
  BotName,
  GameResult,
  HarnessConfig,
  MoveStat,
} from './types';
export { DEFAULT_BOT_CONFIG } from './types';

// Deterministic seed derivation.
export { deriveSeed, gameSeedFor, SEED_TAG_BOARD, SEED_TAG_BOT, SEED_TAG_MOVE } from './seeds';

// Fast match-group counter (used by greedyBot; exported for testing/reuse).
export { countMatchGroups } from './matchCount';

// Bots.
export { randomBot } from './randomBot';
export { greedyBot } from './greedyBot';

// Game + harness.
export { playGame } from './game';
export { BOTS, runHarness } from './harness';

// Aggregation + reporting.
export {
  formatReport,
  formatTiming,
  summarize,
  summarizeTiming,
} from './stats';
export type { HistogramBin, SimSummary, TimingSummary } from './stats';
