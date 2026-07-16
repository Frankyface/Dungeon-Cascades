/**
 * Move resolution — the pure heart of the engine.
 *
 * `resolveMove` accepts an already-completed drag path (the engine is
 * timer-agnostic) plus an explicit RNG state, and returns a fully replayable
 * MoveResolution: the swap sequence, each cascade wave (cleared combos, falls,
 * spawns), the stable final board, the total combo count, and the advanced RNG
 * state. Same inputs ⇒ same output, always.
 */
import { applyPath, validatePath } from './path';
import { findMatches } from './match';
import { collapse } from './gravity';
import { uniformTileSource } from './tileSource';
import type {
  Board,
  MoveResolution,
  Path,
  Position,
  ResolutionWave,
  RngState,
  TileSource,
} from './types';

export function resolveMove(
  board: Board,
  path: Path,
  rngState: RngState,
  source: TileSource = uniformTileSource,
): MoveResolution {
  const validation = validatePath(board, path);
  if (!validation.ok) {
    throw new Error(`resolveMove: invalid path — ${validation.reason}`);
  }

  const { board: postSwap, swaps } = applyPath(board, path);

  const waves: ResolutionWave[] = [];
  let current = postSwap;
  let state = rngState;
  let totalCombos = 0;

  // Cascade until the board is stable (no more matches).
  for (;;) {
    const clearedGroups = findMatches(current);
    if (clearedGroups.length === 0) {
      break;
    }

    const cleared: Position[] = [];
    for (const group of clearedGroups) {
      for (const pos of group.positions) {
        cleared.push(pos);
      }
    }

    const result = collapse(current, cleared, state, source);
    waves.push({ clearedGroups, falls: result.falls, spawns: result.spawns });
    totalCombos += clearedGroups.length;
    current = result.board;
    state = result.rngState;
  }

  return {
    swaps,
    waves,
    finalBoard: current,
    totalCombos,
    rngState: state,
  };
}
