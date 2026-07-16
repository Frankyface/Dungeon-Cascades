/**
 * The two Skia tile primitives, both driven by a SINGLE shared `progress` value
 * (0 -> 1) so the whole board animates in lock-step without per-tile effects or
 * effect-ordering hazards:
 *
 *   GridTile     — one cell of the board. It is a pure function of `progress` plus
 *                  its static per-segment descriptor (clearing? falling from where?).
 *                  A clearing tile fades + pops as progress rises; a dropping tile
 *                  slides from `startDy` to 0; an idle tile is the identity.
 *   FloatingTile — the picked-up tile that tracks the finger (its own shared x/y +
 *                  a lift scale), drawn on top of the grid during a drag.
 *
 * Placeholder-grade art: flat rounded rects with a subtle rim + drop shadow.
 */
import { Group, RoundedRect, Shadow } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { CLEAR_POP_SCALE } from './constants';

interface GridTileProps {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly radius: number;
  readonly color: string;
  readonly rimColor: string;
  /** This tile is fading out as part of a cleared group this wave. */
  readonly clearing: boolean;
  /** Pixel start offset for a fall/spawn drop (negative = above); 0 = at rest. */
  readonly startDy: number;
  /** Hidden because it is the held tile, drawn by {@link FloatingTile} instead. */
  readonly hidden: boolean;
  /** Shared 0..1 animation clock for the current segment. */
  readonly progress: SharedValue<number>;
}

export function GridTile({
  x,
  y,
  size,
  radius,
  color,
  rimColor,
  clearing,
  startDy,
  hidden,
  progress,
}: GridTileProps) {
  const origin = { x: x + size / 2, y: y + size / 2 };

  const transform = useDerivedValue(() => {
    const p = progress.value;
    const dy = startDy !== 0 ? startDy * (1 - p) : 0;
    const scale = clearing ? 1 + (CLEAR_POP_SCALE - 1) * p : 1;
    return [{ translateY: dy }, { scale }];
  });

  const opacity = useDerivedValue(() => {
    if (hidden) return 0;
    if (clearing) return 1 - progress.value;
    return 1;
  });

  return (
    <Group transform={transform} origin={origin} opacity={opacity}>
      <RoundedRect x={x} y={y} width={size} height={size} r={radius} color={color} />
      <RoundedRect
        x={x}
        y={y}
        width={size}
        height={size}
        r={radius}
        color={rimColor}
        style="stroke"
        strokeWidth={2}
      />
    </Group>
  );
}

interface FloatingTileProps {
  readonly size: number;
  readonly radius: number;
  readonly color: string;
  readonly rimColor: string;
  readonly fingerX: SharedValue<number>;
  readonly fingerY: SharedValue<number>;
  /** Lift scale (grows on pick-up). */
  readonly scale: SharedValue<number>;
}

export function FloatingTile({
  size,
  radius,
  color,
  rimColor,
  fingerX,
  fingerY,
  scale,
}: FloatingTileProps) {
  const half = size / 2;
  // Translate to the finger, then scale around the tile's own center (origin 0,0).
  const transform = useDerivedValue(() => [
    { translateX: fingerX.value },
    { translateY: fingerY.value },
    { scale: scale.value },
  ]);

  return (
    <Group transform={transform}>
      <RoundedRect x={-half} y={-half} width={size} height={size} r={radius} color={color}>
        <Shadow dx={0} dy={4} blur={8} color="#00000070" />
      </RoundedRect>
      <RoundedRect
        x={-half}
        y={-half}
        width={size}
        height={size}
        r={radius}
        color={rimColor}
        style="stroke"
        strokeWidth={2}
      />
    </Group>
  );
}
