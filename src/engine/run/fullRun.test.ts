/**
 * Full-run headless playability — the stage's automated proof that the engine can drive a
 * COMPLETE run in pure TS with zero wedges. A batch of seeds is driven to a terminal state
 * with the deterministic greedy policy; both victory and defeat are shown reachable; and a
 * save/load in the middle of a run produces an IDENTICAL continuation (the transcript-equality
 * fixture). The band-tuning of the win rate itself is the next agent's sim gate — here we only
 * prove the machine runs to completion, both ways, deterministically.
 */
import { startRun } from './runFlow';
import { driveRun, greedyComboPath, stepRun, trivialSwapPath } from './runPolicy';
import { InMemoryRunStore } from './runStore';
import { isEncounter } from './mapGen';

/** Count the fights/elites/boss on a completed run's visited path. */
function encountersOnPath(state: ReturnType<typeof startRun>): number {
  return state.mapState.visited.filter((id) => {
    const node = state.map.nodes.find((n) => n.id === id);
    return node !== undefined && (isEncounter(node.type) || node.type === 'boss');
  }).length;
}

describe('full-run headless playability (zero wedges)', () => {
  it('drives 20 seeds to a terminal state — every run ends in victory or defeat', () => {
    let victories = 0;
    let defeats = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const res = driveRun(startRun(seed), greedyComboPath);
      expect(res.terminated).toBe(true); // no wedge / infinite loop
      expect(res.state.phase.kind).toBe('ended');
      expect(['victory', 'defeat']).toContain(res.state.status);
      expect(res.steps).toBeLessThan(4000);
      if (res.state.status === 'victory') victories++;
      else defeats++;
    }
    // Both outcomes occur across the batch (jeopardy is real in both directions).
    expect(victories).toBeGreaterThan(0);
    expect(defeats).toBeGreaterThan(0);
  });

  it('reaches VICTORY with the greedy policy — a full run through the boss', () => {
    const res = driveRun(startRun(10), greedyComboPath);
    expect(res.state.status).toBe('victory');
    // The boss was reached and cleared (final position is the boss node).
    expect(res.state.mapState.currentNodeId).toBe(res.state.map.bossId);
    // Encounters on the completed path sit in the intended 8–12 band.
    const enc = encountersOnPath(res.state);
    expect(enc).toBeGreaterThanOrEqual(8);
    expect(enc).toBeLessThanOrEqual(12);
  });

  it('reaches DEFEAT — the weak policy dies honestly (a no-op player always loses)', () => {
    // The greedy batch above already proves defeats > 0; a deliberately weak policy makes an
    // honest death deterministic regardless of tuning.
    for (const seed of [1, 2, 3]) {
      expect(driveRun(startRun(seed), trivialSwapPath).state.status).toBe('defeat');
    }
  });

  it('is fully deterministic (same seed + policy ⇒ identical final RunState)', () => {
    const a = driveRun(startRun(10), greedyComboPath).state;
    const b = driveRun(startRun(10), greedyComboPath).state;
    expect(a).toEqual(b);
  });
});

describe('save/load transcript equality', () => {
  it('play A → save → load → play B equals playing A→B straight through', () => {
    const seed = 10;
    const straight = driveRun(startRun(seed), greedyComboPath).state;

    // Same run, but serialize → deserialize through the store partway through.
    let mid = startRun(seed);
    for (let i = 0; i < 30 && mid.status === 'active'; i++) mid = stepRun(mid, greedyComboPath);
    const store = new InMemoryRunStore();
    store.save(mid); // save on a mid-run checkpoint
    const reloaded = store.load();
    expect(reloaded).not.toBeNull();
    const continued = driveRun(reloaded!, greedyComboPath).state;

    expect(continued).toEqual(straight); // identical continuation ⇒ lossless, deterministic
  });
});
