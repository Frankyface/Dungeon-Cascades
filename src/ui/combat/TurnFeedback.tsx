/**
 * The single feedback line between the enemy panel and the board: the combo readout
 * while the cascade resolves, then the damage/heal + weakness callout, then the
 * enemy's action. Purely presentational — the combat screen computes the strings
 * (from the pure `combatFormat` helpers) and drives which beat is shown.
 */
import { View, StyleSheet, Text } from 'react-native';
import { COMBAT_COLORS } from './combatColors';

export type FeedbackTone = 'neutral' | 'combo' | 'damage' | 'heal' | 'enemy';

export interface FeedbackContent {
  readonly main: string;
  /** Optional emphasis chip (the weakness callout), shown before `main`. */
  readonly accent?: string;
  readonly tone: FeedbackTone;
}

const TONE_COLOR: Readonly<Record<FeedbackTone, string>> = {
  neutral: COMBAT_COLORS.subtle,
  combo: COMBAT_COLORS.chargeTint,
  damage: COMBAT_COLORS.damageText,
  heal: COMBAT_COLORS.healText,
  enemy: COMBAT_COLORS.attackTint,
};

export function TurnFeedback({ content }: { readonly content: FeedbackContent }) {
  return (
    <View style={styles.wrap}>
      {content.accent ? (
        <Text style={styles.accent}>{content.accent}</Text>
      ) : null}
      <Text style={[styles.main, { color: TONE_COLOR[content.tone] }]} numberOfLines={1}>
        {content.main}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  accent: {
    color: COMBAT_COLORS.weaknessText,
    fontSize: 15,
    fontWeight: '800',
  },
  main: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});
