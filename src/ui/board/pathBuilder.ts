/**
 * Drag-path builder state machine — the UI's incremental mirror of the engine's
 * path semantics. Pure, immutable, Jest-testable; delegates all geometry / bounds
 * rules to the engine (`step`, `isValidStep`, `applyPath`) so the UI can NEVER
 * drift from what `resolveMove` will accept.
 *
 * Backtrack handling (the documented decision):
 *   Dragging the finger back into the previous cell is NOT special-cased. It is
 *   appended as a normal reverse step, exactly the Puzzle & Dragons behaviour: the
 *   held tile swaps back, which undoes the previous swap. So `right` then `left`
 *   returns the held tile to its start and the board to its pre-drag arrangement
 *   (swap + inverse swap cancel). This keeps the builder unambiguous — every step
 *   is a real, validated orthogonal move — and the engine accepts the resulting
 *   path verbatim. `MAX_PATH_STEPS` (engine constant) still caps runaway paths.
 */
import { step, isValidStep, applyPath, MAX_PATH_STEPS } from '../../engine/board';
import type { Board, Direction, Path, Position } from '../../engine/board';

/** An in-progress drag: the picked-up start cell plus the committed steps so far. */
export interface DragPath {
  readonly start: Position;
  readonly steps: readonly Direction[];
}

/** Begin a drag by picking up the tile at `start`. */
export function beginPath(start: Position): DragPath {
  return { start, steps: [] };
}

/** Current cell of the held tile = start with every committed step applied. */
export function heldPosition(path: DragPath): Position {
  let current = path.start;
  for (const dir of path.steps) {
    current = step(current, dir);
  }
  return current;
}

/**
 * May a step in `dir` be appended? True iff it stays on the grid (engine bounds
 * rule) and we are under the engine's max-length guard. This is the same predicate
 * the engine's `validatePath` enforces, checked one step at a time.
 */
export function canAppendStep(board: Board, path: DragPath, dir: Direction): boolean {
  if (path.steps.length >= MAX_PATH_STEPS) {
    return false;
  }
  return isValidStep(board, heldPosition(path), dir);
}

/** Append a step immutably. Callers should gate with {@link canAppendStep} first. */
export function appendStep(path: DragPath, dir: Direction): DragPath {
  return { start: path.start, steps: [...path.steps, dir] };
}

/** Has the drag committed at least one step (i.e. is it a real move)? */
export function hasSteps(path: DragPath): boolean {
  return path.steps.length > 0;
}

/** Convert to the engine `Path` shape accepted by `applyPath` / `resolveMove`. */
export function toEnginePath(path: DragPath): Path {
  return { start: path.start, steps: path.steps };
}

/**
 * The live board the player sees mid-drag: the base board with every committed
 * swap applied. Equal to the base board when no step has committed yet, and
 * always equal to the post-swap board `resolveMove` computes internally for the
 * same path — so the on-screen board provably mirrors the engine.
 */
export function displayBoard(base: Board, path: DragPath): Board {
  if (path.steps.length === 0) {
    return base;
  }
  return applyPath(base, toEnginePath(path)).board;
}
