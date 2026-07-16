/**
 * The boss (Bone Colossus) as data + the run-layer phase machine.
 *
 * The boss is one enemy whose HP depletes across a fight; its BEHAVIOR is a 3-phase intent
 * cycle selected by current HP fraction, with a scripted AFFINITY SHIFT at phase 1 (it starts
 * weak to Red, then hardens to resist Red / weaken to Blue, then enrages weak to Yellow). This
 * per-phase affinity is what the base combat model does NOT support statically — so the boss
 * is driven through the flagged `CombatState.enemy` override seam: each phase is a plain `Enemy`
 * the run layer swaps in as the boss crosses a threshold. No duplicate turn machine; combat's
 * `playTurn` runs each turn against whichever phase-enemy is currently installed.
 *
 * PURE ENGINE: no React / React Native imports; deterministic; never mutates input.
 */
import { AFFINITY_RESIST, AFFINITY_WEAK } from '../combat';
import type { AffinityTable, CombatState, Enemy, EnemyAction } from '../combat';
import { difficultyAt } from './mapGen';
import type { MapConfig } from './mapConfig';
import { ATTACK_DIFFICULTY_DAMPEN, BOSS_BASE_HP, BOSS_HP_DAMPEN, BOSS_NOMINAL_ENEMY_ID } from './runConfig';

/** One boss phase: a name, its affinity table, and its cyclic intent script (base values). */
export interface BossPhase {
  readonly name: string;
  readonly affinity: AffinityTable;
  readonly script: readonly EnemyAction[];
}

/**
 * The three boss phases (base attack values — scaled by the boss-floor ramp at build time).
 * Phase 1 is the scripted affinity shift; every phase hits harder than any normal enemy.
 */
export const BOSS_PHASES: readonly BossPhase[] = [
  {
    name: 'Rising',
    affinity: { R: AFFINITY_WEAK }, // weak to Red
    script: [
      { type: 'attack', value: 10 },
      { type: 'charge', value: 0 },
      { type: 'attack', value: 20 },
    ],
  },
  {
    name: 'Hardened', // ── AFFINITY SHIFT ──
    affinity: { R: AFFINITY_RESIST, B: AFFINITY_WEAK }, // now resists Red, weak to Blue
    script: [
      { type: 'attack', value: 14 },
      { type: 'attack', value: 14 },
      { type: 'charge', value: 0 },
      { type: 'attack', value: 26 },
    ],
  },
  {
    name: 'Enraged',
    affinity: { Y: AFFINITY_WEAK }, // weak to Yellow
    script: [
      { type: 'attack', value: 20 },
      { type: 'attack', value: 24 },
    ],
  },
];

/** HP-fraction thresholds between phases: (>66%] phase 0, (>33%] phase 1, else phase 2. */
const PHASE1_ABOVE = 0.66;
const PHASE2_ABOVE = 0.33;

/** The boss's scaled max HP for its floor: `round(BOSS_BASE_HP × (1 + (diff−1)·BOSS_HP_DAMPEN))`. */
export function bossMaxHp(bossFloor: number, config?: MapConfig): number {
  const diff = config === undefined ? difficultyAt(bossFloor) : difficultyAt(bossFloor, config);
  return Math.round(BOSS_BASE_HP * (1 + (diff - 1) * BOSS_HP_DAMPEN));
}

/** Which phase index a boss at `hp/maxHp` is in. */
export function bossPhaseForHp(hp: number, maxHp: number): number {
  const frac = maxHp > 0 ? hp / maxHp : 0;
  if (frac > PHASE1_ABOVE) return 0;
  if (frac > PHASE2_ABOVE) return 1;
  return 2;
}

/** Scale a boss action's value by the boss-floor attack multiplier (charge stays 0). */
function scaleBossAction(action: EnemyAction, atkMult: number): EnemyAction {
  if (action.type === 'charge') return action;
  return { type: action.type, value: Math.round(action.value * atkMult) };
}

/**
 * Build the boss `Enemy` for a phase: the fixed scaled `maxHp`, the phase's affinity, and the
 * phase's script scaled by the boss-floor attack multiplier `1 + (diff−1)·ATTACK_DIFFICULTY_DAMPEN`.
 * Its id is the nominal boss id (the override supersedes it in combat).
 */
export function bossEnemyForPhase(phaseIndex: number, maxHp: number, diff: number): Enemy {
  const phase = BOSS_PHASES[phaseIndex];
  const atkMult = 1 + (diff - 1) * ATTACK_DIFFICULTY_DAMPEN;
  return {
    id: BOSS_NOMINAL_ENEMY_ID,
    maxHp,
    affinity: phase.affinity,
    script: phase.script.map((a) => scaleBossAction(a, atkMult)),
  };
}

/** The result of a phase re-sync: the (possibly updated) encounter and the current phase. */
export interface BossSyncResult {
  readonly encounter: CombatState;
  readonly phase: number;
}

/**
 * Re-sync the boss encounter to the phase implied by its current HP. When the phase is
 * unchanged the encounter is returned untouched (same reference); when it changes, the
 * `enemy` override is swapped to the new phase and the intent is reset to the phase's first
 * action (a clean telegraph for the new script). Pure; never mutates input.
 */
export function syncBossPhase(
  encounter: CombatState,
  currentPhase: number,
  maxHp: number,
  diff: number,
): BossSyncResult {
  const desired = bossPhaseForHp(encounter.enemyHp, encounter.enemyMaxHp);
  if (desired === currentPhase) {
    return { encounter, phase: currentPhase };
  }
  const enemy = bossEnemyForPhase(desired, maxHp, diff);
  return {
    encounter: { ...encounter, enemy, intentIndex: 0, telegraph: enemy.script[0] },
    phase: desired,
  };
}
