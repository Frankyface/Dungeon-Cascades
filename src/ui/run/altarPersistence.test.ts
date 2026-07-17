/**
 * The Altar sacrifice's crash-safe PERSISTENCE ORDERING (review M1). The permanent relic unlock is a
 * pure META change that must be durable even though the run dies — and it CANNOT be re-derived (the
 * altar pick is seeded off the run that just ended). RunContext therefore flushes the meta unlock to
 * disk FIRST (awaited) and only THEN saves the terminal run (which clears the slot). These tests pin
 * the invariant at the port level with the in-memory stores: a crash between the two writes keeps the
 * unlock rather than losing it.
 *
 * NOTE (deferred): fully preventing a benign DOUBLE-sacrifice on the narrow crash-between-writes window
 * would need per-run idempotency keyed into the MetaState schema (a persisted altar-run ledger). That
 * is engine surgery with save/load ripple; per the fix's own escape clause it is deferred — the
 * ordering fix here eliminates the UNRECOVERABLE LOSS, which was the serious half.
 */
import { createRng } from '../../engine/board';
import {
  InMemoryMetaStore,
  InMemoryRunStore,
  loadMeta,
  sacrificeAtAltar,
  saveOnNodeCompletion,
  startRun,
} from '../../engine/run';
import type { RunState } from '../../engine/run';

/** A run parked at an altar (synthetic altar phase), ready to sacrifice. */
function altarRun(seed: number): RunState {
  return { ...startRun(seed), phase: { kind: 'altar', rngState: createRng(1) } };
}

describe('Altar sacrifice — crash-safe persistence ordering (review M1)', () => {
  it('flushes the meta unlock BEFORE the run save, so a crash between the two keeps the unlock', () => {
    const metaStore = new InMemoryMetaStore();
    const runStore = new InMemoryRunStore();
    const run = altarRun(5);
    runStore.save(run); // the run is already saved at the altar (active)

    const result = sacrificeAtAltar(run, loadMeta(metaStore));
    expect(result.relicId).not.toBeNull();

    // ORDERED persistence — the meta unlock is written FIRST ...
    metaStore.save(result.meta);
    // ... then a CRASH hits before the terminal run save clears the slot (the store still holds the
    // pre-sacrifice altar run).

    // On reload the permanent unlock survived — it was NOT lost (and it cannot be re-derived).
    const recovered = loadMeta(metaStore);
    expect(recovered.unlockedRelicIds).toContain(result.relicId);
    // The run slot was never cleared (the crash hit first). The residual risk is only a benign
    // re-sacrifice — never the unrecoverable LOSS the old run-first ordering could cause.
    expect(runStore.load()).not.toBeNull();
  });

  it('a completed sacrifice persists the unlock AND clears the run slot (rogue-lite: no resume)', () => {
    const metaStore = new InMemoryMetaStore();
    const runStore = new InMemoryRunStore();
    const run = altarRun(5);
    runStore.save(run);

    const result = sacrificeAtAltar(run, loadMeta(metaStore));
    metaStore.save(result.meta); // (1) meta unlock, durable first
    saveOnNodeCompletion(runStore, result.state); // (2) terminal 'sacrificed' run → slot cleared

    expect(loadMeta(metaStore).unlockedRelicIds).toContain(result.relicId);
    expect(runStore.load()).toBeNull(); // the sacrificed run does not resume
  });
});
