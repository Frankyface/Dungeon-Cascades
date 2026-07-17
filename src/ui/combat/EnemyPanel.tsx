/**
 * The enemy panel: name + glyph, an animated HP bar, the ALWAYS-VISIBLE telegraphed
 * intent (so the player reads the coming hit before committing), and the affinity
 * chips (weak/resist per color) so engineering the right color is a learnable goal.
 *
 * Affinity + telegraph come from the engine's public API (`getEnemy`, the live
 * `telegraph`), so tuned config values flow through automatically. Presentational.
 */
import { View, StyleSheet, Text } from 'react-native';
import { getEnemy } from '../../engine/combat';
import type { AffinityTable, EnemyAction, EnemyId } from '../../engine/combat';
import { COMBAT_COLORS } from './combatColors';
import { AffinityChipsView } from './AffinityChipsView';
import { HpBar } from './HpBar';
import {
  ENEMY_GLYPH,
  buildAffinityChips,
  enemyName,
  formatIntent,
  hpFraction,
  formatHp,
} from './combatFormat';

interface EnemyPanelProps {
  readonly enemyId: EnemyId;
  readonly hp: number;
  readonly maxHp: number;
  readonly telegraph: EnemyAction;
  readonly width: number;
  /** Display-name override (run layer: e.g. the boss's real name). Defaults to the enemy id. */
  readonly nameOverride?: string;
  /** Glyph override (run layer). Defaults to the enemy id's glyph. */
  readonly glyphOverride?: string;
  /** Live affinity override (scaled fight / per-phase boss). Defaults to the registry enemy's. */
  readonly affinityOverride?: AffinityTable;
}

const INTENT_TINT: Readonly<Record<EnemyAction['type'], string>> = {
  attack: COMBAT_COLORS.attackTint,
  charge: COMBAT_COLORS.chargeTint,
  heal: COMBAT_COLORS.healTint,
  // Stage-6 biome verbs: defensive plating reads as "preparing", debuffs as "harmful".
  frostArmor: COMBAT_COLORS.chargeTint,
  armor: COMBAT_COLORS.chargeTint,
  spore: COMBAT_COLORS.attackTint,
  curse: COMBAT_COLORS.attackTint,
};

export function EnemyPanel({
  enemyId,
  hp,
  maxHp,
  telegraph,
  width,
  nameOverride,
  glyphOverride,
  affinityOverride,
}: EnemyPanelProps) {
  const affinity = buildAffinityChips(affinityOverride ?? getEnemy(enemyId).affinity);
  const intent = formatIntent(telegraph);
  const title = `${glyphOverride ?? ENEMY_GLYPH[enemyId]} ${nameOverride ?? enemyName(enemyId)}`;

  return (
    <View style={[styles.panel, { width }]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.intentBadge}>
          <Text style={styles.intentLabel}>Next</Text>
          <Text style={[styles.intentValue, { color: INTENT_TINT[telegraph.type] }]}>
            {intent.badge}
          </Text>
        </View>
      </View>

      <HpBar
        name="HP"
        hpLabel={formatHp(hp, maxHp)}
        fraction={hpFraction(hp, maxHp)}
        width={width - 2 * PANEL_PAD}
        fillColor={COMBAT_COLORS.enemyFill}
      />

      <AffinityChipsView chips={affinity} />
    </View>
  );
}

const PANEL_PAD = 14;

const styles = StyleSheet.create({
  panel: {
    backgroundColor: COMBAT_COLORS.panelBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COMBAT_COLORS.panelBorder,
    padding: PANEL_PAD,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: COMBAT_COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  intentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COMBAT_COLORS.hpTrack,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  intentLabel: {
    color: COMBAT_COLORS.subtle,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  intentValue: {
    fontSize: 16,
    fontWeight: '800',
  },
});
