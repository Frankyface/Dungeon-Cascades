/**
 * The menu run-section hydration gate (FIX 2 regression): while the saved run is being hydrated
 * from disk the section must be a non-interactive placeholder, so a premature "Start a run" tap
 * can never stage + save a fresh run over the unread save.
 */
import { runSection } from './menuState';

describe('runSection — menu run-section hydration gate', () => {
  it('is a non-interactive loading placeholder while hydration is in flight (whatever hasSave is)', () => {
    // The safety property: loading is NEVER 'start'/'resume', so no Start/Continue is tappable yet.
    expect(runSection('loading', false)).toEqual({ kind: 'loading' });
    expect(runSection('loading', true)).toEqual({ kind: 'loading' });
  });

  it('offers Start once hydrated with no saved run', () => {
    expect(runSection('ready', false)).toEqual({ kind: 'start' });
  });

  it('offers Resume once hydrated with a saved run', () => {
    expect(runSection('ready', true)).toEqual({ kind: 'resume' });
  });
});
