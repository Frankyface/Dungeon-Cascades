/**
 * The player panel: an animated HP bar with numbers. Deliberately minimal — the
 * board below is the player's "kit"; this panel just shows survival. Presentational.
 */
import { View, StyleSheet } from 'react-native';
import { COMBAT_COLORS } from './combatColors';
import { HpBar } from './HpBar';
import { formatHp, hpFraction } from './combatFormat';

interface PlayerPanelProps {
  readonly hp: number;
  readonly maxHp: number;
  readonly width: number;
}

const PANEL_PAD = 14;

export function PlayerPanel({ hp, maxHp, width }: PlayerPanelProps) {
  return (
    <View style={[styles.panel, { width }]}>
      <HpBar
        name="You"
        hpLabel={formatHp(hp, maxHp)}
        fraction={hpFraction(hp, maxHp)}
        width={width - 2 * PANEL_PAD}
        fillColor={COMBAT_COLORS.playerFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: COMBAT_COLORS.panelBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COMBAT_COLORS.panelBorder,
    padding: PANEL_PAD,
  },
});
