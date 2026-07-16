/**
 * One enemy's compendium card: glyph + name, base HP, affinity chips (reused from combat), the
 * intent cycle, and an elite-scaled example line labelled with the sample floor. Presentational —
 * every value comes from the pure `compendiumEnemy` view-model.
 */
import { StyleSheet, Text, View } from 'react-native';
import { AffinityChipsView } from '../combat/AffinityChipsView';
import { COMBAT_COLORS } from '../combat/combatColors';
import type { CompendiumEnemyEntry } from './compendiumModel';

interface CompendiumEnemyCardProps {
  readonly entry: CompendiumEnemyEntry;
}

export function CompendiumEnemyCard({ entry }: CompendiumEnemyCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>
          {entry.glyph} {entry.name}
        </Text>
        <Text style={styles.hp}>{entry.baseHp} HP</Text>
      </View>

      <AffinityChipsView chips={entry.affinity} emptyLabel="No affinities — hit it with anything." />

      <View style={styles.intentBlock}>
        <Text style={styles.label}>Intent cycle</Text>
        <Text style={styles.cycle}>{entry.scriptCycle}</Text>
      </View>

      <View style={styles.eliteBlock}>
        <View style={styles.eliteBadge}>
          <Text style={styles.eliteBadgeText}>Elite · floor {entry.elite.floor}</Text>
        </View>
        <Text style={styles.eliteText}>
          {entry.elite.hp} HP · {entry.elite.scriptCycle}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COMBAT_COLORS.panelBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COMBAT_COLORS.panelBorder,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: COMBAT_COLORS.text,
    fontSize: 19,
    fontWeight: '800',
    flexShrink: 1,
  },
  hp: {
    color: COMBAT_COLORS.subtle,
    fontSize: 15,
    fontWeight: '800',
  },
  intentBlock: {
    gap: 3,
  },
  label: {
    color: COMBAT_COLORS.subtle,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cycle: {
    color: COMBAT_COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  eliteBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: COMBAT_COLORS.panelBorder,
    paddingTop: 10,
  },
  eliteBadge: {
    backgroundColor: '#3a2a4d',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  eliteBadgeText: {
    color: '#d7b8ff',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eliteText: {
    color: COMBAT_COLORS.subtle,
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
});
