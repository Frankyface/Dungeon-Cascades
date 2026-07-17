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
import type { AffinityTable, BiomeId, BossId, CombatState, Enemy, EnemyAction } from '../combat';
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
 * A whole boss as data: a stable id, display name, biome tag, base HP (150 for every Stage-6
 * biome boss; 120 for the default-dungeon Bone Colossus), and its 3-phase model. The run layer
 * drives it through the SAME machinery as the Bone Colossus (`bossEnemyForPhaseOf` +
 * `syncBossPhase`) — no per-boss turn code. Boss selection by biome arrives in a later wave.
 */
export interface Boss {
  readonly id: BossId;
  readonly name: string;
  readonly biome: BiomeId;
  readonly baseHp: number;
  readonly phases: readonly BossPhase[];
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

/** Scaled boss max HP for a given base and floor: `round(base × (1 + (diff−1)·BOSS_HP_DAMPEN))`. */
export function bossMaxHpFor(baseHp: number, bossFloor: number, config?: MapConfig): number {
  const diff = config === undefined ? difficultyAt(bossFloor) : difficultyAt(bossFloor, config);
  return Math.round(baseHp * (1 + (diff - 1) * BOSS_HP_DAMPEN));
}

/** The Bone Colossus's scaled max HP for its floor (base `BOSS_BASE_HP`). */
export function bossMaxHp(bossFloor: number, config?: MapConfig): number {
  return bossMaxHpFor(BOSS_BASE_HP, bossFloor, config);
}

/** Which phase index a boss at `hp/maxHp` is in. */
export function bossPhaseForHp(hp: number, maxHp: number): number {
  const frac = maxHp > 0 ? hp / maxHp : 0;
  if (frac > PHASE1_ABOVE) return 0;
  if (frac > PHASE2_ABOVE) return 1;
  return 2;
}

/**
 * Scale a boss action's value by the boss-floor attack multiplier. NON-scaling verbs (returned
 * untouched) — mirrors `enemyScaling.scaleAction` so a boss and a fight scale a shared verb the
 * SAME way:
 * - `charge` — value is 0 (deals nothing);
 * - `curse` — value is a TURN COUNT; scaling would inflate its heal-denial duration at deep floors
 *   (content-biomes.md, Sunken Catacombs boss-scaling guard);
 * - `spore` — value is a STACK COUNT; "stacks are stacks" — scaling would inflate the DoT length
 *   (decisions.md 2026-07-17 R1: spore NEVER scales — the Rotmother's spore stays at its base
 *   value at every floor, matching the fight-side guard already in `enemyScaling.scaleAction`).
 * `frostArmor` / `armor` / `heal` are AMOUNTS and scale like `attack`.
 */
function scaleBossAction(action: EnemyAction, atkMult: number): EnemyAction {
  if (action.type === 'charge' || action.type === 'curse' || action.type === 'spore') return action;
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

/**
 * Build the phase `Enemy` for ANY boss (the Bone Colossus or a Stage-6 biome boss) — the same
 * per-phase affinity + floor-scaled script the Bone Colossus uses, but drawn from the supplied
 * boss's data and carrying the real boss id + biome tag. Existing combat/scaling machinery runs
 * these unchanged (via the `CombatState.enemy` override). Pure; never mutates input.
 */
export function bossEnemyForPhaseOf(boss: Boss, phaseIndex: number, maxHp: number, diff: number): Enemy {
  const phase = boss.phases[phaseIndex];
  const atkMult = 1 + (diff - 1) * ATTACK_DIFFICULTY_DAMPEN;
  return {
    id: boss.id,
    maxHp,
    affinity: phase.affinity,
    script: phase.script.map((a) => scaleBossAction(a, atkMult)),
    biome: boss.biome,
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
 *
 * Semantics after a swap (fairness contract, fix 2026-07-16):
 * - `intentIndex` is reset to 0: each phase's script is a fresh cycle — the old phase's
 *   cursor is meaningless against the new script (which may be a different length), and
 *   starting at `script[0]` gives the player a fully visible opening move for the new phase.
 * - The desired phase reads DIRECTLY from the HP fraction, so one turn that crosses two
 *   thresholds swaps straight from phase 0 to phase 2 (no phase-1 stopover).
 * - The run layer calls this at the END of the turn that changed the boss's HP, so the
 *   telegraph stored/shown after that turn is exactly what fires next turn ("what you see
 *   is what fires" holds across phase transitions, and a mid-transition save reloads to
 *   the identical telegraph).
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

/**
 * `syncBossPhase` generalized over ANY boss (the Bone Colossus or an Act-2 biome boss): identical
 * HP-fraction phase logic and fairness contract, but the swapped-in phase enemy is drawn from the
 * supplied boss's data via `bossEnemyForPhaseOf` (carrying its real id + biome). The Act-1 flow keeps
 * using the narrow `syncBossPhase` so the dungeon boss stays byte-identical; the Act-2 flow uses this.
 * Pure; never mutates input.
 */
export function syncBossPhaseOf(
  boss: Boss,
  encounter: CombatState,
  currentPhase: number,
  maxHp: number,
  diff: number,
): BossSyncResult {
  const desired = bossPhaseForHp(encounter.enemyHp, encounter.enemyMaxHp);
  if (desired === currentPhase) {
    return { encounter, phase: currentPhase };
  }
  const enemy = bossEnemyForPhaseOf(boss, desired, maxHp, diff);
  return {
    encounter: { ...encounter, enemy, intentIndex: 0, telegraph: enemy.script[0] },
    phase: desired,
  };
}
