/**
 * Pure compendium view-models: fold the engine registries (relics, enemies, the boss) into the
 * display entries the in-game encyclopedia renders. Every number is DERIVED from the same data the
 * engine plays with — relic hook modifiers, `ENEMY_STATS`, and the elite/boss scaling functions —
 * so the compendium can never drift from the real balance. Formatting is REUSED, never duplicated:
 * relic effect text comes from `relicPresentation`, and affinity chips + intent icons from
 * `combatFormat`. No React imports; deterministic and fully Jest-testable against the registries.
 */
import { ENEMY_IDS, getEnemy } from '../../engine/combat';
import type { EnemyAction, EnemyId } from '../../engine/combat';
import {
  BOSS_BASE_HP,
  BOSS_NAME,
  BOSS_PHASES,
  DEFAULT_MAP_CONFIG,
  RELIC_IDS,
  bossEnemyForPhase,
  bossMaxHp,
  bossPhaseForHp,
  difficultyAt,
  scaledEnemyFor,
} from '../../engine/run';
import { ENEMY_GLYPH, buildAffinityChips, enemyName, formatIntent } from '../combat/combatFormat';
import type { AffinityChips } from '../combat/combatFormat';
import { relicCards } from '../run/relicPresentation';
import type { RelicCard } from '../run/relicPresentation';

/**
 * A representative mid-run floor for the enemy "Elite" scaling example. The default plan is 13
 * floors (0..12) with the boss on the last; floor 6 is the exact midpoint — a fair "mid-run" sample.
 */
export const ELITE_SAMPLE_FLOOR = 6;

/** A distinct boss glyph (the Bone Colossus is its own foe, not the plain skeleton 💀). */
export const BOSS_GLYPH = '☠️';

/** The fairness contract the boss card surfaces (mirrors boss.ts's telegraph guarantee). */
const BOSS_FAIRNESS_NOTE =
  "The telegraph always shows the boss's next action — even the turn it shifts phase. What you see is exactly what fires.";

/**
 * A single intent step, compact, reusing `combatFormat`'s intent icons so the glyphs stay the
 * single source of truth: `⚔ 8`, `⚡ charge`, `✚ heal 8`.
 */
export function intentStepLabel(action: EnemyAction): string {
  const { icon } = formatIntent(action);
  switch (action.type) {
    case 'attack':
      return `${icon} ${action.value}`;
    case 'charge':
      return `${icon} charge`;
    case 'heal':
      return `${icon} heal ${action.value}`;
    case 'frostArmor':
      return `${icon} shield ${action.value}`;
    case 'armor':
      return `${icon} armor ${action.value}`;
    case 'spore':
      return `${icon} spore ${action.value}`;
    case 'curse':
      return `${icon} curse ${action.value}`;
  }
}

/** A cyclic intent script as a readable loop, e.g. `⚔ 8 → ⚡ charge → ⚔ 16 → repeat`. */
export function scriptCycleText(script: readonly EnemyAction[]): string {
  if (script.length === 0) {
    return '';
  }
  return [...script.map(intentStepLabel), 'repeat'].join(' → ');
}

// ── Relics ───────────────────────────────────────────────────────────────────

/** All 12 relics as display cards (reuses `relicPresentation` — no duplicated effect text). */
export function compendiumRelics(): readonly RelicCard[] {
  return relicCards(RELIC_IDS);
}

// ── Enemies ──────────────────────────────────────────────────────────────────

/** The elite-scaled snapshot of an enemy at one representative floor. */
export interface CompendiumEliteExample {
  readonly floor: number;
  readonly hp: number;
  readonly scriptCycle: string;
}

/** One enemy's compendium entry: identity, base stats, affinity chips, intent cycle + elite sample. */
export interface CompendiumEnemyEntry {
  readonly id: EnemyId;
  readonly name: string;
  readonly glyph: string;
  readonly baseHp: number;
  readonly affinity: AffinityChips;
  readonly scriptCycle: string;
  readonly elite: CompendiumEliteExample;
}

/** Build the compendium entry for one enemy id, straight from the combat registry + scaling. */
export function compendiumEnemy(id: EnemyId): CompendiumEnemyEntry {
  const base = getEnemy(id);
  const elite = scaledEnemyFor(id, ELITE_SAMPLE_FLOOR, true);
  return {
    id,
    name: enemyName(id),
    glyph: ENEMY_GLYPH[id],
    baseHp: base.maxHp,
    affinity: buildAffinityChips(base.affinity),
    scriptCycle: scriptCycleText(base.script),
    elite: {
      floor: ELITE_SAMPLE_FLOOR,
      hp: elite.maxHp,
      scriptCycle: scriptCycleText(elite.script),
    },
  };
}

/** Every enemy's compendium entry, in the registry's canonical order. */
export function compendiumEnemies(): readonly CompendiumEnemyEntry[] {
  return ENEMY_IDS.map(compendiumEnemy);
}

// ── Boss ─────────────────────────────────────────────────────────────────────

/** One boss phase entry: name, its HP band, affinity shift chips, and the scaled intent cycle. */
export interface CompendiumBossPhaseEntry {
  readonly name: string;
  /** Highest HP at which this phase is active (top of the band). */
  readonly hpHigh: number;
  /** Lowest HP at which this phase is active (bottom of the band). */
  readonly hpLow: number;
  /** Ready-to-render band, e.g. `185–123 HP`. */
  readonly hpBand: string;
  readonly affinity: AffinityChips;
  readonly scriptCycle: string;
}

/** The boss's compendium entry: identity, floor-scaled HP, the three phases, and the fairness note. */
export interface CompendiumBossEntry {
  readonly name: string;
  readonly glyph: string;
  readonly floor: number;
  readonly baseHp: number;
  readonly maxHp: number;
  readonly phases: readonly CompendiumBossPhaseEntry[];
  readonly fairnessNote: string;
}

/**
 * The inclusive `[low, high]` HP band of every phase at a given max HP, DERIVED by probing the
 * engine's own `bossPhaseForHp` (rather than duplicating the private threshold constants) — so a
 * threshold change in the engine surfaces directly as a diff here. A phase with no integer HP in
 * its band (impossible at the real boss's HP) reports `{ low: 0, high: 0 }`.
 */
export function bossPhaseHpBands(maxHp: number): ReadonlyArray<{ readonly low: number; readonly high: number }> {
  return BOSS_PHASES.map((_, phaseIndex) => {
    let low = -1;
    let high = -1;
    for (let hp = 0; hp <= maxHp; hp++) {
      if (bossPhaseForHp(hp, maxHp) !== phaseIndex) {
        continue;
      }
      if (low === -1) {
        low = hp;
      }
      high = hp;
    }
    return low === -1 ? { low: 0, high: 0 } : { low, high };
  });
}

/** Build the boss compendium entry at the default plan's boss floor (last floor, fully scaled). */
export function compendiumBoss(): CompendiumBossEntry {
  const floor = DEFAULT_MAP_CONFIG.floorPlan.length - 1;
  const maxHp = bossMaxHp(floor);
  const diff = difficultyAt(floor);
  const bands = bossPhaseHpBands(maxHp);
  const phases = BOSS_PHASES.map((phase, i): CompendiumBossPhaseEntry => {
    const scaled = bossEnemyForPhase(i, maxHp, diff);
    const band = bands[i];
    return {
      name: phase.name,
      hpHigh: band.high,
      hpLow: band.low,
      hpBand: `${band.high}–${band.low} HP`,
      affinity: buildAffinityChips(phase.affinity),
      scriptCycle: scriptCycleText(scaled.script),
    };
  });
  return {
    name: BOSS_NAME,
    glyph: BOSS_GLYPH,
    floor,
    baseHp: BOSS_BASE_HP,
    maxHp,
    phases,
    fairnessNote: BOSS_FAIRNESS_NOTE,
  };
}
