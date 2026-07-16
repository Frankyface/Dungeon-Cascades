import {
  expireTimer,
  idleTimer,
  isRunning,
  resetTimer,
  startTimer,
  type TimerState,
} from './timer';

describe('move timer state machine', () => {
  it('starts idle with the given duration', () => {
    const t = idleTimer(5000);
    expect(t.status).toBe('idle');
    expect(t.durationMs).toBe(5000);
    expect(isRunning(t)).toBe(false);
  });

  it('idle -> running on start, and running is a one-way latch (no restart)', () => {
    const idle = idleTimer(5000);
    const running = startTimer(idle);
    expect(running.status).toBe('running');
    expect(isRunning(running)).toBe(true);
    // Starting an already-running timer must NOT reset it (per-move, not per-step).
    const again = startTimer(running);
    expect(again).toBe(running);
    expect(again.status).toBe('running');
  });

  it('running -> expired on timeout; expire on non-running is a no-op', () => {
    const running = startTimer(idleTimer(5000));
    expect(expireTimer(running).status).toBe('expired');
    const idle = idleTimer(5000);
    expect(expireTimer(idle)).toBe(idle);
  });

  it('cannot start again from expired', () => {
    const expired = expireTimer(startTimer(idleTimer(5000)));
    expect(startTimer(expired)).toBe(expired);
  });

  it('resetTimer returns to idle from any status, preserving duration', () => {
    const running: TimerState = startTimer(idleTimer(5000));
    const reset = resetTimer(running);
    expect(reset.status).toBe('idle');
    expect(reset.durationMs).toBe(5000);
  });
});
