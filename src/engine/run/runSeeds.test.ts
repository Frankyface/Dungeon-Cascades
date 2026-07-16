/**
 * Run-seed derivation fixtures: determinism, tag separation, and structural equivalence
 * to the sim harness's deriveSeed (the mirrored fold documented in runSeeds.ts).
 */
import { deriveSeed as simDeriveSeed } from '../sim/seeds';
import { deriveSeed, draftSeedFor, mapSeedFor, RUN_TAG_DRAFT, RUN_TAG_MAP } from './runSeeds';

describe('run seed derivation', () => {
  it('is deterministic: same (seed, tag) ⇒ same sub-seed', () => {
    expect(deriveSeed(42, RUN_TAG_MAP)).toBe(deriveSeed(42, RUN_TAG_MAP));
    expect(mapSeedFor(1234)).toBe(mapSeedFor(1234));
    expect(draftSeedFor(7, 3)).toBe(draftSeedFor(7, 3));
  });

  it('separates streams: distinct tags / seeds / node indices give distinct sub-seeds', () => {
    expect(deriveSeed(42, RUN_TAG_MAP)).not.toBe(deriveSeed(42, RUN_TAG_DRAFT));
    expect(mapSeedFor(1)).not.toBe(mapSeedFor(2));
    expect(draftSeedFor(7, 3)).not.toBe(draftSeedFor(7, 4));
    expect(mapSeedFor(99)).not.toBe(draftSeedFor(99, 0));
  });

  it('produces uint32 values', () => {
    for (const s of [0, 1, 42, 2026, 0x7fffffff]) {
      const v = mapSeedFor(s);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(0x100000000);
    }
  });

  it('uses the SAME fold as sim/seeds.ts (byte-identical construction)', () => {
    // The layering choice mirrors, not imports; this pins that the arithmetic matches.
    expect(deriveSeed(42, RUN_TAG_MAP)).toBe(simDeriveSeed(42, RUN_TAG_MAP));
    expect(deriveSeed(2026, 5)).toBe(simDeriveSeed(2026, 5));
  });
});
