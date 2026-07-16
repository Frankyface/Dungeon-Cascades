/**
 * Pure presentation helpers for the combat screen: turning engine data
 * (telegraphed intents, affinity tables, turn resolutions, HP numbers) into the
 * strings/chips the panels render. NO React imports and NO combat rules — every
 * function is a deterministic formatter over data the engine already produced, so
 * it is fully Jest-testable and the UI never re-implements combat logic.
 *
 * The enemy's tuned affinity/damage numbers reach these formatters via the engine's
 * public API (`getEnemy`, the `TurnResolution`/`EnemyAction` shapes), so when the
 * balance sim tunes `config.ts` the chips and callouts update automatically.
 */
import { AFFINITY_NORMAL, ENEMY_IDS } from '../../engine/combat';
import type {
  AffinityTable,
  EnemyAction,
  EnemyId,
  GroupEffect,
  TurnResolution,
} from '../../engine/combat';
import type { TileColor } from '../../engine/board';

/** Stable render order for colors so chips never reshuffle between frames. */
const COLOR_ORDER: readonly TileColor[] = ['R', 'G', 'B', 'Y', 'P'];

/** One glyph per engine color code (mirrors the board palette's hues). */
export const COLOR_GLYPH: Readonly<Record<TileColor, string>> = {
  R: '🔴',
  G: '🟢',
  B: '🔵',
  Y: '🟡',
  P: '🟣',
};

/** A friendly display glyph + name per enemy (placeholder-grade, like the tiles). */
export const ENEMY_GLYPH: Readonly<Record<EnemyId, string>> = {
  slime: '🟢',
  skeleton: '💀',
  bat: '🦇',
};

/** Title-case display name for an enemy id (`slime` → `Slime`). */
export function enemyName(id: EnemyId): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

/**
 * Validate a raw route param into a known `EnemyId`, or `null` when unknown.
 * Boundary validation for the `combat/[enemy]` route — never trust the URL param.
 */
export function parseEnemyId(raw: string | undefined): EnemyId | null {
  if (raw === undefined) {
    return null;
  }
  return (ENEMY_IDS as readonly string[]).includes(raw) ? (raw as EnemyId) : null;
}

/**
 * Render an affinity multiplier as a compact chip suffix: `×2`, `×½`, `×0`, and a
 * trimmed decimal for any tuned-in-between value (`1.5` → `×1.5`). Half is spelled
 * with the fraction glyph to match the design ("Resists: 🔴×½").
 */
export function formatMultiplier(mult: number): string {
  if (mult === 0.5) {
    return '×½';
  }
  if (Number.isInteger(mult)) {
    return `×${mult}`;
  }
  // Trim trailing zeros from a tuned decimal (e.g. 1.50 → 1.5).
  return `×${Number(mult.toFixed(2))}`;
}

/** One affinity chip: the color, its glyph, the multiplier, and a ready label. */
export interface AffinityChip {
  readonly color: TileColor;
  readonly glyph: string;
  readonly multiplier: number;
  /** e.g. `🔵×2`. */
  readonly label: string;
}

/** Affinity chips split into the three meaningful tiers (normal colors omitted). */
export interface AffinityChips {
  readonly weak: readonly AffinityChip[];
  readonly resist: readonly AffinityChip[];
  readonly immune: readonly AffinityChip[];
}

/**
 * Group an enemy's affinity table into weak (>1×), resist (0<×<1) and immune (0×)
 * chips, dropping any color at normal (1×). Deterministic color order so the panel
 * is stable frame-to-frame.
 */
export function buildAffinityChips(affinity: AffinityTable): AffinityChips {
  const weak: AffinityChip[] = [];
  const resist: AffinityChip[] = [];
  const immune: AffinityChip[] = [];

  for (const color of COLOR_ORDER) {
    const mult = affinity[color];
    if (mult === undefined || mult === AFFINITY_NORMAL) {
      continue;
    }
    const chip: AffinityChip = {
      color,
      glyph: COLOR_GLYPH[color],
      multiplier: mult,
      label: `${COLOR_GLYPH[color]}${formatMultiplier(mult)}`,
    };
    if (mult > AFFINITY_NORMAL) {
      weak.push(chip);
    } else if (mult === 0) {
      immune.push(chip);
    } else {
      resist.push(chip);
    }
  }

  return { weak, resist, immune };
}

/** A rendered telegraph: an icon, a short badge, and a full sentence. */
export interface IntentDisplay {
  readonly kind: EnemyAction['type'];
  readonly icon: string;
  /** Compact badge for the panel, e.g. `⚔ 8`, `charging…`, `heals 5`. */
  readonly badge: string;
  /** Full sentence for callouts, e.g. `Attacks for 8 next turn`. */
  readonly sentence: string;
}

const INTENT_ICON: Readonly<Record<EnemyAction['type'], string>> = {
  attack: '⚔',
  charge: '⚡',
  heal: '✚',
};

/**
 * Format a telegraphed intent for display. This is the "always visible before the
 * move" affordance — the badge shows on the enemy panel, the sentence is used in
 * turn callouts. The value shown IS the value that will fire (engine guarantee).
 */
export function formatIntent(action: EnemyAction): IntentDisplay {
  const icon = INTENT_ICON[action.type];
  switch (action.type) {
    case 'attack':
      return {
        kind: 'attack',
        icon,
        badge: `${icon} ${action.value}`,
        sentence: `Attacks for ${action.value} next turn`,
      };
    case 'charge':
      return {
        kind: 'charge',
        icon,
        badge: 'charging…',
        sentence: 'Charging — a big hit is coming',
      };
    case 'heal':
      return {
        kind: 'heal',
        icon,
        badge: `heals ${action.value}`,
        sentence: `Heals ${action.value} next turn`,
      };
  }
}

/** What the enemy actually did this turn, phrased for the turn feedback line. */
export function formatEnemyAction(id: EnemyId, action: EnemyAction | null): string {
  if (action === null) {
    return `${enemyName(id)} is defeated`;
  }
  const name = enemyName(id);
  switch (action.type) {
    case 'attack':
      return `${name} attacks for ${action.value}`;
    case 'charge':
      return `${name} is charging…`;
    case 'heal':
      return `${name} heals ${action.value}`;
  }
}

/** The distinct damage colors in a move that landed on an enemy weakness (>1×). */
function weaknessColors(groups: readonly GroupEffect[]): TileColor[] {
  const seen = new Set<TileColor>();
  const colors: TileColor[] = [];
  for (const g of groups) {
    if (g.kind === 'damage' && g.affinity > AFFINITY_NORMAL && !seen.has(g.color)) {
      seen.add(g.color);
      colors.push(g.color);
    }
  }
  return colors;
}

/** The player-move feedback: damage/heal totals plus a weakness callout when hit. */
export interface MoveFeedback {
  readonly damage: number;
  readonly heal: number;
  readonly didDamage: boolean;
  readonly didHeal: boolean;
  /** True when at least one damage group hit an enemy weakness (2× etc.). */
  readonly weaknessHit: boolean;
  /** The distinct weakness colors hit, for the callout ("🔵 Weakness ×2!"). */
  readonly weaknessColors: readonly TileColor[];
  /** A short callout like `🔵 Weakness ×2!`, or `''` when no weakness was hit. */
  readonly weaknessCallout: string;
}

/**
 * Summarize a resolved turn's player-move effects for the on-screen feedback.
 * Reads only the engine's own `TurnResolution` breakdown — no recomputation.
 */
export function formatMoveFeedback(resolution: TurnResolution): MoveFeedback {
  const colors = weaknessColors(resolution.groups);
  const weaknessHit = colors.length > 0;
  const callout = weaknessHit
    ? `${colors.map((c) => COLOR_GLYPH[c]).join('')} Weakness!`
    : '';
  return {
    damage: resolution.damage,
    heal: resolution.heal,
    didDamage: resolution.damage > 0,
    didHeal: resolution.heal > 0,
    weaknessHit,
    weaknessColors: colors,
    weaknessCallout: callout,
  };
}

/** Clamp an HP value to a 0..1 bar fraction; guards a non-positive max. */
export function hpFraction(hp: number, maxHp: number): number {
  if (maxHp <= 0) {
    return 0;
  }
  const raw = hp / maxHp;
  if (raw < 0) return 0;
  if (raw > 1) return 1;
  return raw;
}

/** The `12/30` style HP label; negative HP (never expected) floors at 0. */
export function formatHp(hp: number, maxHp: number): string {
  return `${Math.max(0, hp)}/${maxHp}`;
}
