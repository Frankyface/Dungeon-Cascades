/**
 * DEV-MODE STORAGE SEPARATION (spec §8): dev unlock-all / reset must write ONLY to the dev slot and
 * NEVER touch the normal meta key. Proven purely with two in-memory stores standing in for the two
 * async-storage keys, plus a constant check that the two keys are distinct.
 */
import { INITIAL_META_STATE, InMemoryMetaStore, RELIC_IDS, UNLOCKED_BY_DEFAULT_IDS, devUnlockAllMeta } from '../../engine/run';
import { DEV_META_STORAGE_KEY, META_STORAGE_KEY } from '../run/metaStorageKeys';
import { devResetInto, devUnlockAllInto, loadDevMeta } from './devMetaLedger';

describe('dev/normal storage keys', () => {
  it('the dev storage key is DISTINCT from the normal meta key', () => {
    expect(DEV_META_STORAGE_KEY).not.toBe(META_STORAGE_KEY);
  });
});

describe('devUnlockAllInto — writes ONLY to the dev store, never the normal one', () => {
  it('fully unlocks the dev slot and leaves the real profile untouched', () => {
    const normal = new InMemoryMetaStore();
    const dev = new InMemoryMetaStore();
    const realProfile = { ...INITIAL_META_STATE, score: 123 };
    normal.save(realProfile);

    const unlocked = devUnlockAllInto(dev);

    // Dev slot is fully unlocked...
    expect(dev.load()).toEqual(unlocked);
    expect(unlocked.unlockedRelicIds).toEqual([...RELIC_IDS]);
    expect(unlocked.bossRushUnlocked).toBe(true);
    expect(unlocked.godOfWarUnlocked).toBe(true);
    // ...and the NORMAL profile is byte-identical to before (no leak).
    expect(normal.load()).toEqual(realProfile);
    expect(normal.load()!.unlockedRelicIds).toEqual([...UNLOCKED_BY_DEFAULT_IDS]); // still just the base 12
  });
});

describe('devResetInto — resets ONLY the dev store', () => {
  it('wipes the dev slot to a fresh profile without touching normal meta', () => {
    const normal = new InMemoryMetaStore();
    const dev = new InMemoryMetaStore();
    normal.save({ ...INITIAL_META_STATE, score: 99, unlockedRelicIds: [...RELIC_IDS] });
    dev.save(devUnlockAllMeta());

    const reset = devResetInto(dev);

    expect(reset).toEqual(INITIAL_META_STATE);
    expect(loadDevMeta(dev)).toEqual(INITIAL_META_STATE);
    // Normal meta is untouched.
    expect(normal.load()!.score).toBe(99);
    expect(normal.load()!.unlockedRelicIds).toEqual([...RELIC_IDS]);
  });
});

describe('loadDevMeta', () => {
  it('returns a fresh profile when the dev slot is empty (base 12 relics)', () => {
    expect(loadDevMeta(new InMemoryMetaStore()).unlockedRelicIds).toEqual([...UNLOCKED_BY_DEFAULT_IDS]);
  });
});
