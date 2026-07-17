/**
 * Boss telegraph FAIRNESS across phase transitions — the integration proof of the game's
 * core fairness contract: "the enemy fires its telegraphed intent exactly as shown", on EVERY
 * turn, INCLUDING the turn after an HP-threshold phase crossing.
 *
 * The bug this pins down (fix 2026-07-16): the boss phase used to re-sync only at the START
 * of a turn, so the turn that dropped the boss across a threshold stored/showed the OLD
 * phase's next intent, then the next turn's sync silently replaced it and the boss fired the
 * NEW phase's script[0] — un-telegraphed damage. The fix re-syncs at the END of the crossing
 * turn, so the shown telegraph always belongs to the phase that will actually act.
 *
 * Fights are driven through the real run flow (`enterNode` / `playEncounterTurn`) against a
 * real generated map's boss node; deterministic greedy paths; HP threshold crossings are made
 * exact by probing a turn's (deterministic) damage first, then crafting the boss HP pool so
 * that same move crosses one threshold, two thresholds, or kills outright.
 */
import { startRun, enterNode, playEncounterTurn } from './runFlow';
import type { RunOptions } from './runFlow';
import { greedyComboPath } from './runPolicy';
import { bossEnemyForPhase } from './boss';
import { difficultyAt } from './mapGen';
import { InMemoryRunStore } from './runStore';
import { DEFAULT_COMBAT_CONFIG } from '../combat';
import type { RunState } from './runTypes';

/** A player HP pool large enough that boss hits never end these fixture fights early. */
const BIG_HP = 100000;

/** Options threaded through every turn: default combat math, but an un-killable player. */
const OPTIONS: RunOptions = { combatConfig: { ...DEFAULT_COMBAT_CONFIG, playerMaxHp: BIG_HP } };

/** Safety cap on fixture fight length (a real boss fight ends far below this). */
const MAX_FIGHT_TURNS = 500;

/** Start a run and jump it straight onto the boss node, entering boss combat. */
function bossCombat(seed: number): { state: RunState; bossFloor: number } {
  const fresh = startRun(seed);
  const bossNode = fresh.map.nodes.find((n) => n.id === fresh.map.bossId);
  if (bossNode === undefined) throw new Error('map has no boss node');
  const jumped: RunState = {
    ...fresh,
    playerHp: BIG_HP,
    playerMaxHp: BIG_HP,
    mapState: { ...fresh.mapState, currentNodeId: fresh.map.bossId },
  };
  return { state: enterNode(jumped, OPTIONS), bossFloor: bossNode.floor };
}

/** Narrow a run state to its combat phase (throws when not in combat). */
function combatPhase(state: RunState): Extract<RunState['phase'], { kind: 'combat' }> {
  if (state.phase.kind !== 'combat') throw new Error(`expected combat phase, got '${state.phase.kind}'`);
  return state.phase;
}

/** The same run state with the boss's live/max HP replaced (crafted threshold fixtures). */
function withBossHp(state: RunState, enemyHp: number, enemyMaxHp: number): RunState {
  const phase = combatPhase(state);
  return { ...state, phase: { ...phase, encounter: { ...phase.encounter, enemyHp, enemyMaxHp } } };
}

describe('boss fairness — what you see is what fires (every turn, across phase transitions)', () => {
  it('a full boss fight never fires an action that was not the previously shown telegraph', () => {
    const { state: start } = bossCombat(42);
    let state = start;
    let shown = combatPhase(state).encounter.telegraph; // the telegraph on screen before each turn
    let maxPhaseSeen = 0;

    for (let i = 0; i < MAX_FIGHT_TURNS && state.status === 'active' && state.phase.kind === 'combat'; i++) {
      const path = greedyComboPath(state.phase.encounter.board);
      const { state: next, resolution } = playEncounterTurn(state, path, OPTIONS);

      // THE fairness contract: the action that fired is exactly the telegraph that was shown
      // (null only when the boss died this turn — a dead enemy never acts).
      if (resolution.enemyAction !== null) {
        expect(resolution.enemyAction).toEqual(shown);
      }

      if (next.phase.kind === 'combat') {
        shown = next.phase.encounter.telegraph;
        maxPhaseSeen = Math.max(maxPhaseSeen, next.phase.bossPhase);
      }
      state = next;
    }

    // The fight completed AND actually crossed at least one phase boundary — the invariant
    // above was exercised across a transition, not just within phase 0. Beating the ACT-1 boss now
    // enters the act transition (the run stays active), rather than ending in victory.
    expect(state.status).toBe('active');
    expect(state.phase.kind).toBe('act_transition');
    expect(maxPhaseSeen).toBeGreaterThanOrEqual(1);
  });

  it('the telegraph stored AND returned after a crossing turn belongs to the NEW phase, and fires next turn', () => {
    const { state: start, bossFloor } = bossCombat(42);
    const path = greedyComboPath(combatPhase(start).encounter.board);

    // Probe the turn's damage (deterministic: same board/path/RNG/affinity ⇒ same damage).
    const d = playEncounterTurn(start, path, OPTIONS).resolution.damage;
    expect(d).toBeGreaterThanOrEqual(1);

    // Craft the boss pool so this exact move crosses phase 0 → 1: 2d HP (100%) → d HP (50%).
    const crafted = withBossHp(start, 2 * d, 2 * d);
    const { state: after, resolution } = playEncounterTurn(crafted, path, OPTIONS);
    expect(resolution.status).toBe('ongoing');

    const afterPhase = combatPhase(after);
    const expected = bossEnemyForPhase(1, 2 * d, difficultyAt(bossFloor));
    // The run layer synced at the END of the crossing turn: phase 1, fresh script cursor.
    expect(afterPhase.bossPhase).toBe(1);
    expect(afterPhase.encounter.intentIndex).toBe(0);
    expect(afterPhase.encounter.telegraph).toEqual(expected.script[0]);
    // The resolution the UI animates mirrors the synced state — no stale old-phase telegraph.
    expect(resolution.telegraph).toEqual(expected.script[0]);
    expect(resolution.state).toBe(afterPhase.encounter);

    // And the next turn fires EXACTLY that shown telegraph.
    const r2 = playEncounterTurn(after, greedyComboPath(afterPhase.encounter.board), OPTIONS);
    expect(r2.resolution.enemyAction).toEqual(expected.script[0]);
  });

  it('a single turn crossing TWO thresholds (phase 0 → 2) telegraphs phase 2 and fires it', () => {
    const { state: start, bossFloor } = bossCombat(42);

    // Walk the real fight (still in phase 0) until a turn deals ≥ 3 damage, so a (d+1)-HP
    // pool crosses BOTH thresholds: (d+1) HP (100%, phase 0) → 1 HP (≤ 33%, phase 2).
    let cur = start;
    let found: { state: RunState; path: ReturnType<typeof greedyComboPath>; d: number } | null = null;
    for (let i = 0; i < 50 && found === null; i++) {
      const phase = combatPhase(cur);
      if (phase.bossPhase !== 0) break;
      const path = greedyComboPath(phase.encounter.board);
      const probe = playEncounterTurn(cur, path, OPTIONS);
      if (probe.resolution.damage >= 3 && probe.resolution.status === 'ongoing') {
        found = { state: cur, path, d: probe.resolution.damage };
      } else if (probe.state.phase.kind === 'combat') {
        cur = probe.state;
      } else {
        break;
      }
    }
    expect(found).not.toBeNull();
    const { state: s0, path, d } = found!;

    const crafted = withBossHp(s0, d + 1, d + 1);
    const { state: after, resolution } = playEncounterTurn(crafted, path, OPTIONS);
    expect(resolution.status).toBe('ongoing');

    const afterPhase = combatPhase(after);
    const expected = bossEnemyForPhase(2, d + 1, difficultyAt(bossFloor));
    // The sync reads the phase straight from HP: a double crossing lands directly in phase 2.
    expect(afterPhase.bossPhase).toBe(2);
    expect(afterPhase.encounter.intentIndex).toBe(0);
    expect(afterPhase.encounter.telegraph).toEqual(expected.script[0]);
    expect(resolution.telegraph).toEqual(expected.script[0]);

    // The crossing left the boss at 1 HP; re-pot it WITHIN phase 2 (100/1000 = 10% ⇒ still
    // phase 2, no sync fires, telegraph untouched) so the next turn cannot kill it before
    // it acts — then the fired action must be exactly the shown phase-2 telegraph.
    const repotted = withBossHp(after, 100, 1000);
    expect(combatPhase(repotted).encounter.telegraph).toEqual(expected.script[0]);
    const r2 = playEncounterTurn(repotted, greedyComboPath(afterPhase.encounter.board), OPTIONS);
    expect(r2.resolution.enemyAction).toEqual(expected.script[0]);
  });

  it('killing the boss on the crossing turn enters the act transition with no phantom new-phase action', () => {
    const { state: start } = bossCombat(42);
    const path = greedyComboPath(combatPhase(start).encounter.board);
    const d = playEncounterTurn(start, path, OPTIONS).resolution.damage;

    // A d-HP pool (100%) dies to this exact move — the crossing and the kill coincide.
    const crafted = withBossHp(start, d, d);
    const { state: after, resolution } = playEncounterTurn(crafted, path, OPTIONS);

    expect(resolution.status).toBe('won');
    expect(resolution.enemyAction).toBeNull(); // a dead boss never acts
    // The ACT-1 boss kill enters the act transition (run still active); the ACT-2 boss kill would win.
    expect(after.status).toBe('active');
    expect(after.phase.kind).toBe('act_transition');
  });

  it('save/load immediately after the crossing turn continues identically to never saving', () => {
    const { state: start } = bossCombat(42);
    const path = greedyComboPath(combatPhase(start).encounter.board);
    const d = playEncounterTurn(start, path, OPTIONS).resolution.damage;

    // Cross phase 0 → 1, then serialize on the very next frame (mid-transition checkpoint).
    const { state: after } = playEncounterTurn(withBossHp(start, 2 * d, 2 * d), path, OPTIONS);
    const store = new InMemoryRunStore();
    store.save(after);
    const reloaded = store.load();
    expect(reloaded).not.toBeNull();
    expect(reloaded).toEqual(after); // lossless JSON round-trip (phase override included)

    const nextPath = greedyComboPath(combatPhase(after).encounter.board);
    const straight = playEncounterTurn(after, nextPath, OPTIONS);
    const resumed = playEncounterTurn(reloaded!, nextPath, OPTIONS);

    // Identical continuation — and both fired exactly the telegraph shown before saving.
    expect(resumed.resolution.enemyAction).toEqual(straight.resolution.enemyAction);
    expect(resumed.state).toEqual(straight.state);
    expect(straight.resolution.enemyAction).toEqual(combatPhase(after).encounter.telegraph);
  });
});
