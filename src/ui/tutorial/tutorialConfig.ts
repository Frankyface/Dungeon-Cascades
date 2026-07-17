/**
 * The tutorial's CONFIG RESOLVER (spec §5): `{{CONFIG:name}}` placeholders in the How-to-Play copy
 * resolve to the ENGINE's live constants at render time, so the guide can never go stale when the
 * balance sim retunes. Every value is read straight from the board / combat / run config modules —
 * nothing here is hand-copied. Percentages (group/cascade/rest) render as `25%`; the move timer as
 * seconds; affinity multipliers and score weights as plain numbers.
 *
 * No React imports; deterministic; fully Jest-testable.
 */
import { COLS, MATCH_MIN, ROWS } from '../../engine/board';
import { ATTACK_BASE, AFFINITY_IMMUNE, AFFINITY_RESIST, AFFINITY_WEAK, CASCADE_BONUS, GROUP_SIZE_BONUS, PLAYER_MAX_HP } from '../../engine/combat';
import { META_SCORE_PER_ENCOUNTER_WON, META_SCORE_PER_FLOOR, META_VICTORY_BONUS, REST_HEAL_FRACTION } from '../../engine/run';
import { MOVE_TIMER_MS } from '../board/constants';

/** Render a [0,1] fraction as a rounded whole percentage (0.25 → "25%"). */
function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/**
 * The resolver table: every supported `{{CONFIG:name}}` → its live display string. A THUNK per key
 * (not a precomputed object) keeps each value read at call time straight from the engine constant.
 */
const RESOLVERS: Readonly<Record<string, () => string>> = {
  moveTimerMs: () => `${MOVE_TIMER_MS / 1000} seconds`,
  boardCols: () => String(COLS),
  boardRows: () => String(ROWS),
  matchMin: () => String(MATCH_MIN),
  groupSizeBonus: () => pct(GROUP_SIZE_BONUS),
  cascadeBonus: () => pct(CASCADE_BONUS),
  attackBase: () => String(ATTACK_BASE),
  playerMaxHp: () => String(PLAYER_MAX_HP),
  affinityWeak: () => String(AFFINITY_WEAK),
  affinityResist: () => String(AFFINITY_RESIST),
  affinityImmune: () => String(AFFINITY_IMMUNE),
  restHealPct: () => pct(REST_HEAL_FRACTION),
  scorePerFloor: () => String(META_SCORE_PER_FLOOR),
  scorePerEncounterWon: () => String(META_SCORE_PER_ENCOUNTER_WON),
  victoryBonus: () => String(META_VICTORY_BONUS),
};

/** Every supported config token name (for coverage checks / validation). */
export const CONFIG_TOKENS: readonly string[] = Object.keys(RESOLVERS);

/** The `{{CONFIG:name}}` token pattern (global). */
const TOKEN_RE = /\{\{CONFIG:([a-zA-Z]+)\}\}/g;

/**
 * Resolve ONE config token name to its live display string. Throws on an unknown name (a copy typo
 * fails fast rather than silently rendering a placeholder). Boundary validation.
 */
export function resolveConfigToken(name: string): string {
  const resolver = RESOLVERS[name];
  if (resolver === undefined) {
    throw new Error(`resolveConfigToken: unknown config token '${name}'`);
  }
  return resolver();
}

/**
 * Resolve every `{{CONFIG:name}}` placeholder in a string to its live value. Unknown tokens throw
 * (caught by the well-formed content test), so the rendered tutorial never shows a raw placeholder.
 */
export function resolveConfigText(text: string): string {
  return text.replace(TOKEN_RE, (_match, name: string) => resolveConfigToken(name));
}

/** Whether a string still contains any unresolved `{{CONFIG:...}}` token (test guard). */
export function hasUnresolvedTokens(text: string): boolean {
  return /\{\{CONFIG:[a-zA-Z]+\}\}/.test(text);
}
