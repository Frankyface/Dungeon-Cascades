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
  CombatState,
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
  // Stage-6 biome verbs (placeholder-grade glyphs, like the tiles).
  frostArmor: '🛡',
  armor: '🛡',
  spore: '🌫',
  curse: '🌀',
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
    case 'frostArmor':
      return {
        kind: 'frostArmor',
        icon,
        badge: `shield ${action.value}`,
        sentence: `Raises a ${action.value}-point frost shield next turn`,
      };
    case 'armor':
      return {
        kind: 'armor',
        icon,
        badge: `armor ${action.value}`,
        sentence: `Plates for ${action.value} — softens your next strike`,
      };
    case 'spore':
      return {
        kind: 'spore',
        icon,
        badge: `spore ${action.value}`,
        sentence: `Seeds ${action.value} rot next turn`,
      };
    case 'curse':
      return {
        kind: 'curse',
        icon,
        badge: `curse ${action.value}`,
        sentence: `Curses you — halved heals for ${action.value} turns`,
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
    case 'frostArmor':
      return `${name} raises a ${action.value} frost shield`;
    case 'armor':
      return `${name} plates for ${action.value}`;
    case 'spore':
      return `${name} seeds ${action.value} rot`;
    case 'curse':
      return `${name} curses you for ${action.value} turns`;
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

/** The player-move feedback: EFFECTIVE (applied) totals plus mitigation + a weakness callout. */
export interface MoveFeedback {
  /** Damage that actually reached enemy HP (post armor + shield); `resolution.effectiveDamage`. */
  readonly damage: number;
  /** Heal actually applied (post curse); `resolution.effectiveHeal`. */
  readonly heal: number;
  readonly didDamage: boolean;
  readonly didHeal: boolean;
  /** HP the Glacial shield absorbed from this move (0 when no shield). */
  readonly shieldAbsorbed: number;
  /** HP the Emberworks armor softened from this move (0 when no armor). */
  readonly armorAbsorbed: number;
  /** True when a Sunken-Catacombs curse halved the heal (effectiveHeal < raw heal). */
  readonly curseHalved: boolean;
  /** True when at least one damage group hit an enemy weakness (2× etc.). */
  readonly weaknessHit: boolean;
  /** The distinct weakness colors hit, for the callout ("🔵 Weakness ×2!"). */
  readonly weaknessColors: readonly TileColor[];
  /** A short callout like `🔵 Weakness ×2!`, or `''` when no weakness was hit. */
  readonly weaknessCallout: string;
}

/**
 * Summarize a resolved turn's player-move effects for the on-screen feedback, using the EFFECTIVE
 * (applied) numbers so the shown damage/heal always equal what actually hit HP (review H1 — the
 * telegraph "what you see is what fires" contract, extended to the biome mitigation channels). Reads
 * only the engine's own `TurnResolution` — no combat recomputation.
 */
export function formatMoveFeedback(resolution: TurnResolution): MoveFeedback {
  const colors = weaknessColors(resolution.groups);
  const weaknessHit = colors.length > 0;
  const callout = weaknessHit
    ? `${colors.map((c) => COLOR_GLYPH[c]).join('')} Weakness!`
    : '';
  return {
    damage: resolution.effectiveDamage,
    heal: resolution.effectiveHeal,
    didDamage: resolution.effectiveDamage > 0,
    didHeal: resolution.effectiveHeal > 0,
    shieldAbsorbed: resolution.shieldAbsorbed,
    armorAbsorbed: resolution.armorAbsorbed,
    curseHalved: resolution.effectiveHeal < resolution.heal,
    weaknessHit,
    weaknessColors: colors,
    weaknessCallout: callout,
  };
}

/** The tone of the impact-beat feedback line — a subset of the panel's FeedbackTone. */
export type ImpactTone = 'damage' | 'heal' | 'neutral';

/** The player-move ("impact") feedback line: the main string, an optional weakness accent, and a tone. */
export interface ImpactFeedback {
  readonly main: string;
  readonly accent?: string;
  readonly tone: ImpactTone;
}

/** A concise callout of how much a move was blunted by the enemy's shield / armor. */
function mitigationNote(shieldAbsorbed: number, armorAbsorbed: number): string {
  if (shieldAbsorbed > 0 && armorAbsorbed > 0) return ` (${shieldAbsorbed + armorAbsorbed} absorbed)`;
  if (shieldAbsorbed > 0) return ` (${shieldAbsorbed} absorbed by shield)`;
  if (armorAbsorbed > 0) return ` (${armorAbsorbed} softened by armor)`;
  return '';
}

/**
 * Build the player-move impact feedback line from a resolution, using the EFFECTIVE numbers and
 * calling out mitigation (shield/armor absorb, curse halving). A fully-absorbed hit reports the
 * absorb instead of "no match", so the shield/armor is never invisible. Pure + Jest-testable — the
 * combat screen just renders the returned strings.
 */
export function buildImpactFeedback(resolution: TurnResolution): ImpactFeedback {
  const fb = formatMoveFeedback(resolution);
  const accent = fb.weaknessHit ? fb.weaknessCallout : undefined;
  const mitig = mitigationNote(fb.shieldAbsorbed, fb.armorAbsorbed);
  const curseNote = fb.curseHalved ? ' (halved by curse)' : '';

  if (fb.didDamage && fb.didHeal) {
    return { main: `−${fb.damage} dmg${mitig} · +${fb.heal} HP${curseNote}`, accent, tone: 'damage' };
  }
  if (fb.didDamage) {
    return { main: `−${fb.damage} damage${mitig}`, accent, tone: 'damage' };
  }
  if (fb.didHeal) {
    return { main: `+${fb.heal} HP healed${curseNote}`, tone: 'heal' };
  }
  // No HP reached the enemy: distinguish "fully absorbed by a channel" from "no match at all".
  if (fb.shieldAbsorbed > 0 || fb.armorAbsorbed > 0) {
    return { main: `0 through${mitig}`, accent, tone: 'neutral' };
  }
  return { main: 'No match — no damage', tone: 'neutral' };
}

/** The rot turn-start DoT feedback line, e.g. `Rot seeps −3`. */
export function rotSeepText(rotTick: number): string {
  return `Rot seeps −${rotTick}`;
}

/** One active biome-channel status chip (rendered as a compact row on the combat screen). */
export interface StatusChip {
  readonly key: 'shield' | 'armor' | 'rot' | 'curse';
  readonly glyph: string;
  /** e.g. `12`, `3`, `2 turns` — the value beside the glyph. */
  readonly label: string;
  readonly tint: string;
}

/**
 * The active biome channels on a `CombatState`, as compact status chips (empty for a default-biome
 * fight, which has no channels ⇒ no chip row rendered). Sourced straight from CombatState so the row
 * always mirrors the live persistent state (enemy shield/armor, player rot/curse). Pure + testable.
 */
export function buildStatusChips(
  combat: Pick<CombatState, 'enemyShield' | 'enemyArmor' | 'rotStacks' | 'curseTurns'>,
): readonly StatusChip[] {
  const chips: StatusChip[] = [];
  const shield = combat.enemyShield ?? 0;
  const armor = combat.enemyArmor ?? 0;
  const rot = combat.rotStacks ?? 0;
  const curse = combat.curseTurns ?? 0;
  if (shield > 0) chips.push({ key: 'shield', glyph: '🛡', label: `${shield}`, tint: COMBAT_STATUS_TINT.shield });
  if (armor > 0) chips.push({ key: 'armor', glyph: '⛨', label: `${armor}`, tint: COMBAT_STATUS_TINT.armor });
  if (rot > 0) chips.push({ key: 'rot', glyph: '🍄', label: `${rot}`, tint: COMBAT_STATUS_TINT.rot });
  if (curse > 0) chips.push({ key: 'curse', glyph: '🕯', label: `${curse} turn${curse === 1 ? '' : 's'}`, tint: COMBAT_STATUS_TINT.curse });
  return chips;
}

/** Tint per status channel (imported hue values, so combatFormat stays React-free). */
const COMBAT_STATUS_TINT: Readonly<Record<StatusChip['key'], string>> = {
  shield: '#9ec2ff', // resist-blue: enemy frost shield
  armor: '#ffd76b', // charge-amber: enemy one-shot plate
  rot: '#ff9ea1', // damage-red: player rot DoT
  curse: '#c9a8ff', // curse-violet: player heal debuff
};

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
