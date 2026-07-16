/**
 * Sim stats CLI — the headless balance & determinism harness entry point.
 *
 *   Board mode  (default):
 *     npm run sim -- --games N --bot random|greedy --seed S --moves M [--timing]
 *   Combat mode:
 *     npm run sim -- --mode combat --enemy slime|skeleton|bat
 *                    --bot greedy-combat|random --games N --seed S [--timing]
 *
 * DETERMINISM CONTRACT: stdout is byte-for-byte identical across identical runs (same
 * flags). The nondeterministic wall-time timing is written to STDERR only — redirect
 * stdout to a file and diff it to prove determinism (see --help). Board mode is the
 * unchanged Stage-1 path; combat mode plays full encounters to a terminal state. This
 * is the only file in src/engine/ that uses Node globals (process / performance /
 * console); all deterministic logic lives in the pure modules it calls.
 */
import { runHarness } from './harness';
import { formatReport, formatTiming, summarize, summarizeTiming } from './stats';
import { runCombatHarness } from './combatHarness';
import { formatCombatReport, summarizeCombat } from './combatStats';
import { runRunHarness } from './runHarness';
import { formatRunReport, summarizeRun } from './runStats';
import { runBalanceReport, formatBalanceReport } from './balanceReport';
import { DEFAULT_RUN_STEP_CAP } from './runSimTypes';
import { DEFAULT_BOT_CONFIG } from './types';
import { DEFAULT_MAX_TURNS } from './combatTypes';
import { DEFAULT_COMBAT_CONFIG, ENEMY_IDS } from '../combat';
import { VARIANT_IDS } from '../run';
import type { EnemyId } from '../combat';
import type { BotName, HarnessConfig } from './types';
import type { CombatBotName, CombatHarnessConfig } from './combatTypes';
import type { RunBotName, RunHarnessConfig } from './runSimTypes';
import type { BalanceReportConfig } from './balanceReport';

type Mode = 'board' | 'combat' | 'run' | 'report';

/** Default games for the (heavy) full purity/balance matrix when `--games` is not given. */
const REPORT_DEFAULT_GAMES = 2000;

interface ParsedArgs {
  readonly mode: Mode;
  readonly enemy: EnemyId;
  readonly games: number;
  readonly bot: string; // raw; validated against the mode in run()
  readonly seed: number;
  readonly moves: number;
  readonly variant?: string; // run mode: optional starting variant id
  readonly timing: boolean;
  readonly help: boolean;
}

const DEFAULTS = {
  games: 100,
  seed: 42,
  moves: 20,
  enemy: 'slime' as EnemyId,
};

const BOARD_BOTS: readonly string[] = ['random', 'greedy'];
const COMBAT_BOTS_NAMES: readonly string[] = ['greedy-combat', 'random'];
const RUN_BOTS_NAMES: readonly string[] = ['policy', 'trivial'];

const USAGE = `Dungeon Cascades — sim stats CLI

Usage:
  Board mode (default — Stage 1 board harness):
    npm run sim -- --games N --bot random|greedy --seed S --moves M [--timing]
  Combat mode (Stage 2 — full seeded encounters):
    npm run sim -- --mode combat --enemy slime|skeleton|bat \\
                   --bot greedy-combat|random --games N --seed S [--timing]
  Run mode (Stage 3 — full seeded runs, map→fights→draft→shop→boss):
    npm run sim -- --mode run --bot policy|trivial --games N --seed S \\
                   [--variant ID] [--timing]
  Report mode (Stage 4 — full purity/balance matrix, vanilla + every variant):
    npm run sim -- --mode report --games N --seed S [--timing]

Options:
  --mode NAME   board | combat | run | report           (default board)
  --enemy NAME  combat only: slime | skeleton | bat     (default ${DEFAULTS.enemy})
  --bot NAME    board: random | greedy                  (default random)
                combat: greedy-combat | random          (default greedy-combat)
                run: policy | trivial                   (default policy)
  --variant ID  run mode only: a starting variant       (default: vanilla)
                one of: ${VARIANT_IDS.join(', ')}
  --games N     Number of seeded games/encounters/runs   (default ${DEFAULTS.games};
                report mode default ${REPORT_DEFAULT_GAMES})
  --seed S      Base seed; game i uses derive(seed, i)   (default ${DEFAULTS.seed})
  --moves M     Board mode only: moves played per game   (default ${DEFAULTS.moves})
  --timing      Print an extra timing line to stderr
  --help, -h    Show this help and exit

Determinism:
  stdout (the stats report) is byte-for-byte identical across identical runs.
  Wall-time timing is nondeterministic, so it is written to STDERR only — stdout
  stays clean. Prove it:
    npm run sim -- --mode run --bot policy --games 1000 --seed 42 > a.txt
    npm run sim -- --mode run --bot policy --games 1000 --seed 42 > b.txt
    diff a.txt b.txt        # -> no output
`;

/** Strictly parse an integer flag value; throws on anything non-integer. */
function parseIntStrict(name: string, raw: string | undefined): number {
  if (raw === undefined) {
    throw new Error(`missing value for ${name}`);
  }
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be an integer, got '${raw}'`);
  }
  return value;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  let mode: Mode = 'board';
  let enemy: EnemyId = DEFAULTS.enemy;
  let games = DEFAULTS.games;
  let gamesExplicit = false;
  let botRaw: string | undefined;
  let seed = DEFAULTS.seed;
  let moves = DEFAULTS.moves;
  let variant: string | undefined;
  let timing = false;
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--mode': {
        const value = argv[++i];
        if (value !== 'board' && value !== 'combat' && value !== 'run' && value !== 'report') {
          throw new Error(`--mode must be 'board', 'combat', 'run', or 'report', got '${value ?? ''}'`);
        }
        mode = value;
        break;
      }
      case '--enemy': {
        const value = argv[++i];
        if (value === undefined || !(ENEMY_IDS as readonly string[]).includes(value)) {
          throw new Error(`--enemy must be one of ${ENEMY_IDS.join(' | ')}, got '${value ?? ''}'`);
        }
        enemy = value as EnemyId;
        break;
      }
      case '--games':
        games = parseIntStrict('--games', argv[++i]);
        gamesExplicit = true;
        break;
      case '--seed':
        seed = parseIntStrict('--seed', argv[++i]);
        break;
      case '--moves':
        moves = parseIntStrict('--moves', argv[++i]);
        break;
      case '--bot':
        botRaw = argv[++i];
        break;
      case '--variant': {
        const value = argv[++i];
        if (value === undefined || !VARIANT_IDS.includes(value)) {
          throw new Error(`--variant must be one of ${VARIANT_IDS.join(' | ')}, got '${value ?? ''}'`);
        }
        variant = value;
        break;
      }
      case '--timing':
        timing = true;
        break;
      case '--help':
      case '-h':
        help = true;
        break;
      default:
        throw new Error(`unknown argument '${arg}'`);
    }
  }

  // Report mode's default game count is the heavy full-matrix value unless overridden.
  if (mode === 'report' && !gamesExplicit) {
    games = REPORT_DEFAULT_GAMES;
  }

  if (games < 1) {
    throw new Error(`--games must be >= 1, got ${games}`);
  }
  if (moves < 1) {
    throw new Error(`--moves must be >= 1, got ${moves}`);
  }
  if (variant !== undefined && mode !== 'run') {
    throw new Error(`--variant is only valid in run mode (got mode '${mode}')`);
  }

  // Report mode always uses the policy bot (the purity measuring stick); no --bot needed.
  if (mode === 'report') {
    return { mode, enemy, games, bot: 'policy', seed, moves, variant, timing, help };
  }

  // Resolve the mode-specific bot default, then validate against the mode.
  const botDefault = mode === 'combat' ? 'greedy-combat' : mode === 'run' ? 'policy' : 'random';
  const bot = botRaw ?? botDefault;
  const allowed = mode === 'combat' ? COMBAT_BOTS_NAMES : mode === 'run' ? RUN_BOTS_NAMES : BOARD_BOTS;
  if (!allowed.includes(bot)) {
    throw new Error(`--bot for ${mode} mode must be one of ${allowed.join(' | ')}, got '${bot}'`);
  }

  return { mode, enemy, games, bot, seed, moves, variant, timing, help };
}

/** Board mode — the unchanged Stage-1 path (byte-identical output). */
function runBoard(parsed: ParsedArgs): void {
  const config: HarnessConfig = {
    bot: parsed.bot as BotName,
    games: parsed.games,
    baseSeed: parsed.seed,
    moves: parsed.moves,
    botConfig: DEFAULT_BOT_CONFIG,
  };

  const now = (): number => performance.now();
  const results = runHarness(config, now);

  // Deterministic report -> stdout.
  process.stdout.write(formatReport(summarize(config, results)));
  // Nondeterministic timing -> stderr (keeps stdout byte-deterministic).
  process.stderr.write(formatTiming(summarizeTiming(results), parsed.timing));
}

/** Combat mode — play full encounters; deterministic report to stdout, timing to stderr. */
function runCombat(parsed: ParsedArgs): void {
  const config: CombatHarnessConfig = {
    enemy: parsed.enemy,
    bot: parsed.bot as CombatBotName,
    games: parsed.games,
    baseSeed: parsed.seed,
    botConfig: DEFAULT_BOT_CONFIG,
    combatConfig: DEFAULT_COMBAT_CONFIG,
    maxTurns: DEFAULT_MAX_TURNS,
  };

  const t0 = performance.now();
  const results = runCombatHarness(config);
  const t1 = performance.now();

  // Deterministic report -> stdout.
  process.stdout.write(formatCombatReport(summarizeCombat(config, results)));
  // Nondeterministic timing -> stderr only.
  const totalMs = t1 - t0;
  const perGame = config.games === 0 ? 0 : totalMs / config.games;
  let timingLine = `[timing] ${config.games} encounters in ${totalMs.toFixed(1)} ms (avg ${perGame.toFixed(3)} ms/encounter)\n`;
  if (parsed.timing) {
    const totalMoves = results.reduce((sum, g) => sum + g.moves.length, 0);
    timingLine += `[timing] total moves: ${totalMoves}\n`;
  }
  process.stderr.write(timingLine);
}

/** Run mode — drive full seeded runs; deterministic report to stdout, timing to stderr. */
function runRun(parsed: ParsedArgs): void {
  const config: RunHarnessConfig = {
    bot: parsed.bot as RunBotName,
    games: parsed.games,
    baseSeed: parsed.seed,
    stepCap: DEFAULT_RUN_STEP_CAP,
    ...(parsed.variant !== undefined ? { variantId: parsed.variant } : {}),
  };

  const t0 = performance.now();
  const results = runRunHarness(config);
  const t1 = performance.now();

  // Deterministic report -> stdout.
  process.stdout.write(formatRunReport(summarizeRun(config, results)));
  // Nondeterministic timing -> stderr only.
  const totalMs = t1 - t0;
  const perGame = config.games === 0 ? 0 : totalMs / config.games;
  let timingLine = `[timing] ${config.games} runs in ${totalMs.toFixed(1)} ms (avg ${perGame.toFixed(3)} ms/run)\n`;
  if (parsed.timing) {
    const totalMoves = results.reduce((sum, r) => sum + r.moves, 0);
    const totalSteps = results.reduce((sum, r) => sum + r.steps, 0);
    timingLine += `[timing] total combat moves: ${totalMoves} · total driver steps: ${totalSteps}\n`;
  }
  process.stderr.write(timingLine);
}

/** Report mode — drive the full purity/balance matrix; deterministic report to stdout. */
function runReport(parsed: ParsedArgs): void {
  const config: BalanceReportConfig = {
    bot: parsed.bot as RunBotName,
    games: parsed.games,
    baseSeed: parsed.seed,
    stepCap: DEFAULT_RUN_STEP_CAP,
  };

  const t0 = performance.now();
  const report = runBalanceReport(config);
  const t1 = performance.now();

  // Deterministic report -> stdout.
  process.stdout.write(formatBalanceReport(report));
  // Nondeterministic timing -> stderr only.
  const totalMs = t1 - t0;
  const configs = report.rows.length;
  const totalRuns = configs * config.games;
  process.stderr.write(
    `[timing] ${configs} configs × ${config.games} runs = ${totalRuns} runs in ${totalMs.toFixed(1)} ms ` +
      `(avg ${(config.games === 0 ? 0 : totalMs / totalRuns).toFixed(3)} ms/run)\n`,
  );
}

function run(argv: readonly string[]): number {
  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${message}\n\n${USAGE}`);
    return 1;
  }

  if (parsed.help) {
    process.stdout.write(USAGE);
    return 0;
  }

  if (parsed.mode === 'combat') {
    runCombat(parsed);
  } else if (parsed.mode === 'run') {
    runRun(parsed);
  } else if (parsed.mode === 'report') {
    runReport(parsed);
  } else {
    runBoard(parsed);
  }
  return 0;
}

// Use process.exitCode (not process.exit) so buffered stdout fully flushes when
// output is redirected to a file — critical for the determinism diff.
process.exitCode = run(process.argv.slice(2));
