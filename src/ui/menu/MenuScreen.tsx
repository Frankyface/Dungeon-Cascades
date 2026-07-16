/**
 * The root menu. The headline entry is THE RUN (Stage 3): start a fresh rogue-lite run, or —
 * when a saved run exists (checked by hydrating the storage adapter on mount) — Continue it or
 * Abandon it. Below that, the Stage-1/2 sandbox stays reachable: the "Naked Board" and a fight
 * per enemy (driven by the engine registry so it stays in sync, each row previewing the weakness).
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ENEMY_IDS, getEnemy } from '../../engine/combat';
import type { EnemyId } from '../../engine/combat';
import { COMBAT_COLORS } from '../combat/combatColors';
import { ENEMY_GLYPH, buildAffinityChips, enemyName } from '../combat/combatFormat';
import { hydrateRunStore, isRunStoreHydrated, runStore, stageResumeRun } from '../run/runController';
import { hydrateMetaStore, isMetaStoreHydrated, metaState } from '../run/metaController';
import { menuHydration, runSection, type MenuHydration } from './menuState';

function weaknessHint(enemyId: EnemyId): string {
  const chips = buildAffinityChips(getEnemy(enemyId).affinity);
  if (chips.weak.length === 0) {
    return 'No weakness';
  }
  return `Weak: ${chips.weak.map((c) => c.label).join(' ')}`;
}

export function MenuScreen() {
  const router = useRouter();
  // Lazy-init from the store: on a warm remount (returning from a run) the mirror is already
  // hydrated, so the run section renders its final state with no "Loading…" flash.
  const [hasSave, setHasSave] = useState(() => runStore().load() !== null);
  const [totalScore, setTotalScore] = useState(() => metaState().score);
  const [hydration, setHydration] = useState<MenuHydration>(() =>
    menuHydration(isRunStoreHydrated(), isMetaStoreHydrated()),
  );

  // Cold-start: hydrate BOTH the saved run and the meta profile from disk BEFORE the run section
  // becomes interactive. The run store guards against a premature "Start a run" tap clobbering an
  // unread save; the meta store must be adopted before a run starts so variant unlocks and score
  // banking act on the real profile, not a blank one. Both reads are idempotent, so a warm remount
  // resolves instantly; a failed read falls back to "no save" / a fresh profile.
  useEffect(() => {
    let active = true;
    Promise.all([hydrateRunStore(), hydrateMetaStore()])
      .then(([saved, meta]) => {
        if (!active) return;
        setHasSave(saved !== null);
        setTotalScore(meta.score);
        setHydration('ready');
      })
      .catch(() => {
        if (!active) return;
        setHasSave(false);
        setHydration('ready');
      });
    return () => {
      active = false;
    };
  }, []);

  // Starting a run now leads to the start-selection screen (vanilla + any unlocked variants),
  // which stages the chosen start and hands off to the run group.
  const goToStartSelect = (): void => {
    router.push('/start');
  };

  const continueRun = (): void => {
    if (stageResumeRun() === null) {
      setHasSave(false);
      return;
    }
    router.push('/run');
  };

  const abandonRun = (): void => {
    runStore().clear();
    setHasSave(false);
  };

  const section = runSection(hydration, hasSave);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Dungeon Cascades</Text>
        <Text style={styles.subtitle}>Stage 3 · The Run</Text>
        {hydration === 'ready' ? <Text style={styles.metaScore}>Total score {totalScore}</Text> : null}
      </View>

      <Text style={styles.sectionLabel}>The Run</Text>

      {section.kind === 'loading' ? (
        // Hydration in flight: a non-interactive placeholder — Start/Continue can't fire yet, so a
        // premature tap can't clobber an unread save.
        <View style={[styles.card, styles.runCard, styles.cardDisabled]}>
          <Text style={styles.cardTitle}>Loading…</Text>
          <Text style={styles.cardHint}>Checking for a saved run</Text>
        </View>
      ) : section.kind === 'resume' ? (
        <>
          <Pressable
            onPress={continueRun}
            style={({ pressed }) => [styles.card, styles.runCard, pressed && styles.pressed]}
          >
            <Text style={styles.cardTitle}>▶ Continue run</Text>
            <Text style={styles.cardHint}>Pick up your saved run where you left off</Text>
          </Pressable>
          <Pressable onPress={abandonRun} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
            <Text style={styles.cardTitle}>🗑 Abandon run</Text>
            <Text style={styles.cardHint}>Delete the save and clear the slot</Text>
          </Pressable>
          <Pressable onPress={goToStartSelect} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
            <Text style={styles.cardTitle}>✦ Start a new run</Text>
            <Text style={styles.cardHint}>Abandon the current save and begin fresh</Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          onPress={goToStartSelect}
          style={({ pressed }) => [styles.card, styles.runCard, pressed && styles.pressed]}
        >
          <Text style={styles.cardTitle}>⚔ Start a run</Text>
          <Text style={styles.cardHint}>Pick your start — vanilla or an unlocked variant</Text>
        </Pressable>
      )}

      <Text style={styles.sectionLabel}>Sandbox</Text>

      <Pressable
        onPress={() => router.push('/board')}
        style={({ pressed }) => [styles.card, styles.boardCard, pressed && styles.pressed]}
      >
        <Text style={styles.cardTitle}>🎛 Naked Board</Text>
        <Text style={styles.cardHint}>Stage 1 sandbox — no enemy, just cascades</Text>
      </Pressable>

      <Text style={styles.sectionLabel}>Fight</Text>

      {ENEMY_IDS.map((id) => (
        <Pressable
          key={id}
          onPress={() => router.push(`/combat/${id}`)}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
          <View style={styles.enemyRow}>
            <Text style={styles.cardTitle}>
              {ENEMY_GLYPH[id]} {enemyName(id)}
            </Text>
            <Text style={styles.enemyHp}>{getEnemy(id).maxHp} HP</Text>
          </View>
          <Text style={styles.cardHint}>{weaknessHint(id)}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COMBAT_COLORS.screenBg,
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
    marginBottom: 12,
  },
  title: {
    color: COMBAT_COLORS.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: COMBAT_COLORS.subtle,
    fontSize: 14,
    fontWeight: '600',
  },
  metaScore: {
    color: '#f5c542',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  sectionLabel: {
    color: COMBAT_COLORS.subtle,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 10,
    marginLeft: 4,
  },
  card: {
    backgroundColor: COMBAT_COLORS.panelBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COMBAT_COLORS.panelBorder,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 4,
  },
  runCard: {
    borderColor: '#4a5490',
  },
  boardCard: {
    borderColor: '#38406e',
  },
  pressed: {
    opacity: 0.7,
  },
  cardDisabled: {
    opacity: 0.6,
  },
  enemyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    color: COMBAT_COLORS.text,
    fontSize: 19,
    fontWeight: '800',
  },
  enemyHp: {
    color: COMBAT_COLORS.subtle,
    fontSize: 14,
    fontWeight: '700',
  },
  cardHint: {
    color: COMBAT_COLORS.subtle,
    fontSize: 14,
    fontWeight: '600',
  },
});
