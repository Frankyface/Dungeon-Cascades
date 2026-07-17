/**
 * A reusable relic card: name, tier badge, derived effect line, and flavor. Used by the draft
 * (tappable to pick), the shop (with a price), and the owned-relic list (static). Presentational
 * — the effect text is computed by the pure `relicPresentation` view-model.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RelicCard } from './relicPresentation';
import type { RelicTier } from '../../engine/run';
import { RUN_COLORS } from './runColors';

/** Migration-mechanical: display label per rarity tier (normal→common, elite→epic, + legendary). */
const TIER_LABEL: Readonly<Record<RelicTier, string>> = { common: 'Common', epic: 'Epic', legendary: 'Legendary' };

interface RelicCardViewProps {
  readonly card: RelicCard;
  /** Optional press handler (draft/shop). Omit for a static list entry. */
  readonly onPress?: () => void;
  /** Optional trailing badge (e.g. a shop price). */
  readonly trailing?: string;
  /** Dim + disable the card (e.g. can't afford / sold). */
  readonly disabled?: boolean;
  /** Compact single-line-ish variant for the owned-relic list. */
  readonly compact?: boolean;
}

export function RelicCardView({ card, onPress, trailing, disabled, compact }: RelicCardViewProps) {
  const body = (
    <View style={[styles.card, compact && styles.compactCard, disabled && styles.disabled]}>
      <View style={styles.headerRow}>
        <Text style={styles.name}>{card.name}</Text>
        <View style={styles.headerRight}>
          <View style={[styles.tierBadge, card.tier !== 'common' && styles.tierElite]}>
            <Text style={styles.tierText}>{TIER_LABEL[card.tier]}</Text>
          </View>
          {trailing !== undefined ? <Text style={styles.trailing}>{trailing}</Text> : null}
        </View>
      </View>
      <Text style={styles.effect}>{card.effect}</Text>
      {compact ? null : <Text style={styles.flavor}>{card.flavor}</Text>}
    </View>
  );

  if (onPress === undefined) {
    return body;
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [pressed && !disabled && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: RUN_COLORS.panelBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: RUN_COLORS.panelBorder,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 6,
  },
  compactCard: {
    paddingVertical: 10,
    gap: 3,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.7,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    color: RUN_COLORS.text,
    fontSize: 17,
    fontWeight: '800',
    flexShrink: 1,
  },
  tierBadge: {
    backgroundColor: RUN_COLORS.hpTrack,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tierElite: {
    backgroundColor: '#3a2a4d',
  },
  tierText: {
    color: RUN_COLORS.subtle,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trailing: {
    color: RUN_COLORS.gold,
    fontSize: 15,
    fontWeight: '800',
  },
  effect: {
    color: RUN_COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  flavor: {
    color: RUN_COLORS.subtle,
    fontSize: 13,
    fontStyle: 'italic',
  },
});
