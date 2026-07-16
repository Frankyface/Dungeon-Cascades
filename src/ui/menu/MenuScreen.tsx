/**
 * The root menu: the Stage-1 fun-gate "Naked Board" (kept reachable) plus a fight
 * entry per enemy. The enemy list is driven by the engine registry (`ENEMY_IDS` +
 * `getEnemy`) so it stays in sync, and each row previews the enemy's weakness so the
 * "engineer the right color" goal is visible before the fight starts.
 */
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ENEMY_IDS, getEnemy } from '../../engine/combat';
import type { EnemyId } from '../../engine/combat';
import { COMBAT_COLORS } from '../combat/combatColors';
import { ENEMY_GLYPH, buildAffinityChips, enemyName } from '../combat/combatFormat';

function weaknessHint(enemyId: EnemyId): string {
  const chips = buildAffinityChips(getEnemy(enemyId).affinity);
  if (chips.weak.length === 0) {
    return 'No weakness';
  }
  return `Weak: ${chips.weak.map((c) => c.label).join(' ')}`;
}

export function MenuScreen() {
  const router = useRouter();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Dungeon Cascades</Text>
        <Text style={styles.subtitle}>Stage 2 · Combat</Text>
      </View>

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
  boardCard: {
    borderColor: '#38406e',
  },
  pressed: {
    opacity: 0.7,
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
