/**
 * Combat-sim data model. Like the board-sim types, everything here is plain,
 * serializable data mirroring the engine's discipline. The combat-sim layer is
 * PURE: zero React / React Native imports, and no ambient time or randomness on any
 * deterministic path (only the seeded engine PRNG). Wall-clock timing is measured at
 * the CLI level and reported to stderr — it never enters these deterministic shapes.
 */
import type { Board, RngState } from '../board';
import type { CombatConfig, Enemy, EnemyId } from '../combat';
import type { BotConfig } from './types';

/** The two combat bots, by CLI name. */
export type CombatBotName = 'greedy-combat' | 'random';

/**
 * Default safety cap on turns per encounter. Every Stage-2 enemy attacks on a bounded
 * cadence (slime every turn, skeleton 2 of 3, bat 1 of 2), so player HP strictly
 * trends down and a real fight ends in well under this many turns — the cap only
 * guards against a pathological non-terminating loop and bounds sim runtime.
 */
export const DEFAULT_MAX_TURNS = 200;

/**
 * The read-only context a combat bot sees when choosing a move. Wider than the
 * board `Bot`'s config because a combat bot targets THIS enemy (affinity) and reads
 * the player's HP (whether to value healing) — but it still never touches the
 * move/refill RNG (the encounter owns that) and never reads the clock.
 */
export interface CombatBotContext {
  readonly enemy: Enemy;
  readonly combatConfig: CombatConfig;
  readonly botConfig: BotConfig;
  readonly playerHp: number;
  readonly playerMaxHp: number;
}

/**
 * A combat bot: a pure function of the board, its own decision-RNG state, and the
 * combat context. Returns the chosen path plus its advanced decision-RNG. Same
 * inputs ⇒ same decision, always. (greedy-combat consumes no RNG and returns the
 * state unchanged; random threads it.)
 */
export type CombatBot = (board: Board, rngState: RngState, ctx: CombatBotContext) => {
  readonly path: import('../board').Path;
  readonly rngState: RngState;
};

/** How an encounter ended. `timeout` = the safety turn cap was hit (recorded, not a win). */
export type EncounterOutcome = 'won' | 'lost' | 'timeout';

/** Per-move combat statistics collected while an encounter is played. Deterministic. */
export interface CombatMoveStat {
  /** Rounded damage the move dealt to the enemy (pre-floor; the number the curve rolled). */
  readonly damage: number;
  /** Rounded heal the move rolled for the player (pre-cap). */
  readonly heal: number;
  /** Realized `MoveResolution.totalCombos` (all cascade waves) for the move. */
  readonly combos: number;
}

/** The outcome of one played encounter: its seed, terminal outcome, turn count, per-move stats. */
export interface CombatGameResult {
  readonly seed: number;
  readonly outcome: EncounterOutcome;
  /** Player turns played (== moves.length). For a win, this is turns-to-win. */
  readonly turns: number;
  readonly moves: readonly CombatMoveStat[];
}

/** Full configuration of a combat-harness run. */
export interface CombatHarnessConfig {
  readonly enemy: EnemyId;
  readonly bot: CombatBotName;
  readonly games: number;
  readonly baseSeed: number;
  readonly botConfig: BotConfig;
  readonly combatConfig: CombatConfig;
  /** Safety cap on turns per encounter; hitting it records a `timeout` (see combatGame.ts). */
  readonly maxTurns: number;
}
