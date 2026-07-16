/**
 * The Skia canvas: the board background, one static "socket" per cell (so gaps and
 * mid-drop holes read as intentional), the grid of `GridTile`s, and the floating
 * held tile on top. Purely presentational — all state/animation is owned by the
 * parent and passed in via props + shared values.
 */
import { Canvas, RoundedRect } from '@shopify/react-native-skia';
import { type SharedValue } from 'react-native-reanimated';
import type { TileColor } from '../../engine/board';
import { BOARD_COLORS, TILE_FILL, TILE_RIM } from './colors';
import { cellTopLeft, type BoardLayout } from './layout';
import { FloatingTile, GridTile } from './AnimatedTile';

/** Per-frame render description of the board (what the canvas should draw now). */
export interface BoardFrame {
  /** One engine color code per cell, row-major. */
  readonly colors: readonly TileColor[];
  /** Flat indices of cells fading out this wave. */
  readonly clearing: ReadonlySet<number>;
  /** Pixel drop start-offset per cell (negative = above; 0 = at rest). */
  readonly startDy: readonly number[];
  /** Cell hidden because it is the held tile (drawn by the floating tile). */
  readonly hiddenCell: number | null;
}

interface SkiaBoardProps {
  readonly layout: BoardLayout;
  readonly frame: BoardFrame;
  readonly progress: SharedValue<number>;
  readonly fingerX: SharedValue<number>;
  readonly fingerY: SharedValue<number>;
  readonly heldColor: TileColor | null;
  readonly heldScale: SharedValue<number>;
}

export function SkiaBoard({
  layout,
  frame,
  progress,
  fingerX,
  fingerY,
  heldColor,
  heldScale,
}: SkiaBoardProps) {
  const cellCount = layout.cols * layout.rows;
  const cells: number[] = [];
  for (let i = 0; i < cellCount; i++) {
    cells.push(i);
  }

  return (
    <Canvas style={{ width: layout.width, height: layout.height }}>
      <RoundedRect
        x={0}
        y={0}
        width={layout.width}
        height={layout.height}
        r={18}
        color={BOARD_COLORS.boardBg}
      />

      {/* Static sockets behind the tiles. */}
      {cells.map((i) => {
        const col = i % layout.cols;
        const row = Math.floor(i / layout.cols);
        const tl = cellTopLeft(layout, col, row);
        return (
          <RoundedRect
            key={`socket-${i}`}
            x={tl.x}
            y={tl.y}
            width={layout.cellSize}
            height={layout.cellSize}
            r={layout.radius}
            color={BOARD_COLORS.gutter}
          />
        );
      })}

      {/* The animated tiles. */}
      {cells.map((i) => {
        const col = i % layout.cols;
        const row = Math.floor(i / layout.cols);
        const tl = cellTopLeft(layout, col, row);
        const code = frame.colors[i];
        return (
          <GridTile
            key={`tile-${i}`}
            x={tl.x}
            y={tl.y}
            size={layout.cellSize}
            radius={layout.radius}
            color={TILE_FILL[code]}
            rimColor={TILE_RIM[code]}
            clearing={frame.clearing.has(i)}
            startDy={frame.startDy[i] ?? 0}
            hidden={frame.hiddenCell === i}
            progress={progress}
          />
        );
      })}

      {/* The picked-up tile, tracking the finger. */}
      {heldColor !== null ? (
        <FloatingTile
          size={layout.cellSize}
          radius={layout.radius}
          color={TILE_FILL[heldColor]}
          rimColor={TILE_RIM[heldColor]}
          fingerX={fingerX}
          fingerY={fingerY}
          scale={heldScale}
        />
      ) : null}
    </Canvas>
  );
}
