/**
 * The per-biome UI theme registry: every biome resolves to a complete, valid, DISTINCT swatch set,
 * `dungeon` keeps today's look (Act 1 unchanged), and the run helpers pick the current act's biome.
 */
import { startRun } from '../../engine/run';
import { BIOME_IDS, getBiome } from '../../engine/run';
import { BIOME_THEMES, biomeTheme, runBiomeId, runTheme } from './biomeTheme';
import { RUN_COLORS } from './runColors';

const HEX = /^#[0-9a-fA-F]{6}$/;

describe('biomeTheme', () => {
  it('has a complete theme for every biome id in the engine registry', () => {
    for (const id of BIOME_IDS) {
      const theme = biomeTheme(id);
      expect(theme.id).toBe(id);
      expect(theme.name).toBe(getBiome(id).name); // name derives from the registry, never drifts
      for (const slot of [theme.accent, theme.onAccent, theme.ring, theme.tint, theme.edge]) {
        expect(slot).toMatch(HEX);
      }
    }
  });

  it('keeps the dungeon (Act 1) look byte-identical to the base RUN_COLORS accents', () => {
    const d = biomeTheme('dungeon');
    expect(d.accent).toBe(RUN_COLORS.accent);
    expect(d.ring).toBe(RUN_COLORS.currentRing);
    expect(d.tint).toBe(RUN_COLORS.screenBg);
    expect(d.edge).toBe(RUN_COLORS.edge);
  });

  it('gives each Act-2 biome a DISTINCT accent (no two biomes share the tint)', () => {
    const accents = BIOME_IDS.map((id) => biomeTheme(id).accent);
    expect(new Set(accents).size).toBe(accents.length);
    const tints = BIOME_IDS.map((id) => biomeTheme(id).tint);
    expect(new Set(tints).size).toBe(tints.length);
  });

  it('exposes a theme entry for exactly the registry biomes', () => {
    expect(Object.keys(BIOME_THEMES).sort()).toEqual([...BIOME_IDS].sort());
  });
});

describe('runBiomeId / runTheme', () => {
  it('reads the dungeon while in Act 1', () => {
    const run = startRun(7);
    expect(run.act).toBe(1);
    expect(runBiomeId(run)).toBe('dungeon');
    expect(runTheme(run).id).toBe('dungeon');
  });

  it('reads the seeded Act-2 biome once the run is in Act 2', () => {
    const run = startRun(7);
    const act2 = { ...run, act: 2 as const };
    expect(runBiomeId(act2)).toBe(run.act2BiomeId);
    expect(runTheme(act2).id).toBe(run.act2BiomeId);
  });
});
