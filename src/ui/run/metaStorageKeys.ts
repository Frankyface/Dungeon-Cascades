/**
 * Meta persistence storage KEYS, in a native-free module so they can be imported by pure Jest tests
 * (the async-storage adapter that consumes them pulls in a native module). The DEV key is kept
 * SEPARATE from the normal key (spec §8): dev-mode state must NEVER leak into normal meta persistence,
 * and the two keys never being equal is the storage-separation guarantee.
 */

/** Normal meta profile key (versioned for future migrations). */
export const META_STORAGE_KEY = 'dungeon-cascades/meta/v1';

/** Dev-mode meta profile key — a CLEARLY-MARKED, separate slot. Dev writes only ever hit this key. */
export const DEV_META_STORAGE_KEY = 'dungeon-cascades/dev-meta/v1';
