/**
 * The ALTAR screen (spec §2c) — the dark ceremony. It explains the trade EXACTLY (the run ENDS now,
 * counts as a defeat for score, in exchange for ONE permanent relic unlock at depth-scaled odds) and
 * shows the CURRENT odds row read from the engine's table. Sacrifice goes through a confirm step, then
 * plays the unlock reveal before the run-over flow routes to the outcome; Leave skips the node.
 *
 * All numbers come from the pure `computeAltarView`; the sacrifice itself is the engine's
 * `sacrificeAtAltar` (via the run context), so no unlock logic lives here.
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Redirect } from 'expo-router';
import type { AltarSacrificeResult } from '../../engine/run';
import { computeAltarView } from './altarModel';
import { CeremonyCardView } from './CeremonyCardView';
import { ceremonyCards } from './unlockCeremony';
import { metaState } from './metaController';
import { routeForRunState } from './runRoute';
import { NODE_COLOR, RUN_COLORS } from './runColors';
import { useRun } from './RunContext';

type AltarStep = 'offer' | 'confirm';

export function AltarScreen() {
  const run = useRun();
  const state = run.state;
  const [step, setStep] = useState<AltarStep>('offer');
  const [result, setResult] = useState<AltarSacrificeResult | null>(null);

  if (state === null) {
    return <Redirect href="/" />;
  }
  // Once the sacrifice is done the run is terminal — STAY here to show the reveal (guarded by
  // `result`). Otherwise, if we somehow aren't at the altar, bounce to the run's real screen.
  if (result === null && state.phase.kind !== 'altar') {
    return <Redirect href={routeForRunState(state)} />;
  }

  // ── The unlock reveal (after a completed sacrifice) ──
  if (result !== null) {
    const cards = ceremonyCards(result.events);
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.altarGlyph}>⛧</Text>
        <Text style={styles.revealTitle}>The offering is accepted</Text>
        {result.relicId !== null && cards.length > 0 ? (
          <>
            <Text style={styles.revealSub}>A relic is bound to you forever — it joins your pool for every run to come.</Text>
            {cards.map((card) => (
              <CeremonyCardView key={card.key} card={card} />
            ))}
          </>
        ) : (
          <Text style={styles.revealSub}>The altar is silent — you have already unlocked every relic.</Text>
        )}
        <Pressable
          onPress={run.finishEncounter}
          style={({ pressed }) => [styles.button, styles.sacrificeButton, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>The run ends ›</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const view = computeAltarView(state, metaState());

  // ── The confirm step ──
  if (step === 'confirm') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.altarGlyph}>⛧</Text>
        <Text style={styles.confirmTitle}>End the run here?</Text>
        <Text style={styles.confirmBody}>
          This run ends immediately and is recorded as a defeat. Your banked score still counts. In return, one
          brand-new relic unlocks permanently.
        </Text>
        <Pressable
          onPress={() => {
            // Awaits the crash-safe meta flush before the run save clears (RunContext); reveal after.
            void run.sacrificeAtAltarNode().then((res) => {
              if (res !== null) setResult(res);
            });
          }}
          style={({ pressed }) => [styles.button, styles.sacrificeButton, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>Sacrifice the run</Text>
        </Pressable>
        <Pressable onPress={() => setStep('offer')} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>Go back</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ── The offer step ──
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.altarGlyph}>⛧</Text>
      <Text style={styles.title}>The Altar</Text>
      <Text style={styles.flavor}>Blood for permanence. Give the altar your run and it gives you a relic that outlives it.</Text>

      <View style={styles.tradeCard}>
        <Text style={styles.tradeLabel}>The trade</Text>
        <TradeLine icon="⛔" text="Your run ends immediately — recorded as a defeat." />
        <TradeLine icon="💰" text="The score you have banked so far still counts." />
        <TradeLine icon="🔓" text="One relic you don't yet own unlocks permanently, for every future run." />
        <TradeLine icon="🌊" text="The deeper you are, the rarer the reward." />
      </View>

      <View style={styles.oddsCard}>
        <Text style={styles.oddsLabel}>Unlock odds at this depth (Act {view.act} · floor {view.floor + 1})</Text>
        <View style={styles.oddsRow}>
          <OddsPill label="Common" value={view.oddsPct.common} color={RUN_COLORS.subtle} />
          <OddsPill label="Epic" value={view.oddsPct.epic} color="#d7b8ff" />
          <OddsPill label="Legendary" value={view.oddsPct.legendary} color={RUN_COLORS.gold} />
        </View>
        <Text style={styles.oddsFoot}>{view.lockedCount} relic{view.lockedCount === 1 ? '' : 's'} still locked to draw from.</Text>
      </View>

      <Pressable
        onPress={() => setStep('confirm')}
        disabled={view.nothingLeft}
        style={({ pressed }) => [
          styles.button,
          styles.sacrificeButton,
          view.nothingLeft && styles.disabled,
          pressed && !view.nothingLeft && styles.pressed,
        ]}
      >
        <Text style={styles.buttonText}>{view.nothingLeft ? 'Nothing left to unlock' : 'Sacrifice the run…'}</Text>
      </Pressable>
      <Pressable onPress={run.leaveAltarNode} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.buttonText}>Leave the altar untouched</Text>
      </Pressable>
    </ScrollView>
  );
}

function TradeLine({ icon, text }: { readonly icon: string; readonly text: string }) {
  return (
    <View style={styles.tradeLine}>
      <Text style={styles.tradeIcon}>{icon}</Text>
      <Text style={styles.tradeText}>{text}</Text>
    </View>
  );
}

function OddsPill({ label, value, color }: { readonly label: string; readonly value: string; readonly color: string }) {
  return (
    <View style={styles.oddsPill}>
      <Text style={[styles.oddsValue, { color }]}>{value}</Text>
      <Text style={styles.oddsPillLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: RUN_COLORS.screenBg },
  content: { paddingTop: 80, paddingHorizontal: 20, paddingBottom: 44, gap: 14, alignItems: 'stretch' },
  altarGlyph: { fontSize: 48, textAlign: 'center', color: NODE_COLOR.altar },
  title: { color: RUN_COLORS.text, fontSize: 30, fontWeight: '900', textAlign: 'center' },
  flavor: { color: RUN_COLORS.subtle, fontSize: 15, fontWeight: '600', fontStyle: 'italic', textAlign: 'center', lineHeight: 21 },
  tradeCard: {
    backgroundColor: RUN_COLORS.panelBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: NODE_COLOR.altar,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 4,
  },
  tradeLabel: {
    color: RUN_COLORS.subtle,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tradeLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tradeIcon: { fontSize: 16, width: 22 },
  tradeText: { color: RUN_COLORS.text, fontSize: 14, fontWeight: '600', flexShrink: 1, lineHeight: 20 },
  oddsCard: {
    backgroundColor: RUN_COLORS.panelBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: RUN_COLORS.panelBorder,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  oddsLabel: { color: RUN_COLORS.subtle, fontSize: 13, fontWeight: '800' },
  oddsRow: { flexDirection: 'row', gap: 10 },
  oddsPill: {
    flex: 1,
    backgroundColor: RUN_COLORS.hpTrack,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 3,
  },
  oddsValue: { fontSize: 22, fontWeight: '900' },
  oddsPillLabel: {
    color: RUN_COLORS.subtle,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  oddsFoot: { color: RUN_COLORS.subtle, fontSize: 12, fontWeight: '600' },
  confirmTitle: { color: RUN_COLORS.loseText, fontSize: 26, fontWeight: '900', textAlign: 'center', marginTop: 8 },
  confirmBody: { color: RUN_COLORS.text, fontSize: 15, fontWeight: '600', textAlign: 'center', lineHeight: 22 },
  revealTitle: { color: RUN_COLORS.gold, fontSize: 26, fontWeight: '900', textAlign: 'center' },
  revealSub: { color: RUN_COLORS.subtle, fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 20, marginBottom: 4 },
  button: { backgroundColor: RUN_COLORS.buttonBg, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  sacrificeButton: { backgroundColor: NODE_COLOR.altar },
  disabled: { opacity: 0.45 },
  buttonText: { color: RUN_COLORS.buttonText, fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.7 },
});
