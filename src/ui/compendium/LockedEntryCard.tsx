/**
 * A LOCKED compendium entry: a silhouette (❓) with the name hidden behind "Undiscovered". Shared by
 * the relic / enemy / boss sections so an undiscovered entry reads the same everywhere. Presentational.
 */
import { StyleSheet, Text, View } from 'react-native';
import { COMBAT_COLORS } from '../combat/combatColors';

interface LockedEntryCardProps {
  /** The locked silhouette glyph (defaults to ❓). */
  readonly glyph?: string;
  /** The hidden-name label (e.g. "Undiscovered"). */
  readonly label: string;
  /** Optional sub-line (e.g. "Fight it to reveal" / "Reach its biome to reveal"). */
  readonly hint?: string;
}

export function LockedEntryCard({ glyph = '❓', label, hint }: LockedEntryCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.glyph}>{glyph}</Text>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {hint !== undefined ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COMBAT_COLORS.hpTrack,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COMBAT_COLORS.panelBorder,
    borderStyle: 'dashed',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  glyph: {
    fontSize: 26,
    opacity: 0.5,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  label: {
    color: COMBAT_COLORS.subtle,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  hint: {
    color: COMBAT_COLORS.subtle,
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.8,
  },
});
