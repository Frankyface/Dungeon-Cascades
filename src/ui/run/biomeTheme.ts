/**
 * Per-biome UI THEME — the placeholder-grade tint set each biome paints the run chrome (map, HUD,
 * encounter chrome) with. The Stage-6 content pass covered mechanics/distinctiveness, not art
 * direction, so `content-biomes.md` ships palette DIRECTIONS (verbatim on `Biome.paletteDirection`),
 * not hexes; this module is where the UI wave PICKS the placeholder swatches from those directions.
 * Final art is a later stage — these are readable, distinct stand-ins, documented against the
 * direction text so an artist can swap the values without touching any screen.
 *
 * Act 1 is ALWAYS `dungeon` and KEEPS today's look (the `dungeon` theme mirrors `RUN_COLORS`, so an
 * Act-1 run is visually byte-identical to before). Act 2 tints by the run's seeded Act-2 biome. Run
 * screens call `runTheme(state)` (the CURRENT act's biome) so the chrome shifts when the act does.
 *
 * PALETTE CHOICES (direction → picked hexes), documented per spec:
 *   dungeon          — base game palette (no Stage-6 art direction): the existing RUN_COLORS accents.
 *   glacial-crypt    — "Blue ice / brittle rime; a dead kingdom entombed in blue" → glacier-blue
 *                      accent, bright-ice ring, cold-dark-blue wash.
 *   emberworks       — "living slag, molten red/orange, ash-grey wraps" → forge red-orange accent,
 *                      ember-glow ring, ash-dark warm wash.
 *   rotwood          — "Rot green + waterlogged deadwood; Green is the trap color" → moss/rot-green
 *                      accent, sickly-bright-green ring, deep-forest-dark wash.
 *   sunken-catacombs — "Black tidewater / drowned crypt; lantern-pale light" → deep-tidewater teal
 *                      accent, lantern-pale ring, drowned-dark wash.
 *
 * No React imports; deterministic; a pure lookup. Fully Jest-testable against the biome registry.
 */
import type { BiomeId } from '../../engine/combat';
import type { RunState } from '../../engine/run';
import { getBiome } from '../../engine/run';
import { RUN_COLORS } from './runColors';

/** One biome's themed color slots. `tint` is a solid screen background (a subtle biome wash). */
export interface BiomeTheme {
  readonly id: BiomeId;
  /** Display name (from the biome registry, so it never drifts). */
  readonly name: string;
  /** Primary accent — buttons, badges, the act indicator, the biome name pill. */
  readonly accent: string;
  /** Text/foreground color that reads on `accent`. */
  readonly onAccent: string;
  /** Glow / current-node ring / active map edge — the biome's brightest signature color. */
  readonly ring: string;
  /** A subtle full-screen background wash for the biome (Act 1 keeps the base screen bg). */
  readonly tint: string;
  /** Border/edge color for biome-tinted panels (the darker cousin of `accent`). */
  readonly edge: string;
}

/**
 * The five biome themes. `dungeon` MIRRORS `RUN_COLORS` exactly (Act 1 keeps today's look); the four
 * Act-2 biomes carry placeholder swatches derived from each biome's `paletteDirection` (see file doc).
 */
export const BIOME_THEMES: Record<BiomeId, BiomeTheme> = {
  dungeon: {
    id: 'dungeon',
    name: getBiome('dungeon').name,
    accent: RUN_COLORS.accent, // '#38406e'
    onAccent: RUN_COLORS.text,
    ring: RUN_COLORS.currentRing, // '#8ad0ff'
    tint: RUN_COLORS.screenBg,
    edge: RUN_COLORS.edge, // '#3a3d63'
  },
  'glacial-crypt': {
    id: 'glacial-crypt',
    name: getBiome('glacial-crypt').name,
    accent: '#2b5f8a', // glacier blue
    onAccent: '#eaf6ff',
    ring: '#9fe3ff', // bright brittle ice
    tint: '#0a1420', // cold dark blue
    edge: '#245073',
  },
  emberworks: {
    id: 'emberworks',
    name: getBiome('emberworks').name,
    accent: '#8a3a1e', // forge red-orange (molten slag)
    onAccent: '#ffece0',
    ring: '#ff9d4d', // ember glow
    tint: '#180d08', // ash-dark, warm
    edge: '#6f2f18',
  },
  rotwood: {
    id: 'rotwood',
    name: getBiome('rotwood').name,
    accent: '#3a6b2f', // moss / rot green
    onAccent: '#eefbe6',
    ring: '#8fe06a', // sickly bright green (the trap color's lure)
    tint: '#0c1508', // deep forest dark
    edge: '#2f5726',
  },
  'sunken-catacombs': {
    id: 'sunken-catacombs',
    name: getBiome('sunken-catacombs').name,
    accent: '#1f4d55', // deep tidewater teal
    onAccent: '#e6f6f1',
    ring: '#cfeae0', // lantern-pale light
    tint: '#08130f', // drowned dark
    edge: '#1a3f46',
  },
};

/** Fetch a biome's theme. Falls back to the dungeon theme on an unknown id (never throws in UI). */
export function biomeTheme(biomeId: BiomeId): BiomeTheme {
  return BIOME_THEMES[biomeId] ?? BIOME_THEMES.dungeon;
}

/** The biome a run is CURRENTLY in: the seeded Act-2 biome once in Act 2, else the default dungeon. */
export function runBiomeId(state: RunState): BiomeId {
  return state.act === 2 ? state.act2BiomeId : 'dungeon';
}

/** The theme for a run's CURRENT act (Act 1 → dungeon/today's look; Act 2 → the seeded biome). */
export function runTheme(state: RunState): BiomeTheme {
  return biomeTheme(runBiomeId(state));
}
