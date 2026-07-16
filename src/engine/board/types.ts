/**
 * Serializable data model for the board engine.
 *
 * Every shape here is plain JSON-safe data (no classes, no methods, no hidden
 * state) so that board state can cross the engine/UI boundary and be snapshotted
 * by tests and the sim harness. All fields are `readonly` — the engine never
 * mutates; each operation returns a new object.
 */
import type { TileColor, Direction } from './config';

/** A grid coordinate. `row` 0 is the TOP row; `col` 0 is the LEFT column. */
export interface Position {
  readonly col: number;
  readonly row: number;
}

/**
 * Full board state. `tiles` is a dense, row-major flat array:
 * `tiles[row * cols + col]`. A board is self-describing (it carries its own
 * dimensions) so match/gravity/path logic works on any size, while `createBoard`
 * uses the configured defaults.
 */
export interface Board {
  readonly cols: number;
  readonly rows: number;
  readonly tiles: readonly TileColor[];
}

/**
 * Explicitly threaded PRNG state (mulberry32). A single uint32 accumulator wrapped
 * in an object so it stays serializable and extensible. Same state in ⇒ same
 * draw out, always.
 */
export interface RngState {
  readonly a: number;
}

/**
 * A supplier of refill tiles. The seam that lets a bag/weighted source drop in
 * later without engine changes (see docs/decisions.md, refill RNG verdict). The
 * default implementation is uniform over the colors. `next` is pure: it threads
 * RngState in and out.
 */
export interface TileSource {
  next(state: RngState): { readonly color: TileColor; readonly state: RngState };
}

/**
 * A drag-path move: pick up the tile at `start`, then drag it through the grid
 * one orthogonal `step` at a time. The engine is timer-agnostic — it accepts an
 * already-completed path.
 */
export interface Path {
  readonly start: Position;
  readonly steps: readonly Direction[];
}

/** Result of validating a path against a board. */
export type PathValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

/** One tile-for-tile swap during the drag (UI replays these in order). */
export interface Swap {
  readonly a: Position;
  readonly b: Position;
}

/** One cleared combo: a connected same-color group of matched tiles. */
export interface ClearedGroup {
  readonly color: TileColor;
  readonly positions: readonly Position[];
}

/** A surviving tile falling straight down its column during gravity. */
export interface Fall {
  readonly from: Position;
  readonly to: Position;
}

/** A newly spawned tile entering from the top. */
export interface Spawn {
  readonly position: Position;
  readonly color: TileColor;
}

/**
 * One resolution wave: the matches cleared, the tiles that fell to fill the gaps,
 * and the tiles spawned in from the top. Waves repeat until the board is stable.
 */
export interface ResolutionWave {
  readonly clearedGroups: readonly ClearedGroup[];
  readonly falls: readonly Fall[];
  readonly spawns: readonly Spawn[];
}

/**
 * The complete, replayable result of resolving one move.
 * - `swaps`: the drag sequence (UI replays the pickup/drag).
 * - `waves`: each cascade wave in order.
 * - `finalBoard`: the stable board after all cascades.
 * - `totalCombos`: total cleared groups across every wave.
 * - `rngState`: the advanced RNG state (explicit threading).
 */
export interface MoveResolution {
  readonly swaps: readonly Swap[];
  readonly waves: readonly ResolutionWave[];
  readonly finalBoard: Board;
  readonly totalCombos: number;
  readonly rngState: RngState;
}

export type { TileColor, Direction } from './config';
