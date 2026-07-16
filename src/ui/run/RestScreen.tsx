/**
 * The rest screen: heal once at a campfire, showing HP before and after. The heal amount and cap
 * come from the engine (`restHeal` / `restAtNode`); resting is single-use per node and leaving is
 * always available. This screen only renders and calls the provider.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { restHeal } from '../../engine/run';
import { formatHp } from '../combat/combatFormat';
import { RUN_COLORS } from './runColors';
import { RunHud } from './RunHud';
import { useRun } from './RunContext';

export function RestScreen() {
  const run = useRun();
  const state = run.state;
  if (state === null || state.phase.kind !== 'rest') {
    return <Redirect href="/run" />;
  }

  const rested = state.phase.rest.rested;
  const previewHeal = restHeal(state.playerHp, state.playerMaxHp) - state.playerHp;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <RunHud />
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>🔥 Campfire</Text>
        <Text style={styles.hp}>{formatHp(state.playerHp, state.playerMaxHp)} HP</Text>
        <Text style={styles.subtitle}>
          {rested
            ? 'You have rested and recovered. The fire burns low.'
            : `Rest to recover ${previewHeal} HP (once).`}
        </Text>

        {rested ? null : (
          <Pressable
            onPress={run.restHere}
            disabled={previewHeal <= 0}
            style={({ pressed }) => [styles.rest, previewHeal <= 0 && styles.disabled, pressed && previewHeal > 0 && styles.pressed]}
          >
            <Text style={styles.restText}>{previewHeal > 0 ? `Rest · +${previewHeal} HP` : 'Already at full HP'}</Text>
          </Pressable>
        )}

        <Pressable onPress={run.leaveRestNode} style={({ pressed }) => [styles.leave, pressed && styles.pressed]}>
          <Text style={styles.leaveText}>{rested ? 'Move on' : 'Leave without resting'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: RUN_COLORS.screenBg, paddingTop: 56 },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  body: { paddingHorizontal: 20, paddingTop: 24, alignItems: 'center', gap: 12 },
  title: { color: RUN_COLORS.text, fontSize: 30, fontWeight: '900' },
  hp: { color: RUN_COLORS.hpFill, fontSize: 22, fontWeight: '800' },
  subtitle: { color: RUN_COLORS.subtle, fontSize: 15, fontWeight: '600', textAlign: 'center', maxWidth: 300 },
  rest: {
    marginTop: 12,
    backgroundColor: '#2b6a49',
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  disabled: { opacity: 0.5 },
  restText: { color: RUN_COLORS.buttonText, fontSize: 17, fontWeight: '800' },
  leave: { marginTop: 4, backgroundColor: RUN_COLORS.buttonBg, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40, alignItems: 'center' },
  leaveText: { color: RUN_COLORS.buttonText, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
