import { createRng, nextFloat, nextInt } from './rng';
import type { RngState } from './types';

describe('seeded PRNG (mulberry32)', () => {
  it('createRng normalizes a seed to a uint32 state', () => {
    expect(createRng(0)).toEqual({ a: 0 });
    expect(createRng(1)).toEqual({ a: 1 });
    // Negative / oversized seeds fold into uint32 range deterministically.
    expect(createRng(-1)).toEqual({ a: 0xffffffff });
  });

  it('nextFloat is pure — it never mutates the input state', () => {
    const state: RngState = createRng(42);
    const before = { ...state };
    nextFloat(state);
    expect(state).toEqual(before);
  });

  it('nextFloat returns a value in [0, 1) and an advanced state', () => {
    let state = createRng(12345);
    for (let i = 0; i < 1000; i++) {
      const result = nextFloat(state);
      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.value).toBeLessThan(1);
      expect(result.state).not.toEqual(state);
      state = result.state;
    }
  });

  it('is deterministic: the same seed reproduces the same stream', () => {
    const streamFor = (seed: number): number[] => {
      let state = createRng(seed);
      const out: number[] = [];
      for (let i = 0; i < 20; i++) {
        const r = nextFloat(state);
        out.push(r.value);
        state = r.state;
      }
      return out;
    };
    expect(streamFor(7)).toEqual(streamFor(7));
    expect(streamFor(7)).not.toEqual(streamFor(8));
  });

  it('nextInt returns integers in [0, bound)', () => {
    let state = createRng(999);
    const counts = new Array(5).fill(0);
    for (let i = 0; i < 5000; i++) {
      const r = nextInt(state, 5);
      expect(Number.isInteger(r.value)).toBe(true);
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThan(5);
      counts[r.value]++;
      state = r.state;
    }
    // Every bucket should be hit at least once over 5000 draws (sanity, not a stats test).
    for (const c of counts) {
      expect(c).toBeGreaterThan(0);
    }
  });
});
