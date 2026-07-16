/**
 * Board engine configuration — the tunable constants of Dungeon Cascades'
 * match-3 core. These are deliberately gathered in one module so balance tuning
 * (board size, color count, path limits) is a single-file change.
 *
 * PURE ENGINE: no React / React Native imports; no wall-clock or ambient
 * randomness — a seeded PRNG is the only source of entropy.
 * See CLAUDE.md and docs/decisions.md (2026-07-15 board defaults).
 */

/** Number of columns (board width). Default P&D-standard 6. */
export const COLS = 6;

/** Number of rows (board height). Default P&D-standard 5. */
export const ROWS = 5;

/** Total number of cells on a default board. */
export const CELL_COUNT = COLS * ROWS;

/**
 * The tile colors, as compact single-character codes (JSON-safe and readable in
 * hand-computed fixtures). Five colors per the Stage 1 board defaults.
 */
export const TILE_COLORS = ['R', 'G', 'B', 'Y', 'P'] as const;

/** A single tile color. */
export type TileColor = (typeof TILE_COLORS)[number];

/** The minimum run length that counts as a match. */
export const MATCH_MIN = 3;

/**
 * Orthogonal drag directions (v1 is orthogonal-only; diagonals are a fun-gate
 * question — see docs/master_plan.md open questions).
 */
export const DIRECTIONS = ['up', 'down', 'left', 'right'] as const;

/** A single orthogonal drag step. */
export type Direction = (typeof DIRECTIONS)[number];

/**
 * Safety cap on drag-path length. The real limit is the ~5s UI timer, but the
 * engine — which accepts an already-completed path — needs a bound to reject
 * pathological input. Generous relative to the 30-cell board; cheap to tune.
 */
export const MAX_PATH_STEPS = 32;

/**
 * Defensive cap on cascade waves in one move resolution. The uniform tile source
 * stabilizes in a handful of waves (a 30-cell board physically cannot sustain long
 * chains), so exceeding this means an injected `TileSource` is broken (e.g. always
 * emitting one color, re-matching forever) — `resolveMove` THROWS rather than
 * spinning: that is a programming error, not a reachable game state.
 */
export const MAX_CASCADE_WAVES = 100;
