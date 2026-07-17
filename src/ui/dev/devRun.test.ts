/**
 * Dev-run construction: seed/variant pass-through, a forced Act-2 biome honoured by seed search, and
 * jump-to-act-2 producing a valid Act-2 run — all via pure engine flow.
 */
import { ACT2_BIOME_IDS } from '../../engine/run';
import { act2BiomeForSeed, buildDevRun, findSeedForAct2Biome } from './devRun';

describe('findSeedForAct2Biome', () => {
  it('finds a seed that lands on each Act-2 biome', () => {
    for (const target of ACT2_BIOME_IDS) {
      const seed = findSeedForAct2Biome(target, 1);
      expect(act2BiomeForSeed(seed)).toBe(target);
    }
  });
});

describe('buildDevRun', () => {
  it('passes the seed and variant straight through for a plain Act-1 start', () => {
    const run = buildDevRun({ seed: 42, variantId: 'glass-cannon' });
    expect(run.seed).toBe(42);
    expect(run.act).toBe(1);
    expect(run.variantId).toBe('glass-cannon');
    expect(run.phase.kind).toBe('awaiting_node');
  });

  it('forces the run onto the requested Act-2 biome', () => {
    for (const target of ACT2_BIOME_IDS) {
      const run = buildDevRun({ seed: 7, act2BiomeId: target });
      expect(run.act2BiomeId).toBe(target);
    }
  });

  it('jumps straight into Act 2 (advanceAct: act 2, Act-2 map, awaiting a node)', () => {
    const run = buildDevRun({ seed: 3, jumpToAct2: true });
    expect(run.act).toBe(2);
    expect(run.phase.kind).toBe('awaiting_node');
    expect(run.playerHp).toBeGreaterThan(0);
  });

  it('combines a forced biome with a jump to Act 2', () => {
    const target = ACT2_BIOME_IDS[2];
    const run = buildDevRun({ seed: 9, act2BiomeId: target, jumpToAct2: true });
    expect(run.act).toBe(2);
    expect(run.act2BiomeId).toBe(target);
  });

  it('threads a supplied unlocked-relic pool snapshot onto the run', () => {
    const pool = ['emberfang', 'rowan-chalice'];
    const run = buildDevRun({ seed: 1, unlockedRelicIds: pool });
    expect(run.unlockedRelicIds).toEqual(pool);
  });

  it('stamps every dev run with isDevRun (Act-1 and jump-to-Act-2), so banking cannot leak it', () => {
    expect(buildDevRun({ seed: 42 }).isDevRun).toBe(true);
    expect(buildDevRun({ seed: 3, jumpToAct2: true }).isDevRun).toBe(true);
    expect(buildDevRun({ seed: 7, variantId: 'glass-cannon' }).isDevRun).toBe(true);
  });
});
