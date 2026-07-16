/**
 * The run-end screen (victory or defeat): the run summary (encounters cleared, floors reached,
 * relics, gold) plus the owned relics, and the two exits — "New run" (a clean reset) and the
 * main menu. All numbers come from the pure `computeRunSummary` view-model; the save was already
 * cleared when the run went terminal.
 */
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Redirect } from 'expo-router';
import { RelicCardView } from './RelicCardView';
import { relicCards } from './relicPresentation';
import { computeRunSummary } from './runSummary';
import { RUN_COLORS } from './runColors';
import { useRun } from './RunContext';

interface RunOutcomeScreenProps {
  readonly outcome: 'victory' | 'defeat';
}

export function RunOutcomeScreen({ outcome }: RunOutcomeScreenProps) {
  const run = useRun();
  const state = run.state;
  if (state === null) {
    return <Redirect href="/" />;
  }

  const summary = computeRunSummary(state);
  const won = outcome === 'victory';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={[styles.title, { color: won ? RUN_COLORS.winText : RUN_COLORS.loseText }]}>
        {won ? 'Run Complete' : 'You Died'}
      </Text>
      <Text style={styles.subtitle}>
        {won ? 'The Bone Colossus falls. The dungeon is yours.' : `Fell on floor ${summary.floorsReached + 1} of ${summary.floorCount}.`}
      </Text>

      <View style={styles.statGrid}>
        <Stat label="Nodes cleared" value={`${summary.nodesCompleted}`} />
        <Stat label="Floors reached" value={`${summary.floorsReached + 1}/${summary.floorCount}`} />
        <Stat label="Relics" value={`${summary.relicCount}`} />
        <Stat label="Gold" value={`${summary.gold}`} />
        <Stat label="HP" value={`${summary.hp}/${summary.maxHp}`} />
        <Stat label="Reached boss" value={summary.reachedBoss ? 'Yes' : 'No'} />
      </View>

      {summary.relicCount > 0 ? (
        <View style={styles.relics}>
          <Text style={styles.sectionLabel}>Relics collected</Text>
          {relicCards(summary.relicIds).map((card) => (
            <RelicCardView key={card.id} card={card} compact />
          ))}
        </View>
      ) : null}

      <View style={styles.buttons}>
        <Pressable onPress={run.startNewRun} style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>New run</Text>
        </Pressable>
        <Pressable onPress={run.goToMenu} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>Main menu</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: RUN_COLORS.screenBg },
  content: { paddingTop: 80, paddingHorizontal: 20, paddingBottom: 44, gap: 14, alignItems: 'stretch' },
  title: { fontSize: 34, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: RUN_COLORS.subtle, fontSize: 15, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: {
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: RUN_COLORS.panelBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: RUN_COLORS.panelBorder,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { color: RUN_COLORS.text, fontSize: 22, fontWeight: '900' },
  statLabel: { color: RUN_COLORS.subtle, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  relics: { gap: 10, marginTop: 6 },
  sectionLabel: { color: RUN_COLORS.subtle, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  buttons: { gap: 12, marginTop: 12 },
  button: { backgroundColor: RUN_COLORS.buttonBg, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  primary: { backgroundColor: RUN_COLORS.accent },
  buttonText: { color: RUN_COLORS.buttonText, fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.7 },
});
