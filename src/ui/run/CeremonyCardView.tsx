/**
 * A single UNLOCK CEREMONY card: an icon, a headline, a sub-line, and — for a relic unlock — the
 * full relic card inline. Tone drives the accent (legendary gold, biome cyan, prestige, mode, quiet
 * discovery). Presentational; every string comes from the pure `unlockCeremony` view-model.
 */
import { StyleSheet, Text, View } from 'react-native';
import type { CeremonyCard, CeremonyTone } from './unlockCeremony';
import { RelicCardView } from './RelicCardView';
import { RUN_COLORS } from './runColors';

/** Accent color per ceremony tone. */
const TONE_COLOR: Readonly<Record<CeremonyTone, string>> = {
  legendary: RUN_COLORS.gold,
  biome: RUN_COLORS.edgeActive,
  prestige: '#ffd76b',
  mode: '#ff9ea1',
  discovery: RUN_COLORS.subtle,
};

interface CeremonyCardViewProps {
  readonly card: CeremonyCard;
}

export function CeremonyCardView({ card }: CeremonyCardViewProps) {
  const accent = TONE_COLOR[card.tone];
  return (
    <View style={[styles.card, { borderColor: accent }]}>
      <View style={styles.headerRow}>
        <Text style={styles.icon}>{card.icon}</Text>
        <View style={styles.headText}>
          <Text style={[styles.title, { color: accent }]}>{card.title}</Text>
          <Text style={styles.subtitle}>{card.subtitle}</Text>
        </View>
      </View>
      {card.relic !== null ? <RelicCardView card={card.relic} compact /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: RUN_COLORS.panelBg,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    fontSize: 30,
  },
  headText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: RUN_COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
});
