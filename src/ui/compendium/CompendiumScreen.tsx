/**
 * The Compendium: an in-game encyclopedia of relics, enemies, and the boss. A simple three-tab
 * segmented control switches sections inside one scroll view — the least machinery that still reads
 * cleanly. Every card is a thin renderer over the pure `compendiumModel` view-models, so the numbers
 * shown are exactly the engine's (relic modifiers, ENEMY_STATS, the elite/boss scaling formulas).
 */
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RelicCardView } from '../run/RelicCardView';
import { RUN_COLORS } from '../run/runColors';
import { CompendiumEnemyCard } from './CompendiumEnemyCard';
import { CompendiumBossCard } from './CompendiumBossCard';
import { compendiumBoss, compendiumEnemies, compendiumRelics } from './compendiumModel';

type CompendiumSection = 'relics' | 'enemies' | 'boss';

const SECTIONS: ReadonlyArray<{ readonly key: CompendiumSection; readonly label: string }> = [
  { key: 'relics', label: 'Relics' },
  { key: 'enemies', label: 'Enemies' },
  { key: 'boss', label: 'Boss' },
];

export function CompendiumScreen() {
  const router = useRouter();
  const [section, setSection] = useState<CompendiumSection>('relics');

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>📖 Compendium</Text>
        <Text style={styles.subtitle}>Every number here is read straight from the engine.</Text>
      </View>

      <View style={styles.tabs}>
        {SECTIONS.map((tab) => {
          const active = tab.key === section;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setSection(tab.key)}
              style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && styles.pressed]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {section === 'relics' ? <RelicsSection /> : null}
        {section === 'enemies' ? <EnemiesSection /> : null}
        {section === 'boss' ? <BossSection /> : null}

        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function RelicsSection() {
  return (
    <>
      <Text style={styles.blurb}>Twelve relics. Common and elite tiers — draft, buy, or find them.</Text>
      {compendiumRelics().map((card) => (
        <RelicCardView key={card.id} card={card} />
      ))}
    </>
  );
}

function EnemiesSection() {
  return (
    <>
      <Text style={styles.blurb}>Base stats and the elite-scaled example you meet deeper in a run.</Text>
      {compendiumEnemies().map((entry) => (
        <CompendiumEnemyCard key={entry.id} entry={entry} />
      ))}
    </>
  );
}

function BossSection() {
  return (
    <>
      <Text style={styles.blurb}>The terminal fight — one HP pool, three phases, a shifting weakness.</Text>
      <CompendiumBossCard entry={compendiumBoss()} />
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: RUN_COLORS.screenBg,
  },
  header: {
    paddingTop: 72,
    paddingHorizontal: 20,
    gap: 4,
    alignItems: 'center',
  },
  title: {
    color: RUN_COLORS.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: RUN_COLORS.subtle,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  tab: {
    flex: 1,
    backgroundColor: RUN_COLORS.panelBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: RUN_COLORS.panelBorder,
    paddingVertical: 11,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: RUN_COLORS.accent,
    borderColor: RUN_COLORS.edgeActive,
  },
  tabText: {
    color: RUN_COLORS.subtle,
    fontSize: 15,
    fontWeight: '800',
  },
  tabTextActive: {
    color: RUN_COLORS.text,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 12,
  },
  blurb: {
    color: RUN_COLORS.subtle,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  backButton: {
    backgroundColor: RUN_COLORS.buttonBg,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
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
