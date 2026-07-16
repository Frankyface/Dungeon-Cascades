/**
 * All tunable UI constants for the naked board in ONE place: the move timer, the
 * animation timings, the board layout metrics, and the drag hysteresis threshold.
 *
 * These are the UI-layer knobs only. The board size / color count / orthogonal
 * rule live in the ENGINE (`src/engine/board/config.ts`) — the UI reads them from
 * the engine so there is a single source of truth for the grid shape.
 *
 * Rationale for the values is inline; they are placeholder-grade and meant to be
 * tuned on-device by Cam at the fun gate.
 */

/**
 * The drag move timer, in milliseconds. Locked at ~5s per docs/decisions.md
 * (2026-07-15 board defaults). The engine is timer-agnostic — this countdown
 * lives entirely in the UI and only starts once the held tile first moves.
 */
export const MOVE_TIMER_MS = 5000;

/**
 * Animation timings (ms). Chosen fast enough to feel snappy but slow enough to
 * read the cascade. Documented here so tuning is a one-file change.
 */
export const ANIM = {
  /** Pick-up lift: how long the tile takes to pop up under the finger. */
  pickupMs: 90,
  /** Per-swap slide of the neighbour into the vacated cell during a drag. */
  swapMs: 110,
  /** Cleared group flash/fade-out before tiles fall. */
  clearMs: 240,
  /** Falling survivors + spawning tiles dropping into place. */
  fallMs: 300,
  /** Small beat between two cascade waves so each wave reads separately. */
  waveGapMs: 110,
} as const;

/** Pick-up / held-tile scale (how much the lifted tile grows under the finger). */
export const PICKUP_SCALE = 1.14;
/** Extra pop scale applied to a group as it clears. */
export const CLEAR_POP_SCALE = 1.28;

/**
 * Board layout metrics. `screenFraction` of the available width is used for the
 * board, capped at `maxWidth` so it stays reasonable on tablets. `padding` is the
 * inset inside the Skia canvas around the grid; `gap` is the space between tiles;
 * `radiusRatio` is the tile corner radius as a fraction of the cell size.
 */
export const LAYOUT = {
  screenFraction: 0.94,
  maxWidth: 520,
  padding: 12,
  gap: 6,
  radiusRatio: 0.18,
} as const;

/**
 * Drag step-commit hysteresis. A step commits only once the finger has moved past
 * the cell boundary by `pitch/2 + margin`, where `margin = pitch * commitMarginRatio`.
 * Because committing re-centres the held tile, this creates a dead-zone of width
 * `2 * margin` straddling the true boundary, so tiny jitter near an edge does NOT
 * bounce the tile back and forth between two cells.
 */
export const COMMIT_MARGIN_RATIO = 0.18;
