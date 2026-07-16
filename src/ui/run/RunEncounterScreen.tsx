/**
 * The run encounter screen: hosts the REUSED combat screen, driven by the run's live encounter
 * instead of a standalone one. It seeds the fight from the run's scaled/boss `CombatState`, routes
 * every turn through the relic-aware `resolveEncounterTurn` (so drafted damage relics visibly move
 * the numbers), and — because it hides the standalone Retry/Menu overlay — renders its own
 * victory/defeat beat (with the gold reward) whose button hands control back to the run flow.
 */
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import type { Path } from '../../engine/board';
import type { CombatState } from '../../engine/combat';
import { BOSS_NAME } from '../../engine/run';
import { CombatScreen } from '../combat/CombatScreen';
import { COMBAT_COLORS } from '../combat/combatColors';
import { RUN_COLORS } from './runColors';
import { RunHud } from './RunHud';
import { useRun } from './RunContext';

export function RunEncounterScreen() {
  const run = useRun();
  const state = run.state;
  // Capture the encounter + starting gold ONCE — the run state advances during the fight.
  const [initialCombat] = useState<CombatState | null>(() =>
    state !== null && state.phase.kind === 'combat' ? state.phase.encounter : null,
  );
  const [isBoss] = useState(() => state !== null && state.phase.kind === 'combat' && state.phase.encounterKind === 'boss');
  const goldBeforeRef = useRef(state?.gold ?? 0);
  const [outcome, setOutcome] = useState<{ readonly status: 'won' | 'lost'; readonly goldDelta: number } | null>(null);

  if (state === null || initialCombat === null) {
    return <Redirect href="/run" />;
  }

  const resolveTurn = (_combat: CombatState, path: Path) => run.resolveEncounterTurn(path);
  const handleEnd = (status: 'won' | 'lost'): void => {
    const goldAfter = run.getState()?.gold ?? goldBeforeRef.current;
    setOutcome({ status, goldDelta: Math.max(0, goldAfter - goldBeforeRef.current) });
  };

  return (
    <View style={styles.screen}>
      <CombatScreen
        enemyId={initialCombat.enemyId}
        onExit={run.goToMenu}
        initialCombat={initialCombat}
        resolveTurn={resolveTurn}
        onEncounterEnd={handleEnd}
        hideOverlay
        hudSlot={<RunHud compact />}
        enemyNameOverride={isBoss ? BOSS_NAME : undefined}
        enemyGlyphOverride={isBoss ? '👑' : undefined}
      />

      {outcome !== null ? (
        <View style={styles.scrim}>
          <View style={styles.card}>
            <Text style={[styles.title, { color: outcome.status === 'won' ? COMBAT_COLORS.winText : COMBAT_COLORS.loseText }]}>
              {outcome.status === 'won' ? 'Victory' : 'Defeated'}
            </Text>
            <Text style={styles.subtitle}>
              {outcome.status === 'won' ? `Reward: +${outcome.goldDelta} gold` : 'Your run ends here.'}
            </Text>
            <Pressable onPress={run.finishEncounter} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
              <Text style={styles.buttonText}>{outcome.status === 'won' ? 'Continue' : 'See summary'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: RUN_COLORS.screenBg },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0b0c18e6',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    alignItems: 'center',
    gap: 14,
    paddingVertical: 30,
    paddingHorizontal: 26,
    borderRadius: 20,
    backgroundColor: RUN_COLORS.panelBg,
    borderWidth: 1,
    borderColor: RUN_COLORS.panelBorder,
    width: '100%',
    maxWidth: 360,
  },
  title: { fontSize: 34, fontWeight: '900', letterSpacing: 0.5 },
  subtitle: { color: RUN_COLORS.gold, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  button: { marginTop: 4, backgroundColor: RUN_COLORS.accent, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 44, alignItems: 'center' },
  buttonText: { color: RUN_COLORS.buttonText, fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.7 },
});
