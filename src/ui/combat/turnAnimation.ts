/**
 * Pure derivation of the HP "checkpoints" a turn animates through, so the combat
 * screen can step the HP bars in two readable beats — the player's move landing,
 * then the enemy's telegraphed action — without re-implementing any combat rules.
 *
 * The engine's `TurnResolution` only carries the turn's before/after HP for both
 * sides. The intermediate checkpoint (enemy damaged + player healed, BEFORE the
 * enemy acts) is a pure function of those same numbers, computed here once and
 * unit-tested against hand-computed and real-engine fixtures. NO React imports.
 */
import type { TurnResolution } from '../../engine/combat';

/** A pair of HP values to show at one animation checkpoint. */
export interface HpSnapshot {
  readonly player: number;
  readonly enemy: number;
}

/**
 * HP after the PLAYER's move resolves but BEFORE the enemy acts:
 * - enemy took `resolution.damage` (floored at 0),
 * - player gained `resolution.heal` (capped at max HP).
 * Derived from the engine's own totals; matches `encounter.playTurn`'s batch apply.
 */
export function playerMoveSnapshot(resolution: TurnResolution): HpSnapshot {
  const enemy = Math.max(0, resolution.enemyHpBefore - resolution.damage);
  const playerMax = resolution.state.playerMaxHp;
  const player = Math.min(playerMax, resolution.playerHpBefore + resolution.heal);
  return { player, enemy };
}

/** HP after the enemy has acted — the turn's final state (engine authoritative). */
export function enemyActSnapshot(resolution: TurnResolution): HpSnapshot {
  return { player: resolution.playerHpAfter, enemy: resolution.enemyHpAfter };
}

/**
 * Does the enemy's action visibly change HP this turn? A `charge` (or a null action
 * when the enemy died) leaves both bars unchanged from the player-move checkpoint,
 * so the screen can skip a redundant beat and settle immediately.
 */
export function enemyActionMovesHp(resolution: TurnResolution): boolean {
  const action = resolution.enemyAction;
  if (action === null) {
    return false;
  }
  const mid = playerMoveSnapshot(resolution);
  const end = enemyActSnapshot(resolution);
  return mid.player !== end.player || mid.enemy !== end.enemy;
}
