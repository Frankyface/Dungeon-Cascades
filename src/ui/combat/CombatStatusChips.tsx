/**
 * A compact row of active biome-channel status chips shown on the combat screen (review H1): the
 * enemy's frost shield / one-shot armor and the player's rot / curse, so the numbers that drive the
 * mitigated damage/heal are VISIBLE, not hidden. Purely presentational — the pure `buildStatusChips`
 * derives the chips from the live `CombatState`, so a default-biome fight (no channels) renders nothing.
 */
import { View, StyleSheet, Text } from 'react-native';
import type { CombatState } from '../../engine/combat';
import { COMBAT_COLORS } from './combatColors';
import { buildStatusChips } from './combatFormat';

interface CombatStatusChipsProps {
  readonly combat: Pick<CombatState, 'enemyShield' | 'enemyArmor' | 'rotStacks' | 'curseTurns'>;
  readonly width: number;
}

export function CombatStatusChips({ combat, width }: CombatStatusChipsProps) {
  const chips = buildStatusChips(combat);
  if (chips.length === 0) {
    return null;
  }
  return (
    <View style={[styles.row, { width }]}>
      {chips.map((chip) => (
        <View key={chip.key} style={styles.chip}>
          <Text style={styles.glyph}>{chip.glyph}</Text>
          <Text style={[styles.label, { color: chip.tint }]}>{chip.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COMBAT_COLORS.hpTrack,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COMBAT_COLORS.panelBorder,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  glyph: {
    fontSize: 13,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
  },
});
