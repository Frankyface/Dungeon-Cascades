/**
 * The ACT TRANSITION screen (spec §1) — the "Act 1 cleared" beat between the Bone Colossus and the
 * Act-2 map. It shows the transition HEAL, REVEALS the run's seeded Act-2 biome (name, theme, tint),
 * and — the first time Act 2 lands on a biome — plays the unlock CEREMONY (biome unlocked + its
 * legendary relic). Continue calls `advanceToAct2` (heal + persist the unlocks + build the Act-2 map).
 *
 * All numbers/strings come from the pure `computeActTransition` view-model; this file only lays out
 * views and tints them by the revealed biome's theme.
 */
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Redirect } from 'expo-router';
import { computeActTransition } from './transitionModel';
import { CeremonyCardView } from './CeremonyCardView';
import { metaState } from './metaController';
import { routeForRunState } from './runRoute';
import { RUN_COLORS } from './runColors';
import { useRun } from './RunContext';

export function ActTransitionScreen() {
  const run = useRun();
  const state = run.state;

  if (state === null) {
    return <Redirect href="/" />;
  }
  // Resume safety: if a saved run lands here but is not actually at the transition, bounce to its
  // real screen (the transition is a forced single-step phase, so this only guards a stale entry).
  if (state.phase.kind !== 'act_transition') {
    return <Redirect href={routeForRunState(state)} />;
  }

  const view = computeActTransition(state, metaState());
  const { theme } = view;

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.tint }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.kicker}>Act 1 Cleared</Text>
      <Text style={styles.title}>{view.fromBiomeName} lies behind you</Text>

      <View style={[styles.healPill, { borderColor: theme.ring }]}>
        <Text style={[styles.healText, { color: theme.ring }]}>
          ✚ Healed {view.healAmount} HP · {view.healedHp}/{view.maxHp}
        </Text>
      </View>

      {/* Act-2 biome reveal */}
      <View style={[styles.revealCard, { borderColor: theme.accent, backgroundColor: RUN_COLORS.panelBg }]}>
        <Text style={styles.revealKicker}>Descending into Act 2</Text>
        <Text style={[styles.revealName, { color: theme.ring }]}>{view.toBiomeName}</Text>
        <Text style={styles.revealTheme}>{view.toBiomeTheme}</Text>
      </View>

      {/* First-reach unlock ceremony */}
      {view.headlines.length > 0 ? (
        <View style={styles.ceremonies}>
          <Text style={styles.sectionLabel}>A new biome opens to you</Text>
          {view.headlines.map((card) => (
            <CeremonyCardView key={card.key} card={card} />
          ))}
          {view.discoveries.total > 0 ? (
            <Text style={styles.discoveryLine}>
              📖 {view.discoveries.total} new compendium {view.discoveries.total === 1 ? 'entry' : 'entries'} revealed
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.knownBiome}>You have walked these halls before — the way is already known.</Text>
      )}

      <Pressable
        onPress={run.advanceToAct2}
        style={({ pressed }) => [styles.button, { backgroundColor: theme.accent }, pressed && styles.pressed]}
      >
        <Text style={[styles.buttonText, { color: theme.onAccent }]}>Enter {view.toBiomeName} ›</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingTop: 90, paddingHorizontal: 20, paddingBottom: 44, gap: 16, alignItems: 'stretch' },
  kicker: {
    color: RUN_COLORS.subtle,
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
    textAlign: 'center',
  },
  title: { color: RUN_COLORS.text, fontSize: 26, fontWeight: '900', textAlign: 'center' },
  healPill: {
    alignSelf: 'center',
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  healText: { fontSize: 15, fontWeight: '800' },
  revealCard: {
    borderWidth: 1.5,
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 18,
    gap: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  revealKicker: {
    color: RUN_COLORS.subtle,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  revealName: { fontSize: 28, fontWeight: '900', textAlign: 'center' },
  revealTheme: { color: RUN_COLORS.subtle, fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
  ceremonies: { gap: 10 },
  sectionLabel: {
    color: RUN_COLORS.subtle,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
  },
  discoveryLine: { color: RUN_COLORS.subtle, fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 2 },
  knownBiome: { color: RUN_COLORS.subtle, fontSize: 14, fontWeight: '600', textAlign: 'center', fontStyle: 'italic' },
  button: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 6 },
  buttonText: { fontSize: 17, fontWeight: '900' },
  pressed: { opacity: 0.7 },
});
