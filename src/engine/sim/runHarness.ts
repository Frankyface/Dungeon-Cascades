/**
 * Full-run harness — drive N whole runs for one bot over a deterministic seed sequence.
 *
 * Run i uses seed `gameSeedFor(baseSeed, i)` (the SAME seed tree the board and combat
 * harnesses use, so all three harnesses share one reproducibility contract), and each run
 * is driven to a terminal state (or the wedge cap). Re-running with the same config
 * reproduces every per-run telemetry value and every outcome exactly.
 */
import { gameSeedFor } from './seeds';
import { playRun } from './runGame';
import type { RunGameResult, RunHarnessConfig } from './runSimTypes';

/** Run a full run-harness, returning one result per run (in run-index order). */
export function runRunHarness(config: RunHarnessConfig): RunGameResult[] {
  const results: RunGameResult[] = [];
  for (let i = 0; i < config.games; i++) {
    const seed = gameSeedFor(config.baseSeed, i);
    results.push(playRun(seed, config.bot, config.stepCap, config.variantId));
  }
  return results;
}
