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
import type { EnemyAction, EnemyId } from '../../engine/combat';
import { COMBAT_COLORS } from './combatColors';
import { HpBar } from './HpBar';
import {
  ENEMY_GLYPH,
  buildAffinityChips,
  enemyName,
  formatIntent,
  hpFraction,
  formatHp,
  type AffinityChip,
} from './combatFormat';

interface EnemyPanelProps {
  readonly enemyId: EnemyId;
  readonly hp: number;
  readonly maxHp: number;
  readonly telegraph: EnemyAction;
  readonly width: number;
}

const INTENT_TINT: Readonly<Record<EnemyAction['type'], string>> = {
  attack: COMBAT_COLORS.attackTint,
  charge: COMBAT_COLORS.chargeTint,
  heal: COMBAT_COLORS.healTint,
};

function ChipRow({ heading, chips, bg, color }: {
  readonly heading: string;
  readonly chips: readonly AffinityChip[];
  readonly bg: string;
  readonly color: string;
}) {
  if (chips.length === 0) {
    return null;
  }
  return (
    <View style={styles.chipRow}>
      <Text style={styles.chipHeading}>{heading}</Text>
      {chips.map((chip) => (
        <View key={`${heading}-${chip.color}`} style={[styles.chip, { backgroundColor: bg }]}>
          <Text style={[styles.chipText, { color }]}>{chip.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function EnemyPanel({ enemyId, hp, maxHp, telegraph, width }: EnemyPanelProps) {
  const enemy = getEnemy(enemyId);
  const affinity = buildAffinityChips(enemy.affinity);
  const intent = formatIntent(telegraph);

  return (
    <View style={[styles.panel, { width }]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>
          {ENEMY_GLYPH[enemyId]} {enemyName(enemyId)}
        </Text>
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

      <View style={styles.chips}>
        <ChipRow heading="Weak" chips={affinity.weak} bg={COMBAT_COLORS.weakBg} color={COMBAT_COLORS.weakText} />
        <ChipRow heading="Resists" chips={affinity.resist} bg={COMBAT_COLORS.resistBg} color={COMBAT_COLORS.resistText} />
        <ChipRow heading="Immune" chips={affinity.immune} bg={COMBAT_COLORS.resistBg} color={COMBAT_COLORS.resistText} />
      </View>
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
  chips: {
    gap: 6,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  chipHeading: {
    color: COMBAT_COLORS.subtle,
    fontSize: 12,
    fontWeight: '700',
    width: 58,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
