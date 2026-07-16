/**
 * Full-run sim data model (Stage 3 — `--mode run`).
 *
 * Like the board- and combat-sim types, everything here is plain, serializable data
 * mirroring the engine's discipline. The run-sim layer is PURE: zero React / React
 * Native imports and no ambient time or randomness on any deterministic path (only the
 * seeded run engine, driven through the pure run/ transition functions). Wall-clock
 * timing is measured at the CLI level and reported to stderr — it never enters these
 * deterministic shapes.
 */
import type { EncounterKind } from '../run';

/** The two run policies, by CLI name. `policy` is the measuring stick; `trivial` the floor. */
export type RunBotName = 'policy' | 'trivial';

/**
 * How a whole run ended. `victory` / `defeat` are the engine's terminal statuses;
 * `wedged` means the safety step-cap was hit while still active — the no-wedge gate
 * requires ZERO of these (recorded, never counted as a completion).
 */
export type RunOutcome = 'victory' | 'defeat' | 'wedged';

/** Death attribution: which encounter kind + base enemy killed the player, and on which floor. */
export interface RunDeath {
  /** Human-readable cause: `fight:slime` | `elite:skeleton` | `boss` (see runGame.ts). */
  readonly cause: string;
  readonly encounterKind: EncounterKind;
  readonly floor: number;
}

/**
 * The outcome of one driven run: its seed, terminal outcome, and the telemetry the
 * balance report aggregates. Deterministic — a function of (seed, bot) alone.
 */
export interface RunGameResult {
  readonly seed: number;
  readonly outcome: RunOutcome;
  /** Combat encounters ENTERED that are fights or elites (the boss is tracked separately). */
  readonly encounters: number;
  /** Total combat turns (player moves in fights) played across the whole run. */
  readonly moves: number;
  /** Gold held at the terminal state. */
  readonly gold: number;
  /** Relics owned at the terminal state (drafted + bought). */
  readonly relics: number;
  /** Whether the run entered the boss encounter. */
  readonly bossReached: boolean;
  /** Deepest map floor the player reached. */
  readonly floorReached: number;
  /** Run-driver transitions taken (wedge-guard telemetry; a real run ends far below the cap). */
  readonly steps: number;
  /** Death attribution (null on victory / wedge). */
  readonly death: RunDeath | null;
  /**
   * OPTIONAL Stage-4 balance-report telemetry (populated by `playRun`; absent in synthetic
   * fixtures). `relicIds` = relics owned at the terminal state (for the relic draft→win
   * correlation); `goldEarned` / `goldSpent` = cumulative positive / negative gold flow across
   * the run (gold flow report). Optional so pre-existing hand-built `RunGameResult`s still typecheck.
   */
  readonly relicIds?: readonly string[];
  readonly goldEarned?: number;
  readonly goldSpent?: number;
  /** Meta score this run banks (floors + encounters won + victory bonus); 0 for a wedge. */
  readonly score?: number;
}

/**
 * Safety cap on run-driver transitions per run. A full run resolves in well under this
 * many transitions (~13 floors × a handful of turns/phase each); the cap only guards
 * against a pathological non-terminating loop and bounds sim runtime. Mirrors the run
 * engine's own `driveRun` cap so the sim and the engine agree on "wedged".
 */
export const DEFAULT_RUN_STEP_CAP = 4000;

/** Full configuration of a run-harness run. */
export interface RunHarnessConfig {
  readonly bot: RunBotName;
  readonly games: number;
  readonly baseSeed: number;
  /** Safety cap on driver transitions per run; hitting it records a `wedged` outcome. */
  readonly stepCap: number;
  /**
   * OPTIONAL Stage-4 starting variant (by id). When set, every run in the harness starts from
   * this variant (`startRun(seed, variantId)`); when omitted, runs are vanilla — byte-identical
   * to the pre-variant harness, so the Stage-3 baseline reproduces exactly.
   */
  readonly variantId?: string;
}
