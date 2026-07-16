import { playTurn, startEncounter } from '../../engine/combat';
import type { CombatState, TurnResolution } from '../../engine/combat';
import type { Direction } from '../../engine/board';
import {
  combatReducer,
  initCombatState,
  isEncounterOver,
  type CombatScreenState,
} from './combatReducer';

function fresh(seed = 42): CombatScreenState {
  return initCombatState('slime', seed);
}

/** The first single-step move the engine accepts for this state (real resolution). */
function firstValidTurn(combat: CombatState): TurnResolution {
  const dirs: Direction[] = ['up', 'down', 'left', 'right'];
  for (let row = 0; row < combat.board.rows; row++) {
    for (let col = 0; col < combat.board.cols; col++) {
      for (const dir of dirs) {
        try {
          return playTurn(combat, { start: { col, row }, steps: [dir] });
        } catch {
          continue;
        }
      }
    }
  }
  throw new Error('no valid move found');
}

/** A stub resolution whose only reducer-relevant content is its next CombatState. */
function resolutionToState(next: CombatState): TurnResolution {
  return { state: next } as TurnResolution;
}

describe('initCombatState', () => {
  it('builds a fresh idle encounter at full HP with a telegraph', () => {
    const s = fresh();
    expect(s.phase).toBe('idle');
    expect(s.enemyId).toBe('slime');
    expect(s.drag).toBeNull();
    expect(s.display).toEqual(s.combat.board);
    expect(s.combat.playerHp).toBe(s.combat.playerMaxHp);
    expect(s.combat.enemyHp).toBe(s.combat.enemyMaxHp);
    expect(s.combat.telegraph).toEqual({ type: 'attack', value: 6 }); // Slime script
    expect(s.combat.status).toBe('ongoing');
    expect(s.lastResolution).toBeNull();
    expect(s.timer.status).toBe('idle');
  });
});

describe('drag phases (mirror the naked board)', () => {
  it('pickUp: idle -> dragging and bumps the drag nonce', () => {
    const s = fresh();
    const next = combatReducer(s, { type: 'pickUp', cell: { col: 2, row: 2 } });
    expect(next.phase).toBe('dragging');
    expect(next.drag).toEqual({ start: { col: 2, row: 2 }, steps: [] });
    expect(next.dragNonce).toBe(s.dragNonce + 1);
  });

  it('pickUp is ignored when not idle', () => {
    const s = combatReducer(fresh(), { type: 'pickUp', cell: { col: 2, row: 2 } });
    const again = combatReducer(s, { type: 'pickUp', cell: { col: 0, row: 0 } });
    expect(again.drag).toEqual(s.drag);
  });

  it('commit: appends a step, mirrors the board, starts the timer once', () => {
    let s = combatReducer(fresh(), { type: 'pickUp', cell: { col: 2, row: 2 } });
    s = combatReducer(s, { type: 'commit', dir: 'up' });
    expect(s.drag?.steps).toEqual(['up']);
    expect(s.timer.status).toBe('running');
    expect(s.display).not.toEqual(s.combat.board);
    const runningTimer = s.timer;
    s = combatReducer(s, { type: 'commit', dir: 'right' });
    expect(s.timer).toBe(runningTimer); // not restarted on later steps
  });

  it('commit ignores an off-grid step', () => {
    let s = combatReducer(fresh(), { type: 'pickUp', cell: { col: 0, row: 0 } });
    s = combatReducer(s, { type: 'commit', dir: 'up' }); // off the top edge
    expect(s.drag?.steps).toEqual([]);
    expect(s.timer.status).toBe('idle');
  });

  it('cancelDrag returns to idle on the base board', () => {
    let s = combatReducer(fresh(), { type: 'pickUp', cell: { col: 2, row: 2 } });
    s = combatReducer(s, { type: 'cancelDrag' });
    expect(s.phase).toBe('idle');
    expect(s.drag).toBeNull();
    expect(s.display).toEqual(s.combat.board);
  });
});

describe('turn resolution phases', () => {
  it('beginResolve requires a non-empty drag, locks input, and stops the timer', () => {
    let s = combatReducer(fresh(), { type: 'pickUp', cell: { col: 2, row: 2 } });
    expect(combatReducer(s, { type: 'beginResolve' }).phase).toBe('dragging'); // no steps yet
    s = combatReducer(s, { type: 'commit', dir: 'up' });
    s = combatReducer(s, { type: 'beginResolve' });
    expect(s.phase).toBe('resolving');
    expect(s.timer.status).toBe('idle');
  });

  it('boardResolved: resolving -> enemyActing, shows the settled board, stores the resolution', () => {
    const base = fresh();
    const resolution = firstValidTurn(base.combat);
    let s = combatReducer(base, { type: 'pickUp', cell: { col: 2, row: 2 } });
    s = combatReducer(s, { type: 'commit', dir: 'up' });
    s = combatReducer(s, { type: 'beginResolve' });
    s = combatReducer(s, { type: 'boardResolved', resolution });
    expect(s.phase).toBe('enemyActing');
    expect(s.display).toEqual(resolution.state.board);
    expect(s.lastResolution).toBe(resolution);
    // combat has NOT advanced yet (HP animates from the resolution during this beat).
    expect(s.combat).toBe(base.combat);
  });

  it('boardResolved is a no-op outside resolving', () => {
    const base = fresh();
    const resolution = firstValidTurn(base.combat);
    expect(combatReducer(base, { type: 'boardResolved', resolution }).phase).toBe('idle');
  });

  it('turnSettled (ongoing): enemyActing -> idle and commits the engine next state', () => {
    const base = fresh();
    const resolution = firstValidTurn(base.combat);
    let s = combatReducer(base, { type: 'pickUp', cell: { col: 2, row: 2 } });
    s = combatReducer(s, { type: 'commit', dir: 'up' });
    s = combatReducer(s, { type: 'beginResolve' });
    s = combatReducer(s, { type: 'boardResolved', resolution });
    s = combatReducer(s, { type: 'turnSettled' });
    expect(s.phase).toBe('idle');
    expect(s.combat).toBe(resolution.state);
    expect(s.display).toEqual(resolution.state.board);
    expect(s.drag).toBeNull();
  });
});

describe('terminal states', () => {
  function reachEnemyActing(next: CombatState): CombatScreenState {
    let s = combatReducer(fresh(), { type: 'pickUp', cell: { col: 2, row: 2 } });
    s = combatReducer(s, { type: 'commit', dir: 'up' });
    s = combatReducer(s, { type: 'beginResolve' });
    return combatReducer(s, { type: 'boardResolved', resolution: resolutionToState(next) });
  }

  it('turnSettled -> won when the engine reports a win', () => {
    const won: CombatState = { ...fresh().combat, status: 'won', enemyHp: 0 };
    const s = combatReducer(reachEnemyActing(won), { type: 'turnSettled' });
    expect(s.phase).toBe('won');
    expect(isEncounterOver(s)).toBe(true);
  });

  it('turnSettled -> lost when the engine reports a loss', () => {
    const lost: CombatState = { ...fresh().combat, status: 'lost', playerHp: 0 };
    const s = combatReducer(reachEnemyActing(lost), { type: 'turnSettled' });
    expect(s.phase).toBe('lost');
    expect(isEncounterOver(s)).toBe(true);
  });

  it('a won encounter locks input (pickUp is a no-op)', () => {
    const won: CombatState = { ...fresh().combat, status: 'won', enemyHp: 0 };
    const terminal = combatReducer(reachEnemyActing(won), { type: 'turnSettled' });
    const after = combatReducer(terminal, { type: 'pickUp', cell: { col: 1, row: 1 } });
    expect(after).toBe(terminal);
  });

  it('restart rebuilds a fresh idle encounter with the new seed', () => {
    const won: CombatState = { ...fresh().combat, status: 'won', enemyHp: 0 };
    const terminal = combatReducer(reachEnemyActing(won), { type: 'turnSettled' });
    const restarted = combatReducer(terminal, { type: 'restart', seed: 99 });
    expect(restarted.phase).toBe('idle');
    expect(restarted.seed).toBe(99);
    expect(restarted.combat.status).toBe('ongoing');
    expect(restarted.combat.enemyHp).toBe(restarted.combat.enemyMaxHp);
  });
});
