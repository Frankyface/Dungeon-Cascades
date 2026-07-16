/**
 * Drag step-commit hysteresis — pure geometry, no React.
 *
 * Given the pixel center of the currently-held cell and the current finger pixel,
 * decide whether the finger has moved far enough into an orthogonal neighbour to
 * COMMIT one step (and in which direction), or `null` if it has not.
 *
 * A step commits only when the finger's offset from the held center, along the
 * dominant axis, exceeds `pitch/2 + margin`. Because a commit re-centers the held
 * tile on the neighbour, the reverse threshold is `pitch/2 + margin` on the other
 * side — leaving a dead-zone of width `2 * margin` around the true cell boundary.
 * That dead-zone is what stops edge jitter from rapidly toggling a step on and off.
 *
 * Diagonal finger motion is resolved to the single dominant orthogonal axis
 * (v1 is orthogonal-only), so one call yields at most one step.
 */
import { COMMIT_MARGIN_RATIO } from './constants';
import type { Direction } from '../../engine/board';
import type { Point } from './layout';

/**
 * @param heldCenter pixel center of the held tile's current cell
 * @param finger     current finger pixel
 * @param pitch      cell-to-cell distance in pixels (`layout.pitch`)
 * @param marginRatio hysteresis margin as a fraction of pitch (defaults to constant)
 * @returns the direction to commit, or `null` if the finger is still within the
 *          held cell's dead-zone. Off-grid rejection is the caller's job (it knows
 *          the board bounds) — this function is pure geometry.
 */
export function resolveCommitDirection(
  heldCenter: Point,
  finger: Point,
  pitch: number,
  marginRatio: number = COMMIT_MARGIN_RATIO,
): Direction | null {
  const dx = finger.x - heldCenter.x;
  const dy = finger.y - heldCenter.y;
  const threshold = pitch / 2 + pitch * marginRatio;

  // Dominant axis wins so a mostly-horizontal drag never fires a vertical step.
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx > threshold) return 'right';
    if (dx < -threshold) return 'left';
    return null;
  }
  if (dy > threshold) return 'down';
  if (dy < -threshold) return 'up';
  return null;
}
