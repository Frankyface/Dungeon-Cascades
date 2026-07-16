/**
 * The draft screen: after a fight/elite win, offer the engine's 3 relic options (name / effect /
 * flavor). Picking one adds it and returns to the map; skipping is always allowed. Every choice
 * goes through the provider → engine (`resolveDraftPick`); this screen only renders the options.
 */
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Redirect } from 'expo-router';
import { RelicCardView } from './RelicCardView';
import { relicCards } from './relicPresentation';
import { RUN_COLORS } from './runColors';
import { RunHud } from './RunHud';
import { useRun } from './RunContext';

export function DraftScreen() {
  const run = useRun();
  const state = run.state;
  if (state === null || state.phase.kind !== 'draft') {
    return <Redirect href="/run" />;
  }

  const cards = relicCards(state.phase.options);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <RunHud />
        <Text style={styles.title}>Choose a relic</Text>
        <Text style={styles.subtitle}>Victory spoils — pick one, or skip.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {cards.map((card) => (
          <RelicCardView key={card.id} card={card} onPress={() => run.pickRelic(card.id)} />
        ))}
        <Pressable
          onPress={() => run.pickRelic(null)}
          style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: RUN_COLORS.screenBg,
    paddingTop: 56,
  },
  header: {
    paddingHorizontal: 16,
    gap: 6,
    paddingBottom: 8,
  },
  title: {
    color: RUN_COLORS.text,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 6,
  },
  subtitle: {
    color: RUN_COLORS.subtle,
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  skip: {
    marginTop: 6,
    backgroundColor: RUN_COLORS.buttonBg,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  skipText: {
    color: RUN_COLORS.buttonText,
    fontSize: 16,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.7,
  },
});
