/**
 * The boss compendium card: the Bone Colossus's floor-scaled HP, its three phases (each with an HP
 * band, the affinity shift as chips, and the scaled intent cycle), and the telegraph fairness note.
 * Presentational — every value comes from the pure `compendiumBoss` view-model.
 */
import { StyleSheet, Text, View } from 'react-native';
import { AffinityChipsView } from '../combat/AffinityChipsView';
import { COMBAT_COLORS } from '../combat/combatColors';
import type { CompendiumBossEntry, CompendiumBossPhaseEntry } from './compendiumModel';

interface CompendiumBossCardProps {
  readonly entry: CompendiumBossEntry;
}

export function CompendiumBossCard({ entry }: CompendiumBossCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>
          {entry.glyph} {entry.name}
        </Text>
        <Text style={styles.hp}>{entry.maxHp} HP</Text>
      </View>
      <Text style={styles.sub}>
        Floor {entry.floor} · scaled from {entry.baseHp} base
      </Text>

      {entry.phases.map((phase, i) => (
        <PhaseBlock key={phase.name} phase={phase} index={i} />
      ))}

      <View style={styles.fairness}>
        <Text style={styles.fairnessText}>🛡 {entry.fairnessNote}</Text>
      </View>
    </View>
  );
}

function PhaseBlock({ phase, index }: { readonly phase: CompendiumBossPhaseEntry; readonly index: number }) {
  return (
    <View style={styles.phase}>
      <View style={styles.phaseHeader}>
        <Text style={styles.phaseName}>
          Phase {index + 1} · {phase.name}
        </Text>
        <Text style={styles.phaseHp}>{phase.hpBand}</Text>
      </View>
      <AffinityChipsView chips={phase.affinity} />
      <Text style={styles.cycle}>{phase.scriptCycle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COMBAT_COLORS.panelBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#5a3140',
    paddingVertical: 15,
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
    fontSize: 21,
    fontWeight: '900',
    flexShrink: 1,
  },
  hp: {
    color: COMBAT_COLORS.hpLow,
    fontSize: 16,
    fontWeight: '900',
  },
  sub: {
    color: COMBAT_COLORS.subtle,
    fontSize: 13,
    fontWeight: '600',
  },
  phase: {
    gap: 6,
    backgroundColor: COMBAT_COLORS.hpTrack,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  phaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  phaseName: {
    color: COMBAT_COLORS.text,
    fontSize: 15,
    fontWeight: '800',
    flexShrink: 1,
  },
  phaseHp: {
    color: COMBAT_COLORS.subtle,
    fontSize: 13,
    fontWeight: '800',
  },
  cycle: {
    color: COMBAT_COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  fairness: {
    borderTopWidth: 1,
    borderTopColor: COMBAT_COLORS.panelBorder,
    paddingTop: 10,
  },
  fairnessText: {
    color: COMBAT_COLORS.chargeTint,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});
