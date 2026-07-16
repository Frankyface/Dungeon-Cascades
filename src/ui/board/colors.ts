/**
 * Placeholder-grade tile palette: one hex color per engine `TileColor` code.
 *
 * The hues are picked to stay distinguishable for the common forms of color
 * blindness (a red / blue / yellow / teal / purple spread rather than the classic
 * red-vs-green trap) — this is cheap insurance, not a full accessibility pass. All
 * art here is placeholder; final art is a later stage.
 */
import { TILE_COLORS } from '../../engine/board';
import type { TileColor } from '../../engine/board';

/** Engine color code -> fill hex. Every code in `TILE_COLORS` has an entry. */
export const TILE_FILL: Readonly<Record<TileColor, string>> = {
  R: '#e5484d', // red
  G: '#30a46c', // green (kept saturated + paired with distinct luminance)
  B: '#3b82f6', // blue
  Y: '#f5c542', // amber/yellow
  P: '#a855f7', // purple
};

/** A slightly darker rim color per tile, for a subtle bevel on the rounded rect. */
export const TILE_RIM: Readonly<Record<TileColor, string>> = {
  R: '#b93036',
  G: '#1e7a4d',
  B: '#2563c9',
  Y: '#c99a1f',
  P: '#7c3aed',
};

/** Board background / gutter and HUD colors, gathered so theming is one place. */
export const BOARD_COLORS = {
  screenBg: '#0f1020',
  boardBg: '#191a2e',
  gutter: '#12132340',
  timerTrack: '#2a2c46',
  timerFill: '#8ad0ff',
  timerFillLow: '#ff6b6b',
  hudText: '#e8e8f0',
  hudSubtle: '#9aa0c0',
  comboText: '#ffd76b',
} as const;

/** Compile-time guard: fail loudly if a color code lacks a fill (kept in sync). */
export function assertPaletteComplete(): void {
  for (const code of TILE_COLORS) {
    if (!TILE_FILL[code]) {
      throw new Error(`TILE_FILL missing color code '${code}'`);
    }
  }
}
