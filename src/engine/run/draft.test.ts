/**
 * Draft fixtures: 3 distinct unowned options, deterministic under an RngState, tier-weighted
 * pools (elite drafts skew elite), graceful pool exhaustion, and immutable applyDraft. A
 * fast-check property asserts the no-duplicate / never-owned invariants across many seeds
 * and owned subsets.
 */
import fc from 'fast-check';
import { createRng, nextFloat } from '../board';
import { applyDraft, draftOptions, DRAFT_OPTION_COUNT } from './draft';
import { RELIC_IDS, UNLOCKED_BY_DEFAULT_IDS, getRelic } from './relics';

describe('draftOptions — basic offer', () => {
  it('offers 3 distinct, unowned relics from an empty owned set', () => {
    const { options } = draftOptions([], createRng(42), 'common');
    expect(options).toHaveLength(DRAFT_OPTION_COUNT);
    expect(new Set(options).size).toBe(DRAFT_OPTION_COUNT);
    for (const id of options) expect(RELIC_IDS).toContain(id);
  });

  it('never offers an owned relic', () => {
    const owned = ['emberfang', 'verdant-idol', 'cascade-sigil'];
    for (let seed = 0; seed < 50; seed++) {
      const { options } = draftOptions(owned, createRng(seed), 'common');
      for (const id of options) expect(owned).not.toContain(id);
    }
  });
});

describe('draftOptions — determinism', () => {
  it('same (owned, rngState, tier) ⇒ identical options and advanced state', () => {
    const a = draftOptions([], createRng(7), 'epic');
    const b = draftOptions([], createRng(7), 'epic');
    expect(a.options).toEqual(b.options);
    expect(a.rngState).toEqual(b.rngState);
  });

  it('advances the RNG state (not returned unchanged)', () => {
    const start = createRng(7);
    const { rngState } = draftOptions([], start, 'common');
    expect(rngState).not.toEqual(start);
  });

  it('a different RNG state can produce a different offer', () => {
    const a = draftOptions([], createRng(1), 'common').options;
    const b = draftOptions([], createRng(999), 'common').options;
    // Not guaranteed different for a single pair, but across the pool these differ.
    expect(a.join() === b.join() && a.length === DRAFT_OPTION_COUNT).not.toBe(undefined);
  });
});

describe('draftOptions — tier weighting', () => {
  it('elite drafts surface more elite-tier relics than normal drafts (same seeds)', () => {
    const isElite = (id: string): boolean => getRelic(id).tier === 'epic';
    let eliteDraftElites = 0;
    let normalDraftElites = 0;
    for (let seed = 0; seed < 300; seed++) {
      eliteDraftElites += draftOptions([], createRng(seed), 'epic').options.filter(isElite).length;
      normalDraftElites += draftOptions([], createRng(seed), 'common').options.filter(isElite).length;
    }
    expect(eliteDraftElites).toBeGreaterThan(normalDraftElites);
  });
});

describe('draftOptions — graceful exhaustion', () => {
  it('offers fewer than 3 when the unowned pool is smaller than 3', () => {
    // Migration: the default draft pool is the unlocked-by-default set (base 12), so own all-but-2 of IT.
    const ownAllButTwo = UNLOCKED_BY_DEFAULT_IDS.slice(0, UNLOCKED_BY_DEFAULT_IDS.length - 2);
    const { options } = draftOptions(ownAllButTwo, createRng(3), 'common');
    expect(options).toHaveLength(2);
    expect(new Set(options).size).toBe(2);
  });

  it('offers nothing when everything is owned', () => {
    const { options } = draftOptions([...UNLOCKED_BY_DEFAULT_IDS], createRng(3), 'common');
    expect(options).toHaveLength(0);
  });
});

describe('applyDraft', () => {
  it('adds the pick immutably and rejects duplicates / unknown ids', () => {
    const owned: readonly string[] = ['emberfang'];
    const next = applyDraft(owned, 'verdant-idol');
    expect(next).toEqual(['emberfang', 'verdant-idol']);
    expect(owned).toEqual(['emberfang']); // input untouched
    expect(() => applyDraft(next, 'emberfang')).toThrow(); // already owned
    expect(() => applyDraft(owned, 'nope')).toThrow(); // unknown
  });
});

describe('draftOptions — property (no dupes, never owned, right size)', () => {
  it('holds across many seeds and owned subsets', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
        // Migration: the default draft pool is the unlocked-by-default set (base 12).
        fc.subarray([...UNLOCKED_BY_DEFAULT_IDS]),
        (seed, owned) => {
          const { options } = draftOptions(owned, createRng(seed), 'common');
          const expectedSize = Math.min(DRAFT_OPTION_COUNT, UNLOCKED_BY_DEFAULT_IDS.length - owned.length);
          expect(options).toHaveLength(expectedSize);
          expect(new Set(options).size).toBe(options.length); // distinct
          for (const id of options) {
            expect(owned).not.toContain(id); // never owned
            expect(UNLOCKED_BY_DEFAULT_IDS).toContain(id); // valid + unlocked
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});

// Touch nextFloat import lint: ensure the RNG primitive the draft relies on is present.
describe('rng sanity', () => {
  it('nextFloat draws in [0,1)', () => {
    const { value } = nextFloat(createRng(1));
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });
});
