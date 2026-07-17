/**
 * The run-end screen (victory or defeat): the run summary (encounters cleared, floors reached,
 * relics, gold) plus the owned relics, and the two exits — "New run" (to the start-selection
 * picker, so a just-unlocked variant is one tap away) and the main menu. All numbers come from the
 * pure `computeRunSummary` view-model; the save was already cleared when the run went terminal.
 */
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Redirect } from 'expo-router';
import { getBossForBiome, getVariant } from '../../engine/run';
import { RelicCardView } from './RelicCardView';
import { CeremonyCardView } from './CeremonyCardView';
import { ceremonyCards } from './unlockCeremony';
import { relicCards } from './relicPresentation';
import { computeRunSummary } from './runSummary';
import { bankRunOutcome } from './metaController';
import type { BankOutcome } from './metaBanking';
import { RUN_COLORS } from './runColors';
import { useRun } from './RunContext';

interface RunOutcomeScreenProps {
  readonly outcome: 'victory' | 'defeat';
}

export function RunOutcomeScreen({ outcome }: RunOutcomeScreenProps) {
  const run = useRun();
  const state = run.state;
  const [bank, setBank] = useState<BankOutcome | null>(null);

  // Bank this terminal run's score into the meta profile — exactly ONCE. The controller's ledger
  // guard (keyed by run identity) makes a re-mount / re-visit of this screen a no-op that replays
  // the same outcome, so the score can never double-count. The banked outcome drives the display.
  useEffect(() => {
    if (state === null) return;
    setBank(bankRunOutcome(state));
  }, [state]);

  if (state === null) {
    return <Redirect href="/" />;
  }

  const summary = computeRunSummary(state);
  const won = outcome === 'victory';
  const sacrificed = state.status === 'sacrificed';

  const title = won ? 'Run Complete' : sacrificed ? 'Sacrificed' : 'You Died';
  const subtitle = won
    ? `${getBossForBiome(state.act2BiomeId).name} falls. The run is yours.`
    : sacrificed
      ? 'You gave this run to the altar — a relic is bound to you forever.'
      : `Fell on floor ${summary.floorsReached + 1} of ${summary.floorCount}.`;

  const ceremonies = bank === null ? [] : ceremonyCards(bank.unlockEvents);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={[styles.title, { color: won ? RUN_COLORS.winText : sacrificed ? RUN_COLORS.gold : RUN_COLORS.loseText }]}>
        {title}
      </Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {bank !== null ? (
        <View style={styles.metaPanel}>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreBanked}>+{bank.runScore}</Text>
            <Text style={styles.scoreBankedLabel}>score banked</Text>
          </View>
          <Text style={styles.totalScore}>Total score {bank.totalScore}</Text>
          {bank.newlyUnlockedIds.length > 0 ? (
            <View style={styles.unlockBanner}>
              <Text style={styles.unlockText}>
                🔓 Unlocked: {bank.newlyUnlockedIds.map((id) => getVariant(id).name).join(', ')}!
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {ceremonies.length > 0 ? (
        <View style={styles.ceremonies}>
          <Text style={styles.sectionLabel}>Unlocked this run</Text>
          {ceremonies.map((card) => (
            <CeremonyCardView key={card.key} card={card} />
          ))}
        </View>
      ) : null}

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
        <Pressable onPress={run.goToStartSelect} style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}>
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
  metaPanel: {
    backgroundColor: RUN_COLORS.panelBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: RUN_COLORS.panelBorder,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 6,
    alignItems: 'center',
  },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  scoreBanked: { color: RUN_COLORS.gold, fontSize: 30, fontWeight: '900' },
  scoreBankedLabel: { color: RUN_COLORS.subtle, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  totalScore: { color: RUN_COLORS.text, fontSize: 15, fontWeight: '700' },
  unlockBanner: {
    marginTop: 6,
    backgroundColor: RUN_COLORS.accent,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  unlockText: { color: RUN_COLORS.winText, fontSize: 15, fontWeight: '900', textAlign: 'center' },
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
  ceremonies: { gap: 10, marginTop: 6 },
  sectionLabel: { color: RUN_COLORS.subtle, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  buttons: { gap: 12, marginTop: 12 },
  button: { backgroundColor: RUN_COLORS.buttonBg, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  primary: { backgroundColor: RUN_COLORS.accent },
  buttonText: { color: RUN_COLORS.buttonText, fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.7 },
});
