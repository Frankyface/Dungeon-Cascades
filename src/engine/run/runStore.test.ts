/**
 * Save/load fixtures: RunState JSON round-trips losslessly (the single save unit), the
 * in-memory port saves/loads/clears, and save-on-node-completion clears on a terminal run
 * (rogue-lite: no resume from a finished run).
 */
import { startRun, enterNode, playEncounterTurn, abandonRun } from './runFlow';
import { greedyComboPath } from './runPolicy';
import { InMemoryRunStore, saveOnNodeCompletion } from './runStore';

describe('RunState JSON round-trip (lossless)', () => {
  it('a mid-combat run (with a scaled enemy override) survives serialize → parse deep-equal', () => {
    const state = enterNode(startRun(42)); // combat phase: scaled enemy override present
    expect(state.phase.kind).toBe('combat');
    const round = JSON.parse(JSON.stringify(state));
    expect(round).toEqual(state);
  });

  it('a fresh run round-trips too', () => {
    const state = startRun(7);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

describe('InMemoryRunStore', () => {
  it('returns null before any save', () => {
    expect(new InMemoryRunStore().load()).toBeNull();
  });

  it('saves and loads an equal (independent) copy', () => {
    const store = new InMemoryRunStore();
    const state = enterNode(startRun(42));
    store.save(state);
    const loaded = store.load();
    expect(loaded).toEqual(state);
    expect(loaded).not.toBe(state); // a distinct object (JSON-backed)
  });

  it('clear removes the save', () => {
    const store = new InMemoryRunStore();
    store.save(startRun(1));
    store.clear();
    expect(store.load()).toBeNull();
  });
});

describe('saveOnNodeCompletion — persist active, clear terminal', () => {
  it('saves an active run', () => {
    const store = new InMemoryRunStore();
    saveOnNodeCompletion(store, startRun(1));
    expect(store.load()).not.toBeNull();
  });

  it('clears the slot when the run is terminal (rogue-lite death)', () => {
    const store = new InMemoryRunStore();
    const active = startRun(1);
    saveOnNodeCompletion(store, active); // a prior save exists
    const dead = abandonRun(active);
    saveOnNodeCompletion(store, dead);
    expect(store.load()).toBeNull(); // death cleared it
  });
});
