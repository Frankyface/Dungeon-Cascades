/**
 * Move-timer state machine — pure, Jest-testable.
 *
 * The timer is idle until the held tile first moves; then it runs; then it either
 * expires (times out) or is stopped by the player releasing. The important, tested
 * property is that `start` is a one-way idle -> running transition: committing more
 * steps must NOT restart the countdown, because the ~5s window is per-move, not
 * per-step.
 *
 * The countdown VALUE (the depleting bar) is animated on the UI thread with
 * Reanimated using `durationMs`; this module only owns the discrete status so the
 * game reducer and the timeout handler have a single source of truth.
 */
import { MOVE_TIMER_MS } from './constants';

export type TimerStatus = 'idle' | 'running' | 'expired';

export interface TimerState {
  readonly status: TimerStatus;
  readonly durationMs: number;
}

/** A fresh, idle timer. */
export function idleTimer(durationMs: number = MOVE_TIMER_MS): TimerState {
  return { status: 'idle', durationMs };
}

/** idle -> running (first move). Any other status is returned unchanged. */
export function startTimer(timer: TimerState): TimerState {
  if (timer.status !== 'idle') {
    return timer;
  }
  return { status: 'running', durationMs: timer.durationMs };
}

/** running -> expired (timeout). Any other status is returned unchanged. */
export function expireTimer(timer: TimerState): TimerState {
  if (timer.status !== 'running') {
    return timer;
  }
  return { status: 'expired', durationMs: timer.durationMs };
}

/** Back to idle (move ended: released or resolved). */
export function resetTimer(timer: TimerState): TimerState {
  return { status: 'idle', durationMs: timer.durationMs };
}

/** Is the countdown actively depleting? */
export function isRunning(timer: TimerState): boolean {
  return timer.status === 'running';
}
