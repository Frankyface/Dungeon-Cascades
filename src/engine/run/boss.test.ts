/**
 * Boss fixtures. The boss (Bone Colossus) is data: ~120 HP ramp-scaled, a 3-phase intent
 * cycle meaningfully harder than normals, with a scripted AFFINITY-SHIFT at phase 1 (weak-to-
 * red flips to resist-red / weak-to-blue). Phases are selected by current HP fraction; the
 * run layer re-syncs the `CombatState.enemy` override on a phase change.
 */
import { AFFINITY_RESIST, AFFINITY_WEAK, getEnemy, startEncounter } from '../combat';
import { BOSS_PHASES, bossEnemyForPhase, bossMaxHp, bossPhaseForHp, syncBossPhase } from './boss';
import { BOSS_NOMINAL_ENEMY_ID } from './runConfig';

describe('boss phase data', () => {
  it('has 3 phases and a scripted affinity shift at phase 1', () => {
    expect(BOSS_PHASES).toHaveLength(3);
    // Phase 0: weak to Red. Phase 1: the shift — resists Red, weak to Blue.
    expect(BOSS_PHASES[0].affinity.R).toBe(AFFINITY_WEAK);
    expect(BOSS_PHASES[1].affinity.R).toBe(AFFINITY_RESIST);
    expect(BOSS_PHASES[1].affinity.B).toBe(AFFINITY_WEAK);
    // Affinity actually changed between phase 0 and 1.
    expect(BOSS_PHASES[0].affinity).not.toEqual(BOSS_PHASES[1].affinity);
  });

  it('hits meaningfully harder than a normal enemy (max attack > skeleton 16)', () => {
    const maxBossAttack = Math.max(
      ...BOSS_PHASES.flatMap((p) => p.script.filter((a) => a.type === 'attack').map((a) => a.value)),
    );
    const maxSkeletonAttack = Math.max(
      ...getEnemy('skeleton').script.filter((a) => a.type === 'attack').map((a) => a.value),
    );
    expect(maxBossAttack).toBeGreaterThan(maxSkeletonAttack);
  });
});

describe('bossMaxHp — ~120 HP ramp-scaled', () => {
  it('scales the base 120 by the dampened boss-floor ramp (floor 12 ⇒ 168)', () => {
    // STAGE-6 RETUNE: BOSS_HP_DAMPEN 0.3→0.22. difficultyAt(12)=2.8 ⇒ 1 + (1.8×0.22) = 1.396 ⇒
    // round(120×1.396 = 167.52) = 168
    expect(bossMaxHp(12)).toBe(168);
  });

  it('is ~120 at floor 0', () => {
    expect(bossMaxHp(0)).toBe(120);
  });
});

describe('bossPhaseForHp — HP-fraction thresholds', () => {
  it('phase 0 above 66%, phase 1 in (33%,66%], phase 2 at/below 33%', () => {
    expect(bossPhaseForHp(100, 100)).toBe(0);
    expect(bossPhaseForHp(67, 100)).toBe(0);
    expect(bossPhaseForHp(66, 100)).toBe(1);
    expect(bossPhaseForHp(34, 100)).toBe(1);
    expect(bossPhaseForHp(33, 100)).toBe(2);
    expect(bossPhaseForHp(1, 100)).toBe(2);
  });
});

describe('bossEnemyForPhase — scaled phase enemy', () => {
  it('carries the nominal id, the fixed maxHp, and the phase affinity + scaled script', () => {
    const enemy = bossEnemyForPhase(1, 185, 1.0); // diff 1.0 ⇒ script unscaled
    expect(enemy.id).toBe(BOSS_NOMINAL_ENEMY_ID);
    expect(enemy.maxHp).toBe(185);
    expect(enemy.affinity.R).toBe(AFFINITY_RESIST);
    expect(enemy.script).toEqual(BOSS_PHASES[1].script);
  });
});

describe('syncBossPhase — re-sync on a phase change', () => {
  it('keeps phase 0 while HP is high (no change)', () => {
    const enc = startEncounter(BOSS_NOMINAL_ENEMY_ID, 1, undefined, undefined, bossEnemyForPhase(0, 185, 1.0));
    const withHp = { ...enc, enemyHp: 185, enemyMaxHp: 185 };
    const synced = syncBossPhase(withHp, 0, 185, 1.0);
    expect(synced.phase).toBe(0);
    expect(synced.encounter).toBe(withHp); // unchanged reference (no work when phase stable)
  });

  it('switches to phase 1 (affinity shift) when HP drops below 66% and resets the telegraph', () => {
    const enc = startEncounter(BOSS_NOMINAL_ENEMY_ID, 1, undefined, undefined, bossEnemyForPhase(0, 185, 1.0));
    const wounded = { ...enc, enemyHp: 90, enemyMaxHp: 185 }; // ~49% ⇒ phase 1
    const synced = syncBossPhase(wounded, 0, 185, 1.0);
    expect(synced.phase).toBe(1);
    expect(synced.encounter.enemy?.affinity.R).toBe(AFFINITY_RESIST); // the shift is live
    expect(synced.encounter.intentIndex).toBe(0);
    expect(synced.encounter.telegraph).toEqual(BOSS_PHASES[1].script[0]);
  });

  it('jumps straight from phase 0 to phase 2 when one turn crosses BOTH thresholds', () => {
    const enc = startEncounter(BOSS_NOMINAL_ENEMY_ID, 1, undefined, undefined, bossEnemyForPhase(0, 185, 1.0));
    const gutted = { ...enc, enemyHp: 10, enemyMaxHp: 185 }; // ~5% ⇒ phase 2 directly
    const synced = syncBossPhase(gutted, 0, 185, 1.0);
    expect(synced.phase).toBe(2); // desired phase reads straight from HP — no phase-1 stopover
    expect(synced.encounter.intentIndex).toBe(0);
    expect(synced.encounter.telegraph).toEqual(BOSS_PHASES[2].script[0]);
  });
});
