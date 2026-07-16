/**
 * Sim stats CLI — the headless balance & determinism harness entry point.
 *
 *   npm run sim -- --games N --bot random|greedy --seed S --moves M [--timing]
 *
 * DETERMINISM CONTRACT: stdout is byte-for-byte identical across identical runs
 * (same --games/--bot/--seed/--moves). To keep that guarantee, the nondeterministic
 * wall-time timing is written to STDERR only — redirect stdout to a file and diff it
 * to prove determinism (see --help). This is the only file in src/engine/ that uses
 * Node globals (process / performance / console); all deterministic logic lives in
 * the pure modules it calls.
 */
import { runHarness } from './harness';
import { formatReport, formatTiming, summarize, summarizeTiming } from './stats';
import { DEFAULT_BOT_CONFIG } from './types';
import type { BotName, HarnessConfig } from './types';

interface ParsedArgs {
  readonly games: number;
  readonly bot: BotName;
  readonly seed: number;
  readonly moves: number;
  readonly timing: boolean;
  readonly help: boolean;
}

const DEFAULTS = {
  games: 100,
  bot: 'random' as BotName,
  seed: 42,
  moves: 20,
};

const USAGE = `Dungeon Cascades — sim stats CLI

Usage:
  npm run sim -- --games N --bot random|greedy --seed S --moves M [--timing]

Options:
  --games N     Number of seeded games to run           (default ${DEFAULTS.games})
  --bot NAME    Bot to drive the board: random | greedy (default ${DEFAULTS.bot})
  --seed S      Base seed; game i uses derive(seed, i)  (default ${DEFAULTS.seed})
  --moves M     Moves played per game                   (default ${DEFAULTS.moves})
  --timing      Print an extra "slowest move" line to stderr
  --help, -h    Show this help and exit

Determinism:
  stdout (the stats report) is byte-for-byte identical across identical runs.
  Wall-time timing is nondeterministic, so it is written to STDERR only — stdout
  stays clean. Prove it:
    npm run sim -- --games 1000 --bot greedy --seed 42 --moves 20 > a.txt
    npm run sim -- --games 1000 --bot greedy --seed 42 --moves 20 > b.txt
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
  let games = DEFAULTS.games;
  let bot: BotName = DEFAULTS.bot;
  let seed = DEFAULTS.seed;
  let moves = DEFAULTS.moves;
  let timing = false;
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--games':
        games = parseIntStrict('--games', argv[++i]);
        break;
      case '--seed':
        seed = parseIntStrict('--seed', argv[++i]);
        break;
      case '--moves':
        moves = parseIntStrict('--moves', argv[++i]);
        break;
      case '--bot': {
        const value = argv[++i];
        if (value !== 'random' && value !== 'greedy') {
          throw new Error(`--bot must be 'random' or 'greedy', got '${value ?? ''}'`);
        }
        bot = value;
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

  if (games < 1) {
    throw new Error(`--games must be >= 1, got ${games}`);
  }
  if (moves < 1) {
    throw new Error(`--moves must be >= 1, got ${moves}`);
  }

  return { games, bot, seed, moves, timing, help };
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

  const config: HarnessConfig = {
    bot: parsed.bot,
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

  return 0;
}

// Use process.exitCode (not process.exit) so buffered stdout fully flushes when
// output is redirected to a file — critical for the determinism diff.
process.exitCode = run(process.argv.slice(2));
