/**
 * Gravity + refill. After a wave's matches clear, surviving tiles fall straight
 * down their columns and new tiles spawn from the top.
 *
 * DETERMINISM — documented spawn order (total, so the RNG stream is fully
 * defined): columns are processed LEFT -> RIGHT; within a column the topmost
 * empty cell (smallest row index) is filled first, proceeding downward. Each
 * spawn draws exactly one tile from the TileSource, advancing the RNG state.
 */
import { indexOf } from './board';
import type { Board, Fall, Position, RngState, Spawn, TileColor, TileSource } from './types';

export interface CollapseResult {
  readonly board: Board;
  readonly falls: readonly Fall[];
  readonly spawns: readonly Spawn[];
  readonly rngState: RngState;
}

/**
 * Remove the cleared cells, drop survivors, and refill from the top.
 * Pure: the input board and rngState are never mutated.
 */
export function collapse(
  board: Board,
  cleared: readonly Position[],
  rngState: RngState,
  source: TileSource,
): CollapseResult {
  const { cols, rows } = board;
  const clearedSet = new Set<number>(cleared.map((p) => indexOf(board, p)));
  const nextTiles: TileColor[] = board.tiles.slice();
  const falls: Fall[] = [];
  const spawns: Spawn[] = [];
  let state = rngState;

  for (let col = 0; col < cols; col++) {
    // Collect survivors top -> bottom, remembering their origin rows.
    const survivors: { color: TileColor; originRow: number }[] = [];
    for (let row = 0; row < rows; row++) {
      const index = row * cols + col;
      if (!clearedSet.has(index)) {
        survivors.push({ color: board.tiles[index], originRow: row });
      }
    }

    const holes = rows - survivors.length;

    // Spawns fill the top `holes` cells, topmost first (draws RNG in that order).
    for (let row = 0; row < holes; row++) {
      const draw = source.next(state);
      state = draw.state;
      const index = row * cols + col;
      nextTiles[index] = draw.color;
      spawns.push({ position: { col, row }, color: draw.color });
    }

    // Survivors land in the bottom rows, preserving their relative order.
    for (let k = 0; k < survivors.length; k++) {
      const destRow = holes + k;
      const survivor = survivors[k];
      nextTiles[destRow * cols + col] = survivor.color;
      if (destRow !== survivor.originRow) {
        falls.push({
          from: { col, row: survivor.originRow },
          to: { col, row: destRow },
        });
      }
    }
  }

  return {
    board: { cols, rows, tiles: nextTiles },
    falls,
    spawns,
    rngState: state,
  };
}
