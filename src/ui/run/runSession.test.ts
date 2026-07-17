/**
 * UI save/resume WIRING proof: drives a whole run through the session helpers the provider
 * uses (`applyRunAction` for non-combat, the engine's `playEncounterTurn` for combat) against
 * the IN-MEMORY store, asserting the engine round-trip at every step — an active run persists
 * and reloads deep-equal, a terminal run clears the slot. Async-storage itself is not tested
 * here (device persistence is Cam's on-device pass); this proves our wiring calls the engine
 * correctly and a saved run resumes losslessly.
 */
import {
  InMemoryRunStore,
  abandonRun,
  advanceAct,
  getEvent,
  greedyComboPath,
  legalNextNodes,
  playEncounterTurn,
  startRun,
} from '../../engine/run';
import type { RunState } from '../../engine/run';
import { applyRunAction, hasSavedRun, loadRun, persistRun, safeApplyRunAction } from './runSession';
import type { RunUiAction } from './runSession';

/** One deterministic transition using the UI session helpers (mirrors the provider). */
function stepViaSession(state: RunState): RunState {
  const phase = state.phase;
  switch (phase.kind) {
    case 'awaiting_node':
      return applyRunAction(state, { type: 'enter' });
    case 'combat':
      return playEncounterTurn(state, greedyComboPath(phase.encounter.board)).state;
    case 'draft':
      return applyRunAction(state, { type: 'draftPick', relicId: phase.options[0] ?? null });
    case 'shop':
      return applyRunAction(state, { type: 'shopLeave' });
    case 'event':
      return applyRunAction(state, { type: 'eventChoice', index: getEvent(phase.eventId).choices.length - 1 });
    case 'rest':
      return phase.rest.rested
        ? applyRunAction(state, { type: 'restLeave' })
        : applyRunAction(state, { type: 'rest' });
    case 'awaiting_move':
      return applyRunAction(state, { type: 'travel', nodeId: legalNextNodes(state.map, state.mapState)[0] });
    case 'act_transition':
      return advanceAct(state); // the between-acts step (engine transition; UI provider wiring is a UI-wave follow-up)
    case 'ended':
      return state;
  }
}

describe('applyRunAction — targeted branches', () => {
  it('enter resolves the current node into its activity phase', () => {
    const entered = applyRunAction(startRun(1), { type: 'enter' });
    expect(entered.phase.kind).toBe('combat'); // floor-0 start is the intro fight
  });

  it('abandon turns an active run into a terminal defeat', () => {
    const dead = applyRunAction(startRun(1), { type: 'abandon' });
    expect(dead.status).toBe('defeat');
    expect(dead.phase.kind).toBe('ended');
  });
});

describe('safeApplyRunAction — double-tap phase-guard (returns unchanged, never throws)', () => {
  // A combat-phase run: entering the floor-0 node starts the intro fight. Every NON-combat action
  // is illegal from here — exactly the double-tapped-button case where the first tap already moved
  // the run into combat and a stale second tap fires a now-wrong-phase action.
  const combatState = applyRunAction(startRun(1), { type: 'enter' });

  it('the fixture is in a combat phase', () => {
    expect(combatState.phase.kind).toBe('combat');
  });

  it.each<RunUiAction>([
    { type: 'enter' },
    { type: 'travel', nodeId: 'not-a-real-node' },
    { type: 'draftPick', relicId: null },
    { type: 'eventChoice', index: 0 },
    { type: 'rest' },
    { type: 'shopLeave' },
    { type: 'restLeave' },
  ])('rejects %o against a combat-phase state and returns it unchanged (no throw)', (action) => {
    const result = safeApplyRunAction(combatState, action);
    expect(result.rejected).toBe(true);
    expect(result.state).toBe(combatState); // exact same reference — no mutation, no new state
  });

  it('applies a legal action and reports it as not rejected', () => {
    const result = safeApplyRunAction(startRun(1), { type: 'enter' });
    expect(result.rejected).toBe(false);
    expect(result.state.phase.kind).toBe('combat');
  });
});

describe('persistRun / loadRun round-trip while driving a whole run', () => {
  it('persists every active checkpoint deep-equal and clears on the terminal step', () => {
    const store = new InMemoryRunStore();
    let state = startRun(24680);

    // Initial save + resume is lossless.
    persistRun(store, state);
    expect(hasSavedRun(store)).toBe(true);
    expect(loadRun(store)).toEqual(state);

    for (let guard = 0; guard < 4000 && state.status === 'active'; guard++) {
      state = stepViaSession(state);
      persistRun(store, state);
      if (state.status === 'active') {
        // A saved active run reloads as an independent, deep-equal copy (real serialization).
        const loaded = loadRun(store);
        expect(loaded).toEqual(state);
        expect(loaded).not.toBe(state);
      }
    }

    expect(state.status).not.toBe('active'); // the run terminated (no wedge)
    expect(loadRun(store)).toBeNull(); // rogue-lite: a finished run cleared its save
    expect(hasSavedRun(store)).toBe(false);
  });

  it('clears the slot when a mid-run save is followed by an abandon', () => {
    const store = new InMemoryRunStore();
    const active = applyRunAction(startRun(1), { type: 'enter' });
    persistRun(store, active);
    expect(hasSavedRun(store)).toBe(true);
    persistRun(store, abandonRun(active));
    expect(hasSavedRun(store)).toBe(false);
  });
});
