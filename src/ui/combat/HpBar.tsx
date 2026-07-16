/**
 * An animated HP bar: a track with a fill whose width animates to the target
 * `fraction` whenever it changes, shifting toward a warning color at low HP. Plain
 * Reanimated views (not Skia), mirroring `MoveTimerBar`. Purely presentational —
 * the fraction/label are computed by the pure `combatFormat` helpers upstream.
 */
import { View, StyleSheet, Text } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { COMBAT_COLORS } from './combatColors';
import { HP_ANIM_MS } from './combatConstants';

interface HpBarProps {
  /** Row label, e.g. the enemy name or "You". */
  readonly name: string;
  /** `12/30` style HP readout. */
  readonly hpLabel: string;
  /** Target fill fraction, 0..1. */
  readonly fraction: number;
  /** Track pixel width the fill animates within. */
  readonly width: number;
  /** Full-HP fill color (shifts to the warning color as HP drops). */
  readonly fillColor: string;
}

const BAR_HEIGHT = 14;

export function HpBar({ name, hpLabel, fraction, width, fillColor }: HpBarProps) {
  const fill = useSharedValue(fraction);

  useEffect(() => {
    fill.value = withTiming(fraction, { duration: HP_ANIM_MS });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fraction]);

  const fillStyle = useAnimatedStyle(() => ({
    width: Math.max(0, fill.value) * width,
    backgroundColor: interpolateColor(
      fill.value,
      [0, 0.3, 1],
      [COMBAT_COLORS.hpLow, COMBAT_COLORS.hpLow, fillColor],
    ),
  }));

  return (
    <View style={[styles.row, { width }]}>
      <View style={styles.labels}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.hp}>{hpLabel}</Text>
      </View>
      <View style={[styles.track, { width, height: BAR_HEIGHT }]}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 4,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  name: {
    color: COMBAT_COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  hp: {
    color: COMBAT_COLORS.subtle,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  track: {
    backgroundColor: COMBAT_COLORS.hpTrack,
    borderRadius: BAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: BAR_HEIGHT / 2,
  },
});
