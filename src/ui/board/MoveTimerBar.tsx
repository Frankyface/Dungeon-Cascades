/**
 * The move timer as a depleting bar. Idle = full (a "ready" bar); once the move
 * timer starts (first committed step) it drains linearly to empty over the timer
 * duration and shifts blue -> red as it runs low. On move end it refills.
 *
 * The bar is a plain Reanimated view (not Skia) laid out above the board. It is
 * driven by the discrete timer status from the reducer, plus a `runNonce` that the
 * parent bumps exactly when a fresh countdown should begin.
 */
import { View, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { BOARD_COLORS } from './colors';

interface MoveTimerBarProps {
  readonly width: number;
  readonly durationMs: number;
  /** Bumped each time a move's countdown begins. */
  readonly runNonce: number;
  /** Whether the countdown is currently active. */
  readonly running: boolean;
}

const BAR_HEIGHT = 10;
const REFILL_MS = 200;

export function MoveTimerBar({ width, durationMs, runNonce, running }: MoveTimerBarProps) {
  // fill: 1 = full, 0 = empty.
  const fill = useSharedValue(1);

  useEffect(() => {
    if (runNonce > 0) {
      cancelAnimation(fill);
      fill.value = 1;
      fill.value = withTiming(0, { duration: durationMs, easing: Easing.linear });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runNonce]);

  useEffect(() => {
    if (!running) {
      cancelAnimation(fill);
      fill.value = withTiming(1, { duration: REFILL_MS });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const fillStyle = useAnimatedStyle(() => ({
    width: fill.value * width,
    backgroundColor: interpolateColor(
      fill.value,
      [0, 0.35, 1],
      [BOARD_COLORS.timerFillLow, BOARD_COLORS.timerFillLow, BOARD_COLORS.timerFill],
    ),
  }));

  return (
    <View style={[styles.track, { width, height: BAR_HEIGHT }]}>
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: BOARD_COLORS.timerTrack,
    borderRadius: BAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: BAR_HEIGHT / 2,
  },
});
