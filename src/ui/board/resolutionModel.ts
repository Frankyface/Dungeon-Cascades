/**
 * Turn an engine `MoveResolution` into a sequence of per-wave RENDER views the UI
 * can animate. Pure and Jest-testable.
 *
 * This module does NOT re-implement match/gravity/cascade logic: it only REPLAYS
 * the moves the engine already declared (each wave's cleared cells, falls, and
 * spawns) to reconstruct the board snapshot the player should see after that wave.
 * The test suite asserts the last reconstructed snapshot equals the engine's
 * `finalBoard`, which pins this replay to the engine's own output.
 */
import { indexOf, positionOf } from '../../engine/board';
import type {
  Board,
  MoveResolution,
  Position,
  ResolutionWave,
  TileColor,
} from '../../engine/board';

/** One tile that animates during a wave's fall phase. */
export interface TileDrop {
  /** Flat cell index (row-major) of the tile's DESTINATION in `boardAfter`. */
  readonly cell: number;
  /**
   * Vertical start offset in CELL units (negative = starts above its destination
   * and drops down). A survivor falling from row 1 to row 3 has `dyCells = -2`; a
   * spawn destined for row r starts above the top edge at `dyCells = -(r + 1)`.
   * The component multiplies this by `layout.pitch` to get pixels.
   */
  readonly dyCells: number;
}

/** A single cascade wave, ready to animate. */
export interface WaveView {
  /** Board as it looked entering this wave (what is on screen when the wave starts). */
  readonly boardBefore: Board;
  /** Cells that flash / fade out this wave (row-major order for stable rendering). */
  readonly clearedCells: readonly Position[];
  /** Board after this wave's clear + gravity + refill. */
  readonly boardAfter: Board;
  /** Tiles to animate downward (falls + spawns) during the fall phase. */
  readonly drops: readonly TileDrop[];
  /** Number of combo groups cleared in THIS wave. */
  readonly waveCombos: number;
  /** Running total of combo groups cleared up to and including this wave. */
  readonly cumulativeCombos: number;
}

/**
 * Apply ONE engine wave to a board snapshot, returning the next snapshot. Consumes
 * only the engine-declared clears/falls/spawns — no match detection, no gravity
 * rule re-derivation.
 */
export function replayWave(boardBefore: Board, wave: ResolutionWave): Board {
  const tiles: (TileColor | null)[] = boardBefore.tiles.slice();

  // 1. Snapshot the colors of every fall source BEFORE we blank anything out.
  const fallColors: TileColor[] = wave.falls.map((f) => boardBefore.tiles[indexOf(boardBefore, f.from)]);

  // 2. Blank every source cell (cleared cells and vacated fall sources).
  for (const group of wave.clearedGroups) {
    for (const pos of group.positions) {
      tiles[indexOf(boardBefore, pos)] = null;
    }
  }
  for (const fall of wave.falls) {
    tiles[indexOf(boardBefore, fall.from)] = null;
  }

  // 3. Land the fallen survivors at their destinations.
  wave.falls.forEach((fall, i) => {
    tiles[indexOf(boardBefore, fall.to)] = fallColors[i];
  });

  // 4. Drop the spawned tiles into the remaining holes.
  for (const spawn of wave.spawns) {
    tiles[indexOf(boardBefore, spawn.position)] = spawn.color;
  }

  // Defensive: the engine guarantees a full board; a null here means our replay
  // diverged from the engine, which the tests are designed to catch.
  const finalTiles: TileColor[] = tiles.map((t, i) => {
    if (t === null) {
      throw new Error(`replayWave: unfilled cell at index ${i} — wave data did not cover the board`);
    }
    return t;
  });

  return { cols: boardBefore.cols, rows: boardBefore.rows, tiles: finalTiles };
}

/** Flatten a wave's cleared groups into a single row-major-ordered position list. */
function flattenClearedCells(wave: ResolutionWave): Position[] {
  const cells: Position[] = [];
  for (const group of wave.clearedGroups) {
    for (const pos of group.positions) {
      cells.push(pos);
    }
  }
  return cells;
}

/** Build the per-cell downward animation offsets for a wave. */
function buildDrops(boardAfter: Board, wave: ResolutionWave): TileDrop[] {
  const drops: TileDrop[] = [];
  for (const fall of wave.falls) {
    drops.push({ cell: indexOf(boardAfter, fall.to), dyCells: fall.from.row - fall.to.row });
  }
  for (const spawn of wave.spawns) {
    drops.push({ cell: indexOf(boardAfter, spawn.position), dyCells: -(spawn.position.row + 1) });
  }
  return drops;
}

/**
 * Build the full animation timeline for a resolved move.
 *
 * @param postSwapBoard the board AFTER the drag swaps but BEFORE any cascade — i.e.
 *   what is already on screen at release (the live drag already rendered the swaps).
 * @param resolution the engine result whose `waves` are replayed in order.
 */
export function buildWaveViews(postSwapBoard: Board, resolution: MoveResolution): WaveView[] {
  const views: WaveView[] = [];
  let boardBefore = postSwapBoard;
  let cumulative = 0;

  for (const wave of resolution.waves) {
    const boardAfter = replayWave(boardBefore, wave);
    cumulative += wave.clearedGroups.length;
    views.push({
      boardBefore,
      clearedCells: flattenClearedCells(wave),
      boardAfter,
      drops: buildDrops(boardAfter, wave),
      waveCombos: wave.clearedGroups.length,
      cumulativeCombos: cumulative,
    });
    boardBefore = boardAfter;
  }

  return views;
}

/** Convenience: the flat cell index -> Position for a board, for the component. */
export function cellToPosition(board: Board, cell: number): Position {
  return positionOf(board, cell);
}
