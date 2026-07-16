/**
 * The affinity-chip block: the enemy's weak / resist / immune colors as tinted chips, grouped by
 * tier. Presentational and shared — the combat `EnemyPanel` and the Compendium both render it, so
 * the chip styling lives in exactly one place. Chip labels (glyph + multiplier) come from the pure
 * `combatFormat.buildAffinityChips`, so tuned affinity values flow through automatically.
 */
import { StyleSheet, Text, View } from 'react-native';
import { COMBAT_COLORS } from './combatColors';
import type { AffinityChip, AffinityChips } from './combatFormat';

interface ChipTint {
  readonly bg: string;
  readonly color: string;
}

const WEAK_TINT: ChipTint = { bg: COMBAT_COLORS.weakBg, color: COMBAT_COLORS.weakText };
const RESIST_TINT: ChipTint = { bg: COMBAT_COLORS.resistBg, color: COMBAT_COLORS.resistText };

function ChipRow({
  heading,
  chips,
  tint,
}: {
  readonly heading: string;
  readonly chips: readonly AffinityChip[];
  readonly tint: ChipTint;
}) {
  if (chips.length === 0) {
    return null;
  }
  return (
    <View style={styles.chipRow}>
      <Text style={styles.chipHeading}>{heading}</Text>
      {chips.map((chip) => (
        <View key={`${heading}-${chip.color}`} style={[styles.chip, { backgroundColor: tint.bg }]}>
          <Text style={[styles.chipText, { color: tint.color }]}>{chip.label}</Text>
        </View>
      ))}
    </View>
  );
}

interface AffinityChipsViewProps {
  readonly chips: AffinityChips;
  /** Text shown when the enemy has no weak/resist/immune colors (all normal). Omit to render nothing. */
  readonly emptyLabel?: string;
}

export function AffinityChipsView({ chips, emptyLabel }: AffinityChipsViewProps) {
  const total = chips.weak.length + chips.resist.length + chips.immune.length;
  if (total === 0 && emptyLabel !== undefined) {
    return <Text style={styles.empty}>{emptyLabel}</Text>;
  }
  return (
    <View style={styles.chips}>
      <ChipRow heading="Weak" chips={chips.weak} tint={WEAK_TINT} />
      <ChipRow heading="Resists" chips={chips.resist} tint={RESIST_TINT} />
      <ChipRow heading="Immune" chips={chips.immune} tint={RESIST_TINT} />
    </View>
  );
}

const styles = StyleSheet.create({
  chips: {
    gap: 6,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  chipHeading: {
    color: COMBAT_COLORS.subtle,
    fontSize: 12,
    fontWeight: '700',
    width: 58,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  empty: {
    color: COMBAT_COLORS.subtle,
    fontSize: 13,
    fontWeight: '600',
  },
});
