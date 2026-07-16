/**
 * The start-selection screen (Stage 4): the player picks how to begin a run. Vanilla is the first
 * card and always available; unlocked variants follow; locked variants are shown with unlock
 * progress but can't be picked. Choosing a card stages a run through the existing `runController`
 * flow (`stageNewRun(seed, variantId?)`) and hands off to the run group — identical to how the menu
 * started a vanilla run, now with the variant threaded in.
 *
 * This screen lives ABOVE the run provider (it runs before any run exists), so it reads the meta
 * profile from `metaController`, not from a run context.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MetaState } from '../../engine/run';
import { hydrateMetaStore, metaState } from './metaController';
import { makeRunSeed, stageNewRun } from './runController';
import { startCards } from './variantPresentation';
import { StartCardView } from './StartCardView';
import { RUN_COLORS } from './runColors';

export function StartSelectScreen() {
  const router = useRouter();
  // Read the live profile now (the menu already hydrated it); re-adopt on mount so the screen is
  // correct even if reached before hydration settled. hydrateMetaStore is idempotent.
  const [meta, setMeta] = useState<MetaState>(() => metaState());
  useEffect(() => {
    let active = true;
    hydrateMetaStore()
      .then((m) => {
        if (active) setMeta(m);
      })
      .catch(() => {
        /* hydrate treats failure as a fresh profile — vanilla stays available, all variants locked */
      });
    return () => {
      active = false;
    };
  }, []);

  const cards = startCards(meta);

  const pick = (variantId: string | null): void => {
    // null → vanilla (undefined variant); an unlocked variant id otherwise. Stages + persists the
    // run, then the run group's provider picks it up on mount.
    stageNewRun(makeRunSeed(), variantId ?? undefined);
    router.replace('/run');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Choose your start</Text>
        <Text style={styles.subtitle}>Power-neutral sidegrades · unlock more by climbing</Text>
        <Text style={styles.total}>Total score {meta.score}</Text>
      </View>

      {cards.map((card) => (
        <StartCardView
          key={card.variantId ?? 'vanilla'}
          card={card}
          onPress={card.locked ? undefined : () => pick(card.variantId)}
        />
      ))}

      <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: RUN_COLORS.screenBg,
  },
  content: {
    paddingTop: 72,
    paddingBottom: 40,
    paddingHorizontal: 20,
    gap: 12,
    alignItems: 'stretch',
  },
  header: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  title: {
    color: RUN_COLORS.text,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: RUN_COLORS.subtle,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  total: {
    color: RUN_COLORS.gold,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  backButton: {
    backgroundColor: RUN_COLORS.buttonBg,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
  },
  backText: {
    color: RUN_COLORS.buttonText,
    fontSize: 16,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.7,
  },
});
