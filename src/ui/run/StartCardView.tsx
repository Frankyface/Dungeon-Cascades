/**
 * A start-selection card: the vanilla start, an unlocked variant (tappable to begin), or a LOCKED
 * variant (dimmed, untappable, showing unlock progress). Presentational — every string and the
 * locked/progress math come from the pure `variantPresentation` view-model.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ModifierKind, ModifierTone, StartCard, VariantModifierLine } from './variantPresentation';
import { RUN_COLORS } from './runColors';

interface StartCardViewProps {
  readonly card: StartCard;
  /** Press handler for a selectable card. Omitted for a locked card (it renders untappable). */
  readonly onPress?: () => void;
}

/** Glyph per modifier lever (mirrors the HUD's gold/relic/HP glyphs). */
const MODIFIER_GLYPH: Readonly<Record<ModifierKind, string>> = {
  relic: '💎',
  gold: '🪙',
  maxHp: '❤',
  map: '🗺',
};

/** Color per modifier tone: boons read positive, banes read as a cost. */
const TONE_COLOR: Readonly<Record<ModifierTone, string>> = {
  boon: RUN_COLORS.winText,
  bane: RUN_COLORS.loseText,
  neutral: RUN_COLORS.subtle,
};

export function StartCardView({ card, onPress }: StartCardViewProps) {
  const { locked, progress } = card;
  const fraction = progress === null ? 0 : Math.min(1, progress.required === 0 ? 1 : progress.current / progress.required);

  const body = (
    <View style={[styles.card, locked && styles.lockedCard]}>
      <View style={styles.headerRow}>
        <Text style={[styles.name, locked && styles.lockedText]}>{card.name}</Text>
        {locked ? (
          <View style={styles.lockBadge}>
            <Text style={styles.lockBadgeText}>🔒 Locked</Text>
          </View>
        ) : card.isDefault ? (
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultBadgeText}>Default</Text>
          </View>
        ) : (
          <Text style={styles.startHint}>Tap to start</Text>
        )}
      </View>

      <Text style={[styles.flavor, locked && styles.lockedText]}>{card.flavor}</Text>

      {card.modifiers.length > 0 ? (
        <View style={styles.modifiers}>
          {card.modifiers.map((line, i) => (
            <ModifierRow key={`${line.kind}-${i}`} line={line} dim={locked} />
          ))}
        </View>
      ) : (
        <Text style={styles.noModifiers}>No modifiers — a clean climb.</Text>
      )}

      {locked && progress !== null ? (
        <View style={styles.progressBlock}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(fraction * 100)}%` }]} />
          </View>
          <Text style={styles.progressLabel}>
            {progress.label} · {progress.remaining} to unlock
          </Text>
        </View>
      ) : null}
    </View>
  );

  if (locked || onPress === undefined) {
    return body;
  }
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      {body}
    </Pressable>
  );
}

function ModifierRow({ line, dim }: { readonly line: VariantModifierLine; readonly dim: boolean }) {
  return (
    <View style={styles.modifierRow}>
      <Text style={styles.modifierGlyph}>{MODIFIER_GLYPH[line.kind]}</Text>
      <Text style={[styles.modifierLabel, { color: dim ? RUN_COLORS.subtle : TONE_COLOR[line.tone] }]}>
        {line.label}
        {line.detail !== null ? <Text style={styles.modifierDetail}> · {line.detail}</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: RUN_COLORS.panelBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: RUN_COLORS.panelBorder,
    paddingVertical: 15,
    paddingHorizontal: 16,
    gap: 8,
  },
  lockedCard: {
    opacity: 0.6,
    borderColor: RUN_COLORS.lockedNode,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    color: RUN_COLORS.text,
    fontSize: 18,
    fontWeight: '900',
    flexShrink: 1,
  },
  lockedText: {
    color: RUN_COLORS.subtle,
  },
  startHint: {
    color: RUN_COLORS.edgeActive,
    fontSize: 12,
    fontWeight: '800',
  },
  defaultBadge: {
    backgroundColor: RUN_COLORS.accent,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  defaultBadgeText: {
    color: RUN_COLORS.text,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lockBadge: {
    backgroundColor: RUN_COLORS.lockedNode,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  lockBadgeText: {
    color: RUN_COLORS.subtle,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  flavor: {
    color: RUN_COLORS.subtle,
    fontSize: 13,
    fontStyle: 'italic',
  },
  modifiers: {
    gap: 5,
  },
  modifierRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  modifierGlyph: {
    fontSize: 14,
    width: 18,
  },
  modifierLabel: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  modifierDetail: {
    color: RUN_COLORS.subtle,
    fontWeight: '600',
  },
  noModifiers: {
    color: RUN_COLORS.subtle,
    fontSize: 13,
    fontWeight: '600',
  },
  progressBlock: {
    gap: 5,
    marginTop: 2,
  },
  progressTrack: {
    height: 8,
    borderRadius: 5,
    backgroundColor: RUN_COLORS.hpTrack,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: RUN_COLORS.edgeActive,
    borderRadius: 5,
  },
  progressLabel: {
    color: RUN_COLORS.subtle,
    fontSize: 12,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
});
