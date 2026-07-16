/**
 * Tile sources — the swappable, seeded seam for refills (docs/decisions.md,
 * 2026-07-15 refill RNG verdict). Stage 1 default is uniform over the colors;
 * a bag/weighted source can implement the same `TileSource` interface later
 * without any engine changes.
 */
import { TILE_COLORS } from './config';
import { nextInt } from './rng';
import type { TileSource } from './types';

/** Uniform-random refill: each of the configured colors is equally likely. */
export const uniformTileSource: TileSource = {
  next(state) {
    const { value, state: nextState } = nextInt(state, TILE_COLORS.length);
    return { color: TILE_COLORS[value], state: nextState };
  },
};
