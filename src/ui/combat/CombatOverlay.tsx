/**
 * The terminal win/lose overlay: a full-bleed scrim with the outcome, the turn
 * count on a win, and the two exits — "Retry (new seed)" and "Back to menu". While
 * mounted it visually covers the board; the combat screen also locks input in the
 * won/lost phases so the board underneath is inert. Presentational.
 */
import { View, StyleSheet, Text, Pressable } from 'react-native';
import { COMBAT_COLORS } from './combatColors';

interface CombatOverlayProps {
  readonly status: 'won' | 'lost';
  readonly enemyName: string;
  readonly turns: number;
  readonly onRetry: () => void;
  readonly onMenu: () => void;
}

export function CombatOverlay({ status, enemyName, turns, onRetry, onMenu }: CombatOverlayProps) {
  const won = status === 'won';
  const title = won ? 'Victory' : 'Defeated';
  const subtitle = won
    ? `${enemyName} defeated — ${turns} turn${turns === 1 ? '' : 's'}`
    : `${enemyName} got you. Try again.`;

  return (
    <View style={styles.scrim}>
      <View style={styles.card}>
        <Text style={[styles.title, { color: won ? COMBAT_COLORS.winText : COMBAT_COLORS.loseText }]}>
          {title}
        </Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        <View style={styles.buttons}>
          <Pressable
            onPress={onRetry}
            style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.buttonText}>Retry (new seed)</Text>
          </Pressable>
          <Pressable
            onPress={onMenu}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Text style={styles.buttonText}>Back to menu</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COMBAT_COLORS.overlayScrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: COMBAT_COLORS.panelBg,
    borderWidth: 1,
    borderColor: COMBAT_COLORS.panelBorder,
    width: '100%',
    maxWidth: 380,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: COMBAT_COLORS.subtle,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttons: {
    marginTop: 8,
    gap: 10,
    width: '100%',
  },
  button: {
    backgroundColor: COMBAT_COLORS.buttonBg,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
  },
  primary: {
    backgroundColor: '#38406e',
  },
  pressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: COMBAT_COLORS.buttonText,
    fontSize: 16,
    fontWeight: '700',
  },
});
