/**
 * The persistent run HUD: HP, gold, and the owned-relic count (tap → the owned-relic list).
 * Rendered on every run screen so the player's state is always visible. Reads the live run from
 * the provider; the relic list uses the shared `RelicCardView`. Presentational.
 */
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { nodeById } from '../../engine/run';
import { formatHp, hpFraction } from '../combat/combatFormat';
import { RelicCardView } from './RelicCardView';
import { relicCards } from './relicPresentation';
import { RUN_COLORS } from './runColors';
import { useRun } from './RunContext';

interface RunHudProps {
  /** Compact variant (no HP bar) for the fight screen, where combat already shows HP. */
  readonly compact?: boolean;
}

export function RunHud({ compact }: RunHudProps) {
  const run = useRun();
  const state = run.state;
  const [showRelics, setShowRelics] = useState(false);
  if (state === null) {
    return null;
  }

  const floor = nodeById(state.map, state.mapState.currentNodeId).floor;
  const relicCount = state.relicIds.length;

  return (
    <View style={styles.bar}>
      {compact ? null : (
        <View style={styles.hpBlock}>
          <View style={styles.hpTrack}>
            <View style={[styles.hpFill, { width: `${Math.round(hpFraction(state.playerHp, state.playerMaxHp) * 100)}%` }]} />
          </View>
          <Text style={styles.hpLabel}>{formatHp(state.playerHp, state.playerMaxHp)} HP</Text>
        </View>
      )}

      <View style={styles.stats}>
        {compact ? (
          <Text style={styles.stat}>❤ {formatHp(state.playerHp, state.playerMaxHp)}</Text>
        ) : null}
        <Text style={styles.floorStat}>Floor {floor + 1}/{state.map.floorCount}</Text>
        <Text style={styles.goldStat}>🪙 {state.gold}</Text>
        <Pressable onPress={() => setShowRelics(true)} hitSlop={8} style={({ pressed }) => [styles.relicChip, pressed && styles.pressed]}>
          <Text style={styles.relicStat}>💎 {relicCount}</Text>
        </Pressable>
      </View>

      <Modal visible={showRelics} transparent animationType="fade" onRequestClose={() => setShowRelics(false)}>
        <Pressable style={styles.scrim} onPress={() => setShowRelics(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>Relics ({relicCount})</Text>
            {relicCount === 0 ? (
              <Text style={styles.empty}>No relics yet — win a fight to draft one.</Text>
            ) : (
              <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
                {relicCards(state.relicIds).map((card) => (
                  <RelicCardView key={card.id} card={card} compact />
                ))}
              </ScrollView>
            )}
            <Pressable onPress={() => setShowRelics(false)} style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: RUN_COLORS.panelBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: RUN_COLORS.panelBorder,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
  },
  hpBlock: {
    gap: 4,
  },
  hpTrack: {
    height: 10,
    borderRadius: 6,
    backgroundColor: RUN_COLORS.hpTrack,
    overflow: 'hidden',
  },
  hpFill: {
    height: '100%',
    backgroundColor: RUN_COLORS.hpFill,
    borderRadius: 6,
  },
  hpLabel: {
    color: RUN_COLORS.subtle,
    fontSize: 12,
    fontWeight: '700',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  stat: {
    color: RUN_COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  floorStat: {
    color: RUN_COLORS.subtle,
    fontSize: 13,
    fontWeight: '700',
  },
  goldStat: {
    color: RUN_COLORS.gold,
    fontSize: 15,
    fontWeight: '800',
  },
  relicChip: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: RUN_COLORS.hpTrack,
  },
  relicStat: {
    color: RUN_COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.7,
  },
  scrim: {
    flex: 1,
    backgroundColor: '#0b0c18e6',
    justifyContent: 'center',
    padding: 22,
  },
  sheet: {
    backgroundColor: RUN_COLORS.screenBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: RUN_COLORS.panelBorder,
    padding: 18,
    gap: 12,
    maxHeight: '80%',
  },
  sheetTitle: {
    color: RUN_COLORS.text,
    fontSize: 20,
    fontWeight: '900',
  },
  empty: {
    color: RUN_COLORS.subtle,
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    gap: 10,
    paddingBottom: 4,
  },
  closeBtn: {
    backgroundColor: RUN_COLORS.buttonBg,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeText: {
    color: RUN_COLORS.buttonText,
    fontSize: 15,
    fontWeight: '800',
  },
});
