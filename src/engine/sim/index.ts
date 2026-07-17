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

// Shared bounded path search (used by both greedy bots).
export { searchBestPath } from './pathSearch';
export type { ScoreCodes } from './pathSearch';

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

// ── Combat sim (Stage 2) ─────────────────────────────────────────────────────
// Combat bots + first-wave scorer.
export { greedyCombatBot, randomCombatBot, HEAL_HP_FRACTION } from './combatBots';
export { scoreFirstWave } from './combatScore';
export type { ColorWeights } from './combatScore';

// Combat game + harness.
export { playEncounter } from './combatGame';
export { COMBAT_BOTS, runCombatHarness } from './combatHarness';

// Combat aggregation + reporting.
export { formatCombatReport, summarizeCombat } from './combatStats';
export type { CombatSummary } from './combatStats';

// Combat data model.
export { DEFAULT_MAX_TURNS } from './combatTypes';
export type {
  CombatBot,
  CombatBotContext,
  CombatBotName,
  CombatGameResult,
  CombatHarnessConfig,
  CombatMoveStat,
  EncounterOutcome,
} from './combatTypes';

// ── Full-run sim (Stage 3) ─────────────────────────────────────────────────────
// Run policy bot (routing heuristic + one-transition stepper) + combat path chooser.
export {
  ROUTE_HURT_HP_FRACTION,
  ROUTE_ACT2_HURT_HP_FRACTION,
  ROUTE_HEALTHY_HP_FRACTION,
  combatPathFor,
  choosePolicyRoute,
  choosePolicyDraft,
  affinityComboPath,
  affinityCombatPath,
  stepRunBot,
} from './runBot';

// Run game driver + harness.
export { playRun } from './runGame';
export { runRunHarness } from './runHarness';

// Run aggregation + reporting.
export { summarizeRun, formatRunReport } from './runStats';
export type { RunSummary, RunBucketBin, RunBiomeBin, RunCauseBin, RunFloorBin } from './runStats';

// Run-sim data model.
export { DEFAULT_RUN_STEP_CAP } from './runSimTypes';
export type { RunBotName, RunOutcome, RunDeath, RunGameResult, RunHarnessConfig } from './runSimTypes';

// ── Stage 4: balance report at scale (full purity/balance matrix) ───────────────
export { PURITY_BAND_PP, BIOME_FAIRNESS_BAND_PP, runBalanceReport, formatBalanceReport } from './balanceReport';
export type {
  BalanceReport,
  BalanceReportConfig,
  BalanceRow,
  RelicCorrelationRow,
} from './balanceReport';
