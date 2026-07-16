/**
 * Public API of the Dungeon Cascades board engine.
 *
 * Consumers: headless sim bots and the Skia UI (which animates each resolution
 * step). Everything exported here is pure, deterministic, and serializable — no
 * React / React Native imports, and no ambient time or randomness (seeded PRNG only).
 */

// Config & constants (tunable knobs).
export {
  COLS,
  ROWS,
  CELL_COUNT,
  TILE_COLORS,
  MATCH_MIN,
  DIRECTIONS,
  MAX_PATH_STEPS,
} from './config';

// Data model types.
export type {
  Board,
  Position,
  RngState,
  TileColor,
  TileSource,
  Direction,
  Path,
  PathValidation,
  Swap,
  ClearedGroup,
  Fall,
  Spawn,
  ResolutionWave,
  MoveResolution,
} from './types';

// Seeded RNG.
export { createRng, isRngState, toRngState, nextFloat, nextInt } from './rng';

// Refill sources (the swappable seam).
export { uniformTileSource } from './tileSource';

// Board data helpers.
export {
  indexOf,
  positionOf,
  inBounds,
  tileAt,
  withTiles,
  comparePositions,
  boardFromRows,
  boardToRows,
} from './board';

// Board creation.
export { createBoard } from './create';

// Path primitives (bots / UI).
export { step, neighbors, isValidStep, validatePath, applyPath } from './path';

// Match detection.
export { findMatches } from './match';

// Gravity + refill.
export { collapse } from './gravity';

// Move resolution.
export { resolveMove } from './resolve';
