import { startRun } from '../../engine/run';
import type { RunState } from '../../engine/run';
import { routeForRunState } from './runRoute';

function withPhase(phase: RunState['phase'], status: RunState['status'] = 'active'): RunState {
  return { ...startRun(1), phase, status };
}

describe('routeForRunState', () => {
  it('routes the map for both the enter and move phases', () => {
    expect(routeForRunState(withPhase({ kind: 'awaiting_node' }))).toBe('/run');
    expect(routeForRunState(withPhase({ kind: 'awaiting_move' }))).toBe('/run');
  });

  it('routes each interactive phase to its screen', () => {
    expect(routeForRunState(withPhase({ kind: 'draft', options: ['emberfang'] }))).toBe('/run/draft');
    expect(routeForRunState(withPhase({ kind: 'shop', shop: { items: [] } }))).toBe('/run/shop');
    expect(routeForRunState(withPhase({ kind: 'event', eventId: 'cursed-altar', rngState: { seed: 1 } as never }))).toBe('/run/event');
    expect(routeForRunState(withPhase({ kind: 'rest', rest: { rested: false } }))).toBe('/run/rest');
  });

  it('routes the altar phase to its dedicated sacrifice screen', () => {
    expect(routeForRunState(withPhase({ kind: 'altar', rngState: { seed: 1 } as never }))).toBe('/run/altar');
  });

  it('routes the act-transition phase to its own screen (not the map)', () => {
    expect(routeForRunState(withPhase({ kind: 'act_transition' }))).toBe('/run/transition');
  });

  it('routes a combat phase to the encounter screen', () => {
    // A real combat phase is easiest to obtain from the engine.
    const combat = startRun(1);
    const entered = { ...combat, phase: { kind: 'combat' as const, encounter: {} as never, encounterKind: 'fight' as const, bossPhase: 0 } };
    expect(routeForRunState(entered)).toBe('/run/encounter');
  });

  it('routes a terminal run to victory or defeat by status', () => {
    expect(routeForRunState(withPhase({ kind: 'ended' }, 'victory'))).toBe('/run/victory');
    expect(routeForRunState(withPhase({ kind: 'ended' }, 'defeat'))).toBe('/run/defeat');
  });

  it('routes a sacrificed run (§2c) to the defeat outcome (it counts as a defeat)', () => {
    expect(routeForRunState(withPhase({ kind: 'ended' }, 'sacrificed'))).toBe('/run/defeat');
  });
});
