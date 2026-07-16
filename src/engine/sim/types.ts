/**
 * Sim-harness data model. Everything here is plain, serializable data (no
 * classes, no hidden state) mirroring the board engine's discipline. The sim
 * layer is PURE: zero React / React Native imports, and no ambient time or
 * randomness in any deterministic path (only the seeded engine PRNG). Wall-clock
 * timing lives in `MoveStat.timeMs` and is the ONLY nondeterministic field — it
 * is reported to stderr and never influences stdout (see cli.ts).
 */
import type { Board, Path, RngState } from '../board';

/**
 * Tunable bot knobs. Kept in one object so a game/harness run threads a single
 * config. All fields have documented defaults in {@link DEFAULT_BOT_CONFIG}.
 */
export interface BotConfig {
  /** randomBot: minimum drag-path length (inclusive). */
  readonly randomMinSteps: number;
  /** randomBot: maximum drag-path length (inclusive). Bounded well under MAX_PATH_STEPS. */
  readonly randomMaxSteps: number;
  /** greedyBot: exhaustive search depth (max drag-path length it will consider). */
  readonly greedyMaxDepth: number;
}

/**
 * Defaults:
 * - random path length ~ Uniform[1, 8] (8 << MAX_PATH_STEPS=32).
 * - greedy exhaustive search to depth 4 (drag paths up to 4 steps).
 */
export const DEFAULT_BOT_CONFIG: BotConfig = {
  randomMinSteps: 1,
  randomMaxSteps: 8,
  greedyMaxDepth: 4,
};

/** What a bot returns: the chosen path plus its advanced decision-RNG state. */
export interface BotDecision {
  readonly path: Path;
  readonly rngState: RngState;
}

/**
 * A bot is a pure function of the board, its own decision-RNG state, and config.
 * It NEVER touches the move/refill RNG stream (that is the harness's job), and it
 * never reads wall-clock time. Same inputs ⇒ same decision, always.
 */
export type Bot = (board: Board, rngState: RngState, config: BotConfig) => BotDecision;

/** The two Stage-1 bots. */
export type BotName = 'random' | 'greedy';

/** Per-move statistics collected while a game is played. */
export interface MoveStat {
  /** `MoveResolution.totalCombos` — cleared groups summed across every cascade wave. */
  readonly combos: number;
  /** `MoveResolution.waves.length` — cascade depth (0 = the move made no match). */
  readonly cascadeDepth: number;
  /** Wall-time (ms) of the resolveMove call. NONDETERMINISTIC — stderr only. */
  readonly timeMs: number;
}

/** The outcome of one game: the game's seed and its per-move stats. */
export interface GameResult {
  readonly seed: number;
  readonly moves: readonly MoveStat[];
}

/** Full configuration of a harness run. */
export interface HarnessConfig {
  readonly bot: BotName;
  readonly games: number;
  readonly baseSeed: number;
  readonly moves: number;
  readonly botConfig: BotConfig;
}
