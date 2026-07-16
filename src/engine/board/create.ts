/**
 * Initial board creation with NO pre-existing matches, done by constructive
 * avoidance: fill the grid row-major and, for each cell, re-draw from the seeded
 * TileSource until the chosen color would not complete a horizontal or vertical
 * run of three with the already-placed neighbors to its left / above.
 *
 * Because cells are filled left->right, top->bottom, every possible triple that
 * could END at a later cell is checked when that cell is placed, so no run of
 * three can survive anywhere. With 5 colors and at most 2 forbidden per cell,
 * an allowed color always exists and the loop terminates quickly. Fully
 * deterministic per seed (the re-draws advance the RNG).
 *
 * Per spec, `createBoard` returns only the Board (it consumes RNG internally);
 * callers thread an independent RngState into `resolveMove` for refills.
 */
import { COLS, ROWS } from './config';
import { toRngState } from './rng';
import { uniformTileSource } from './tileSource';
import type { Board, RngState, TileColor, TileSource } from './types';

export function createBoard(
  seedOrRng: number | RngState,
  source: TileSource = uniformTileSource,
): Board {
  let state = toRngState(seedOrRng);
  const tiles: TileColor[] = new Array<TileColor>(COLS * ROWS);

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const forbidden = new Set<TileColor>();

      // A color equal to the two cells to the left would make a horizontal triple.
      if (col >= 2) {
        const left1 = tiles[row * COLS + col - 1];
        const left2 = tiles[row * COLS + col - 2];
        if (left1 === left2) {
          forbidden.add(left1);
        }
      }
      // A color equal to the two cells above would make a vertical triple.
      if (row >= 2) {
        const up1 = tiles[(row - 1) * COLS + col];
        const up2 = tiles[(row - 2) * COLS + col];
        if (up1 === up2) {
          forbidden.add(up1);
        }
      }

      let color: TileColor;
      do {
        const draw = source.next(state);
        color = draw.color;
        state = draw.state;
      } while (forbidden.has(color));

      tiles[row * COLS + col] = color;
    }
  }

  return { cols: COLS, rows: ROWS, tiles };
}
