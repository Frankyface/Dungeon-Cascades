import { driveRun, startRun } from '../../engine/run';
import type { RunState } from '../../engine/run';
import { computeRunSummary } from './runSummary';

describe('computeRunSummary', () => {
  it('summarizes a fresh run as an active, floor-0, empty run', () => {
    const s = computeRunSummary(startRun(3));
    expect(s.outcome).toBe('active');
    expect(s.floorsReached).toBe(0);
    expect(s.nodesCompleted).toBe(0);
    expect(s.relicCount).toBe(0);
    expect(s.reachedBoss).toBe(false);
    expect(s.hp).toBe(s.maxHp);
  });

  it('reports reachedBoss when the boss floor is on the visited path', () => {
    const base = startRun(3);
    const state: RunState = {
      ...base,
      status: 'victory',
      mapState: { currentNodeId: base.map.bossId, visited: [base.map.startId, base.map.bossId] },
    };
    const s = computeRunSummary(state);
    expect(s.outcome).toBe('victory');
    expect(s.floorsReached).toBe(base.map.floorCount - 1);
    expect(s.reachedBoss).toBe(true);
  });

  it('stays internally consistent for a fully driven (terminal) run', () => {
    const result = driveRun(startRun(12345));
    const s = computeRunSummary(result.state);
    expect(['victory', 'defeat']).toContain(s.outcome);
    expect(s.outcome).toBe(result.state.status);
    expect(s.relicCount).toBe(s.relicIds.length);
    expect(s.floorsReached).toBeLessThanOrEqual(s.floorCount - 1);
    expect(s.reachedBoss).toBe(s.floorsReached >= s.floorCount - 1);
  });
});
