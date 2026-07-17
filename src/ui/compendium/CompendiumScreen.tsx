/**
 * The Compendium: a DISCOVERY-DRIVEN encyclopedia of relics, enemies, and bosses (Stage-6 §4).
 * Undiscovered entries render as locked silhouettes ("Undiscovered"); discovered ones show the full
 * card (every number read straight from the engine, via the pure `compendium*` view-models). Enemies
 * and bosses are grouped by biome, and each tab shows an "N/M discovered" count. The screen reads the
 * live meta profile (it sits above the run provider, like the start-select screen).
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MetaState } from '../../engine/run';
import { RelicCardView } from '../run/RelicCardView';
import { hydrateMetaStore, metaState } from '../run/metaController';
import { RUN_COLORS } from '../run/runColors';
import { CompendiumEnemyCard } from './CompendiumEnemyCard';
import { CompendiumBossCard } from './CompendiumBossCard';
import { LockedEntryCard } from './LockedEntryCard';
import {
  compendiumBossSection,
  compendiumEnemySection,
  compendiumRelicSection,
  type SectionCount,
} from './compendiumDiscovery';

type CompendiumSection = 'relics' | 'enemies' | 'bosses';

const SECTIONS: ReadonlyArray<{ readonly key: CompendiumSection; readonly label: string }> = [
  { key: 'relics', label: 'Relics' },
  { key: 'enemies', label: 'Enemies' },
  { key: 'bosses', label: 'Bosses' },
];

export function CompendiumScreen() {
  const router = useRouter();
  const [section, setSection] = useState<CompendiumSection>('relics');
  // Read the live profile now (menu already hydrated it); re-adopt on mount for correctness.
  const [meta, setMeta] = useState<MetaState>(() => metaState());
  useEffect(() => {
    let active = true;
    hydrateMetaStore()
      .then((m) => {
        if (active) setMeta(m);
      })
      .catch(() => {
        /* hydrate treats failure as a fresh profile — everything shows locked */
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>📖 Compendium</Text>
        <Text style={styles.subtitle}>Discover the dungeon. Every number is read straight from the engine.</Text>
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
        {section === 'relics' ? <RelicsSection meta={meta} /> : null}
        {section === 'enemies' ? <EnemiesSection meta={meta} /> : null}
        {section === 'bosses' ? <BossesSection meta={meta} /> : null}

        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/** A section header line with the "N/M discovered" count. */
function CountLabel({ noun, count }: { readonly noun: string; readonly count: SectionCount }) {
  return (
    <Text style={styles.countLabel}>
      {noun} {count.label} discovered
    </Text>
  );
}

function RelicsSection({ meta }: { readonly meta: MetaState }) {
  const { slots, count } = compendiumRelicSection(meta);
  return (
    <>
      <CountLabel noun="Relics" count={count} />
      <Text style={styles.blurb}>Common, epic and legendary. Unlock them by drafting, reaching biomes, killing bosses, or the altar.</Text>
      {slots.map((slot) =>
        slot.card !== null ? (
          <RelicCardView key={slot.id} card={slot.card} />
        ) : (
          <LockedEntryCard key={slot.id} label="Undiscovered" hint="Unlock it to reveal" />
        ),
      )}
    </>
  );
}

function EnemiesSection({ meta }: { readonly meta: MetaState }) {
  const { groups, count } = compendiumEnemySection(meta);
  return (
    <>
      <CountLabel noun="Enemies" count={count} />
      {groups.map((group) => (
        <View key={group.biomeId} style={styles.group}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupName}>{group.biomeName}</Text>
            <Text style={styles.groupCount}>{group.count.label}</Text>
          </View>
          {group.slots.map((slot) =>
            slot.detail !== null ? (
              <CompendiumEnemyCard key={slot.id} entry={slot.detail} />
            ) : (
              <LockedEntryCard key={slot.id} label="Undiscovered" hint="Fight it to reveal" />
            ),
          )}
        </View>
      ))}
    </>
  );
}

function BossesSection({ meta }: { readonly meta: MetaState }) {
  const { slots, count } = compendiumBossSection(meta);
  return (
    <>
      <CountLabel noun="Bosses" count={count} />
      {slots.map((slot) => (
        <View key={slot.bossId} style={styles.group}>
          <Text style={styles.bossBiome}>{slot.biomeName}</Text>
          {slot.detail !== null ? (
            <CompendiumBossCard entry={slot.detail} />
          ) : (
            <LockedEntryCard label="Undiscovered" hint="Reach and defeat it to reveal" />
          )}
        </View>
      ))}
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
  countLabel: {
    color: RUN_COLORS.edgeActive,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  blurb: {
    color: RUN_COLORS.subtle,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  group: {
    gap: 10,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  groupName: {
    color: RUN_COLORS.text,
    fontSize: 16,
    fontWeight: '900',
  },
  groupCount: {
    color: RUN_COLORS.subtle,
    fontSize: 13,
    fontWeight: '800',
  },
  bossBiome: {
    color: RUN_COLORS.subtle,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 6,
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
