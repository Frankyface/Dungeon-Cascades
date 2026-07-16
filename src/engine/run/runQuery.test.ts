/**
 * Query-helper + edge-branch coverage: legalActions across every phase kind, currentRunNode,
 * the gold maxHp=0 / custom-registry branches, and stepRun's terminal no-op — the exported
 * behaviors the flow/full-run suites reach only indirectly.
 */
import { startRun, enterNode } from './runFlow';
import { stepRun, greedyComboPath } from './runPolicy';
import { legalActions, currentRunNode } from './runTypes';
import type { RunState } from './runTypes';
import { computeGoldReward } from './gold';
import { RELIC_REGISTRY } from './relics';

function withPhase(phase: RunState['phase']): RunState {
  return { ...startRun(1), phase };
}

describe('legalActions across every phase', () => {
  it('draft offers each option plus a skip', () => {
    const actions = legalActions(withPhase({ kind: 'draft', options: ['emberfang', 'bulwark-rune'] }));
    expect(actions.filter((a) => a.type === 'draft_pick')).toHaveLength(2);
    expect(actions.some((a) => a.type === 'draft_skip')).toBe(true);
  });

  it('an unrested rest offers rest + leave; a rested one offers only leave', () => {
    expect(legalActions(withPhase({ kind: 'rest', rest: { rested: false } }))).toHaveLength(2);
    expect(legalActions(withPhase({ kind: 'rest', rest: { rested: true } }))).toEqual([{ type: 'rest_leave' }]);
  });

  it('the ended phase has no actions', () => {
    expect(legalActions({ ...startRun(1), status: 'victory', phase: { kind: 'ended' } })).toEqual([]);
  });
});

describe('currentRunNode', () => {
  it('returns the player’s current map node', () => {
    const s = startRun(42);
    expect(currentRunNode(s).id).toBe(s.map.startId);
  });
});

describe('stepRun terminal no-op', () => {
  it('returns an ended run unchanged', () => {
    const ended: RunState = { ...startRun(1), status: 'defeat', phase: { kind: 'ended' } };
    expect(stepRun(ended, greedyComboPath)).toBe(ended);
  });
});

describe('computeGoldReward edge branches', () => {
  it('handles maxHp = 0 (no HP bonus) and an explicit registry', () => {
    expect(computeGoldReward({ turns: 1, hpRetained: 0, maxHp: 0, isElite: false }, [])).toBe(18); // 10 + 8 speed + 0 hp
    expect(computeGoldReward({ turns: 1, hpRetained: 60, maxHp: 60, isElite: false }, ['misers-knuckle'], undefined, RELIC_REGISTRY)).toBe(30);
  });
});

describe('enterNode covers the combat-entry path used by queries', () => {
  it('a fresh run enters combat and reports one play_turn action', () => {
    expect(legalActions(enterNode(startRun(1)))).toEqual([{ type: 'play_turn' }]);
  });
});
