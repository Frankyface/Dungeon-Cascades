import { resolveCommitDirection } from './hysteresis';
import type { Point } from './layout';

const PITCH = 60;
const MARGIN_RATIO = 0.18;
// threshold = pitch/2 + pitch*marginRatio = 30 + 10.8 = 40.8
const THRESHOLD = PITCH / 2 + PITCH * MARGIN_RATIO;
const held: Point = { x: 100, y: 100 };

function finger(dx: number, dy: number): Point {
  return { x: held.x + dx, y: held.y + dy };
}

describe('resolveCommitDirection', () => {
  it('does not commit while the finger is inside the held cell dead-zone', () => {
    expect(resolveCommitDirection(held, finger(0, 0), PITCH, MARGIN_RATIO)).toBeNull();
    expect(resolveCommitDirection(held, finger(THRESHOLD - 1, 0), PITCH, MARGIN_RATIO)).toBeNull();
    expect(resolveCommitDirection(held, finger(0, THRESHOLD - 1), PITCH, MARGIN_RATIO)).toBeNull();
    // Well short of the threshold stays in the dead-zone (no commit, no jitter).
    expect(resolveCommitDirection(held, finger(THRESHOLD - 5, 0), PITCH, MARGIN_RATIO)).toBeNull();
  });

  it('commits the crossed orthogonal direction once past the threshold', () => {
    expect(resolveCommitDirection(held, finger(THRESHOLD + 1, 0), PITCH, MARGIN_RATIO)).toBe('right');
    expect(resolveCommitDirection(held, finger(-(THRESHOLD + 1), 0), PITCH, MARGIN_RATIO)).toBe('left');
    expect(resolveCommitDirection(held, finger(0, THRESHOLD + 1), PITCH, MARGIN_RATIO)).toBe('down');
    expect(resolveCommitDirection(held, finger(0, -(THRESHOLD + 1)), PITCH, MARGIN_RATIO)).toBe('up');
  });

  it('resolves diagonal motion to the single dominant axis (orthogonal-only v1)', () => {
    // Vertical component larger -> commits vertical even though horizontal also crossed.
    expect(resolveCommitDirection(held, finger(THRESHOLD + 1, THRESHOLD + 5), PITCH, MARGIN_RATIO)).toBe('down');
    // Horizontal component larger -> commits horizontal.
    expect(resolveCommitDirection(held, finger(THRESHOLD + 5, THRESHOLD + 1), PITCH, MARGIN_RATIO)).toBe('right');
  });

  it('does not commit when the dominant axis is sub-threshold even if the other axis crossed', () => {
    // dx dominates (|dx|>=|dy|) but is under threshold -> null (no vertical fired).
    expect(resolveCommitDirection(held, finger(20, 15), PITCH, MARGIN_RATIO)).toBeNull();
  });
});
