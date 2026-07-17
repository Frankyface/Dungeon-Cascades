/**
 * BOSS RUSH (spec §6): fight all five bosses back-to-back, no map, with a heal + one draft between
 * bosses. Locked (with progress) until all five bosses are discovered. The mode REUSES the combat
 * screen for each boss fight and the engine's `bossRush` state machine for the flow; a first VICTORY
 * awards the God of War prestige class (persisted via the meta controller).
 *
 * The visible VIEW ('fight' / 'draft' / 'victory' / 'defeat') is tracked SEPARATELY from the engine's
 * `BossRushState.phase`: the engine advances the attempt on the killing blow (into the draft/victory
 * phase) while the combat screen is still animating that blow, so the view only moves on when the
 * player acknowledges the between-fight beat — keeping the win animation from being unmounted early
 * (the same discipline the run's encounter screen uses). The attempt is not persisted; only the GoW
 * unlock survives. All gating/phrasing comes from the pure `bossRushGate`.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Path } from '../../engine/board';
import type { CombatState } from '../../engine/combat';
import {
  BOSS_RUSH_BOSSES,
  applyBossRushVictory,
  playBossRushTurn,
  resolveBossRushDraft,
  startBossRush,
} from '../../engine/run';
import type { BossRushState, MetaState, UnlockEvent } from '../../engine/run';
import { CombatScreen } from '../combat/CombatScreen';
import { COMBAT_COLORS } from '../combat/combatColors';
import { bossGlyph } from '../compendium/entityPresentation';
import { CeremonyCardView } from '../run/CeremonyCardView';
import { ceremonyCards } from '../run/unlockCeremony';
import { RelicCardView } from '../run/RelicCardView';
import { relicCards } from '../run/relicPresentation';
import { adoptMeta, hydrateMetaStore, metaState } from '../run/metaController';
import { makeRunSeed } from '../run/runController';
import { RUN_COLORS } from '../run/runColors';
import { bossRushGate } from './bossRushModel';

/** Which screen the Boss-Rush flow is showing (decoupled from the engine phase — see file doc). */
type BossRushView = 'gate' | 'fight' | 'draft' | 'victory' | 'defeat';

/** The captured seed for the currently-displayed boss fight (stable through its win animation). */
interface CurrentFight {
  readonly bossIndex: number;
  readonly combat: CombatState;
}

export function BossRushScreen() {
  const router = useRouter();
  const [meta, setMeta] = useState<MetaState>(() => metaState());
  const [rush, setRush] = useState<BossRushState | null>(null);
  const rushRef = useRef<BossRushState | null>(null);
  rushRef.current = rush;
  const [view, setView] = useState<BossRushView>('gate');
  const [fight, setFight] = useState<CurrentFight | null>(null);
  const [combatOutcome, setCombatOutcome] = useState<'won' | 'lost' | null>(null);
  const [gowEvents, setGowEvents] = useState<readonly UnlockEvent[] | null>(null);
  const awardedRef = useRef(false);

  useEffect(() => {
    let active = true;
    hydrateMetaStore()
      .then((m) => {
        if (active) setMeta(m);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  // On the first victory, award God of War exactly once and persist it (idempotent engine applier).
  // Fires as soon as the engine marks the attempt won (on the killing blow); the view flips to the
  // victory ceremony only once the player taps Continue.
  useEffect(() => {
    if (rush?.status !== 'victory' || awardedRef.current) return;
    awardedRef.current = true;
    const result = applyBossRushVictory(metaState());
    adoptMeta(result.meta);
    setGowEvents(result.events);
  }, [rush?.status]);

  /** Enter a fresh boss fight from a rush state parked in the `combat` phase. */
  const enterFight = (next: BossRushState): void => {
    rushRef.current = next;
    setRush(next);
    if (next.phase.kind === 'combat') {
      setFight({ bossIndex: next.bossIndex, combat: next.phase.encounter });
      setCombatOutcome(null);
      setView('fight');
    }
  };

  const begin = (): void => {
    awardedRef.current = false;
    setGowEvents(null);
    enterFight(startBossRush(makeRunSeed(), meta));
  };

  const gate = bossRushGate(meta);

  // ── The gate (locked-with-progress) / intro ──
  if (view === 'gate' || rush === null) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>⚔️ Boss Rush</Text>
        <Text style={styles.subtitle}>All five bosses, back-to-back. No map. Heal and draft between each.</Text>

        <View style={styles.orderCard}>
          {gate.order.map((b, i) => (
            <View key={b.bossId} style={styles.orderRow}>
              <Text style={styles.orderNum}>{i + 1}</Text>
              <Text style={styles.orderGlyph}>{b.glyph}</Text>
              <Text style={[styles.orderName, !b.discovered && styles.orderNameLocked]}>{b.name}</Text>
            </View>
          ))}
        </View>

        {gate.unlocked ? (
          <Pressable onPress={begin} style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}>
            <Text style={styles.buttonText}>Begin the Rush</Text>
          </Pressable>
        ) : (
          <View style={styles.lockCard}>
            <Text style={styles.lockText}>🔒 {gate.label}</Text>
            <Text style={styles.lockHint}>Discover all five bosses in normal runs to open Boss Rush.</Text>
          </View>
        )}

        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>Back</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ── Victory (God of War ceremony) ──
  if (view === 'victory') {
    const cards = gowEvents === null ? [] : ceremonyCards(gowEvents);
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.crown}>👑</Text>
        <Text style={styles.victoryTitle}>Boss Rush Cleared</Text>
        <Text style={styles.subtitle}>All five sovereigns fell to your cascades.</Text>
        {cards.length > 0 ? (
          cards.map((card) => <CeremonyCardView key={card.key} card={card} />)
        ) : (
          <Text style={styles.subtitle}>God of War already earned — the prestige class is yours.</Text>
        )}
        <Pressable onPress={() => router.replace('/')} style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>Return to menu</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ── Defeat ──
  if (view === 'defeat') {
    const fell = fight === null ? rush.bossIndex + 1 : fight.bossIndex + 1;
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Defeated</Text>
        <Text style={styles.subtitle}>
          You fell at boss {Math.min(fell, BOSS_RUSH_BOSSES.length)} of {BOSS_RUSH_BOSSES.length}. No meta lost — try again.
        </Text>
        <Pressable onPress={begin} style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>Back to menu</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ── Between-boss draft ──
  if (view === 'draft') {
    if (rush.phase.kind !== 'draft') return null; // defensive
    const options = rush.phase.options;
    const pick = (relicId: string | null): void => {
      enterFight(resolveBossRushDraft(rush, relicId));
    };
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Boss down!</Text>
        <Text style={styles.subtitle}>
          Healed to {rush.playerHp}/{rush.playerMaxHp}. Draft one relic before the next boss.
        </Text>
        {relicCards(options).map((card) => (
          <RelicCardView key={card.id} card={card} onPress={() => pick(card.id)} />
        ))}
        <Pressable onPress={() => pick(null)} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>Skip the draft</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ── Combat against the current boss (view === 'fight') ──
  if (fight === null) return null; // unreachable in the fight view

  const boss = BOSS_RUSH_BOSSES[fight.bossIndex];
  const resolveTurn = (_c: CombatState, path: Path) => {
    const cur = rushRef.current;
    if (cur === null || cur.phase.kind !== 'combat') {
      throw new Error('resolveTurn called outside a Boss-Rush combat phase');
    }
    const { state: next, resolution } = playBossRushTurn(cur, path);
    rushRef.current = next;
    setRush(next);
    return resolution;
  };

  /** Acknowledge the fight's end and move the VIEW to the beat the engine already advanced to. */
  const continueFromFight = (): void => {
    setCombatOutcome(null);
    const cur = rushRef.current;
    if (cur === null) return;
    if (cur.status === 'victory') setView('victory');
    else if (cur.status === 'defeat') setView('defeat');
    else if (cur.phase.kind === 'draft') setView('draft');
    // Empty between-boss draft pool: the engine skips straight to the next boss's combat (no wedge).
    else if (cur.phase.kind === 'combat') enterFight(cur);
  };

  return (
    <View style={styles.combatScreen}>
      <CombatScreen
        key={`boss-${fight.bossIndex}`}
        enemyId={fight.combat.enemyId}
        onExit={() => router.back()}
        initialCombat={fight.combat}
        resolveTurn={resolveTurn}
        onEncounterEnd={(status) => setCombatOutcome(status)}
        hideOverlay
        enemyNameOverride={boss.name}
        enemyGlyphOverride={bossGlyph(boss.id)}
        hudSlot={
          <View style={styles.rushHud}>
            <Text style={styles.rushHudText}>
              Boss {fight.bossIndex + 1}/{BOSS_RUSH_BOSSES.length} · {boss.name}
            </Text>
            <Text style={styles.rushHudRelics}>💎 {rush.relicIds.length}</Text>
          </View>
        }
      />

      {combatOutcome !== null ? (
        <View style={styles.scrim}>
          <View style={styles.overlayCard}>
            <Text style={[styles.overlayTitle, { color: combatOutcome === 'won' ? COMBAT_COLORS.winText : COMBAT_COLORS.loseText }]}>
              {combatOutcome === 'won' ? 'Boss down!' : 'Defeated'}
            </Text>
            <Pressable onPress={continueFromFight} style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}>
              <Text style={styles.buttonText}>{combatOutcome === 'won' ? 'Continue' : 'See result'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: RUN_COLORS.screenBg },
  combatScreen: { flex: 1, backgroundColor: RUN_COLORS.screenBg },
  content: { paddingTop: 80, paddingHorizontal: 20, paddingBottom: 44, gap: 14, alignItems: 'stretch' },
  title: { color: RUN_COLORS.text, fontSize: 30, fontWeight: '900', textAlign: 'center' },
  victoryTitle: { color: RUN_COLORS.gold, fontSize: 30, fontWeight: '900', textAlign: 'center' },
  crown: { fontSize: 52, textAlign: 'center' },
  subtitle: { color: RUN_COLORS.subtle, fontSize: 15, fontWeight: '600', textAlign: 'center', lineHeight: 21 },
  orderCard: {
    backgroundColor: RUN_COLORS.panelBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: RUN_COLORS.panelBorder,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
  },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orderNum: { color: RUN_COLORS.subtle, fontSize: 14, fontWeight: '900', width: 18 },
  orderGlyph: { fontSize: 22, width: 28 },
  orderName: { color: RUN_COLORS.text, fontSize: 16, fontWeight: '800', flexShrink: 1 },
  orderNameLocked: { color: RUN_COLORS.subtle },
  lockCard: {
    backgroundColor: RUN_COLORS.panelBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: RUN_COLORS.lockedNode,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 6,
    alignItems: 'center',
  },
  lockText: { color: RUN_COLORS.text, fontSize: 17, fontWeight: '900' },
  lockHint: { color: RUN_COLORS.subtle, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  button: { backgroundColor: RUN_COLORS.buttonBg, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  primary: { backgroundColor: RUN_COLORS.accent },
  buttonText: { color: RUN_COLORS.buttonText, fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.7 },
  rushHud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: RUN_COLORS.panelBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: RUN_COLORS.panelBorder,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  rushHudText: { color: RUN_COLORS.text, fontSize: 14, fontWeight: '900', flexShrink: 1 },
  rushHudRelics: { color: RUN_COLORS.text, fontSize: 14, fontWeight: '800' },
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
  overlayCard: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 30,
    paddingHorizontal: 26,
    borderRadius: 20,
    backgroundColor: RUN_COLORS.panelBg,
    borderWidth: 1,
    borderColor: RUN_COLORS.panelBorder,
    width: '100%',
    maxWidth: 360,
  },
  overlayTitle: { fontSize: 32, fontWeight: '900' },
});
