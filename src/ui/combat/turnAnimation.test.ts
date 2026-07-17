import { playTurn, startEncounter } from '../../engine/combat';
import type { CombatState, EnemyId, TurnResolution } from '../../engine/combat';
import type { Direction } from '../../engine/board';
import { enemyActionMovesHp, enemyActSnapshot, playerMoveSnapshot, rotTickSnapshot } from './turnAnimation';

/**
 * Build a TurnResolution stub with only the HP-relevant fields the helpers read. `effectiveDamage`
 * / `effectiveHeal` default to the raw `damage` / `heal` (a channel-less fight), and `rotTick`
 * defaults to 0 — override them for the biome-channel cases.
 */
function resolution(fields: {
  enemyHpBefore: number;
  playerHpBefore: number;
  damage: number;
  heal: number;
  playerHpAfter: number;
  enemyHpAfter: number;
  playerMaxHp?: number;
  enemyAction?: TurnResolution['enemyAction'];
  effectiveDamage?: number;
  effectiveHeal?: number;
  rotTick?: number;
}): TurnResolution {
  return {
    enemyHpBefore: fields.enemyHpBefore,
    playerHpBefore: fields.playerHpBefore,
    damage: fields.damage,
    heal: fields.heal,
    effectiveDamage: fields.effectiveDamage ?? fields.damage,
    effectiveHeal: fields.effectiveHeal ?? fields.heal,
    shieldAbsorbed: 0,
    armorAbsorbed: 0,
    rotTick: fields.rotTick ?? 0,
    playerHpAfter: fields.playerHpAfter,
    enemyHpAfter: fields.enemyHpAfter,
    enemyAction: fields.enemyAction ?? { type: 'attack', value: 6 },
    state: { playerMaxHp: fields.playerMaxHp ?? 60 } as CombatState,
  } as TurnResolution;
}

describe('playerMoveSnapshot', () => {
  it('applies player damage to the enemy and heal to the player', () => {
    // enemy 30 - 12 damage = 18; player 40 + 5 heal = 45.
    const snap = playerMoveSnapshot(
      resolution({ enemyHpBefore: 30, playerHpBefore: 40, damage: 12, heal: 5, playerHpAfter: 39, enemyHpAfter: 18 }),
    );
    expect(snap).toEqual({ player: 45, enemy: 18 });
  });

  it('floors the enemy at 0 on an overkill move', () => {
    const snap = playerMoveSnapshot(
      resolution({ enemyHpBefore: 8, playerHpBefore: 60, damage: 20, heal: 0, playerHpAfter: 60, enemyHpAfter: 0 }),
    );
    expect(snap.enemy).toBe(0);
  });

  it('caps player heal at max HP', () => {
    const snap = playerMoveSnapshot(
      resolution({ enemyHpBefore: 30, playerHpBefore: 58, damage: 0, heal: 10, playerHpAfter: 60, enemyHpAfter: 30, playerMaxHp: 60 }),
    );
    expect(snap.player).toBe(60);
  });

  it('uses EFFECTIVE damage when a shield/armor absorbed part of the hit', () => {
    // Raw 20 rolled, but only 6 reached HP (14 absorbed): the enemy bar drops by 6, not 20.
    const snap = playerMoveSnapshot(
      resolution({ enemyHpBefore: 30, playerHpBefore: 40, damage: 20, effectiveDamage: 6, heal: 0, playerHpAfter: 34, enemyHpAfter: 24 }),
    );
    expect(snap.enemy).toBe(24); // 30 − 6, not 30 − 20
  });

  it('uses EFFECTIVE heal when a curse halved the heal', () => {
    // Raw 10 rolled, curse halves to 5: the player bar rises by 5.
    const snap = playerMoveSnapshot(
      resolution({ enemyHpBefore: 30, playerHpBefore: 40, damage: 0, heal: 10, effectiveHeal: 5, playerHpAfter: 45, enemyHpAfter: 30 }),
    );
    expect(snap.player).toBe(45); // 40 + 5, not 40 + 10
  });

  it('accounts for the turn-start rot tick before the move heal', () => {
    // rot ticks 3 (40 → 37), then heal 5 (→ 42).
    const snap = playerMoveSnapshot(
      resolution({ enemyHpBefore: 30, playerHpBefore: 40, damage: 0, heal: 5, rotTick: 3, playerHpAfter: 42, enemyHpAfter: 30 }),
    );
    expect(snap.player).toBe(42); // 40 − 3 + 5
  });
});

describe('rotTickSnapshot', () => {
  it('drops the player by the rot tick and leaves the enemy untouched', () => {
    const snap = rotTickSnapshot(
      resolution({ enemyHpBefore: 30, playerHpBefore: 40, damage: 0, heal: 0, rotTick: 3, playerHpAfter: 37, enemyHpAfter: 30 }),
    );
    expect(snap).toEqual({ player: 37, enemy: 30 });
  });

  it('floors the player at 0 on a lethal rot tick', () => {
    const snap = rotTickSnapshot(
      resolution({ enemyHpBefore: 30, playerHpBefore: 3, damage: 0, heal: 0, rotTick: 5, playerHpAfter: 0, enemyHpAfter: 30 }),
    );
    expect(snap.player).toBe(0);
  });
});

describe('enemyActSnapshot', () => {
  it('is the engine-authoritative turn-final HP', () => {
    const res = resolution({ enemyHpBefore: 30, playerHpBefore: 40, damage: 12, heal: 5, playerHpAfter: 39, enemyHpAfter: 18 });
    expect(enemyActSnapshot(res)).toEqual({ player: 39, enemy: 18 });
  });
});

describe('enemyActionMovesHp', () => {
  it('is true when the enemy attack changes player HP after the move checkpoint', () => {
    // mid: player 45, enemy 18. end: player 39 (attacked for 6). HP changed.
    const res = resolution({ enemyHpBefore: 30, playerHpBefore: 40, damage: 12, heal: 5, playerHpAfter: 39, enemyHpAfter: 18 });
    expect(enemyActionMovesHp(res)).toBe(true);
  });

  it('is false when the enemy died (null action)', () => {
    const res = resolution({ enemyHpBefore: 8, playerHpBefore: 60, damage: 20, heal: 0, playerHpAfter: 60, enemyHpAfter: 0, enemyAction: null });
    expect(enemyActionMovesHp(res)).toBe(false);
  });

  it('is false for a charge (no HP change from the move checkpoint)', () => {
    // charge: player HP after == player HP after own move; enemy unchanged too.
    const res = resolution({ enemyHpBefore: 30, playerHpBefore: 40, damage: 5, heal: 0, playerHpAfter: 40, enemyHpAfter: 25, enemyAction: { type: 'charge', value: 0 } });
    expect(enemyActionMovesHp(res)).toBe(false);
  });
});

// ── Real-engine integration: derive checkpoints from an actual scoring turn ──

/** Find a seed whose first single-step move actually clears a group, and play it. */
function firstScoringTurn(enemyId: EnemyId): TurnResolution {
  const dirs: Direction[] = ['up', 'down', 'left', 'right'];
  for (let seed = 1; seed <= 400; seed++) {
    const combat = startEncounter(enemyId, seed);
    for (let row = 0; row < combat.board.rows; row++) {
      for (let col = 0; col < combat.board.cols; col++) {
        for (const dir of dirs) {
          let res: TurnResolution;
          try {
            res = playTurn(combat, { start: { col, row }, steps: [dir] });
          } catch {
            continue; // off-grid step
          }
          if (res.move.totalCombos > 0) {
            return res;
          }
        }
      }
    }
  }
  throw new Error('no scoring single-step move found in 400 seeds');
}

describe('turnAnimation on real engine resolutions', () => {
  it('checkpoints match the engine totals for a real scoring turn vs the Slime', () => {
    const res = firstScoringTurn('slime');
    const mid = playerMoveSnapshot(res);
    const end = enemyActSnapshot(res);

    // The move actually did something.
    expect(res.damage + res.heal).toBeGreaterThan(0);
    // A default-biome fight has no channels, so effective === raw.
    expect(res.effectiveDamage).toBe(res.damage);
    expect(res.effectiveHeal).toBe(res.heal);
    // Mid enemy HP is the engine's before minus its own EFFECTIVE damage total (floored).
    expect(mid.enemy).toBe(Math.max(0, res.enemyHpBefore - res.effectiveDamage));
    // End is exactly the engine's turn-final HP.
    expect(end).toEqual({ player: res.playerHpAfter, enemy: res.enemyHpAfter });
    // HP never goes negative in a checkpoint.
    expect(mid.player).toBeGreaterThanOrEqual(0);
    expect(mid.enemy).toBeGreaterThanOrEqual(0);
  });
});
