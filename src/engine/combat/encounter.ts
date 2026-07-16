/**
 * The encounter state machine — the pure heart of combat.
 *
 * `startEncounter` builds a fresh fight (board + full HP + first telegraph);
 * `playTurn` resolves ONE player move into a fully-animatable `TurnResolution` and
 * the next state. Turn-order contract (feature-combat-resolution.md):
 *
 *   1. board `resolveMove` runs first (all cascades),
 *   2. combat effects apply as ONE batch (damage to enemy, heal to player, capped),
 *   3. WIN check — enemy HP ≤ 0 ⇒ won, and a dead enemy NEVER acts,
 *   4. otherwise the enemy fires its telegraphed intent exactly as shown,
 *   5. LOSE check — player HP ≤ 0 ⇒ lost,
 *   6. the next intent is telegraphed.
 *
 * Terminal (won/lost) states reject further moves. Everything is pure and seeded:
 * a whole fight is a deterministic function of (enemyId, seed, path sequence). No
 * React/RN imports, no Math.random/Date.now — refill randomness is the board
 * engine's seeded stream, threaded move-to-move.
 */
import { createBoard, createRng, nextFloat, resolveMove, uniformTileSource } from '../board';
import type { ClearedGroup, Path, TileSource } from '../board';
import { computeEffects } from './effects';
import { getEnemy, nextIntentIndex, scriptStep } from './enemies';
import { DEFAULT_COMBAT_CONFIG } from './config';
import type { CombatConfig } from './config';
import type { CombatModifiers } from './modifiers';
import type { CombatState, Enemy, EnemyAction, EnemyId, TurnResolution } from './types';

/** 2^32 — recover a full uint32 seed from a [0,1) float draw. */
const UINT32 = 0x100000000;

/**
 * Split an encounter seed into two INDEPENDENT uint32 seeds: one for board creation,
 * one for the move-refill stream. The board engine documents that refills must be
 * threaded from a stream independent of board creation (create.ts) — using the raw
 * seed for both would correlate the first refill tiles with the initial board. Two
 * consecutive mulberry32 draws give well-separated streams. Pure; board primitives
 * only (no dependency on the sim layer).
 */
function deriveStreams(seed: number): { boardSeed: number; moveSeed: number } {
  const draw1 = nextFloat(createRng(seed));
  const draw2 = nextFloat(draw1.state);
  return {
    boardSeed: (draw1.value * UINT32) >>> 0,
    moveSeed: (draw2.value * UINT32) >>> 0,
  };
}

/**
 * Begin an encounter: build a match-free board from the seed, both sides at full HP,
 * the enemy's first intent telegraphed. `source` defaults to the board engine's
 * uniform refill source (mirrors createBoard/resolveMove signatures); tests inject a
 * scripted source for hand-computable refills.
 */
export function startEncounter(
  enemyId: EnemyId,
  seed: number,
  source: TileSource = uniformTileSource,
  config: CombatConfig = DEFAULT_COMBAT_CONFIG,
): CombatState {
  const enemy = getEnemy(enemyId); // throws on unknown id (boundary validation)
  const { boardSeed, moveSeed } = deriveStreams(seed);
  const board = createBoard(boardSeed, source);

  return {
    enemyId,
    board,
    rngState: createRng(moveSeed),
    playerHp: config.playerMaxHp,
    playerMaxHp: config.playerMaxHp,
    enemyHp: enemy.maxHp,
    enemyMaxHp: enemy.maxHp,
    intentIndex: 0,
    telegraph: scriptStep(enemy, 0),
    status: 'ongoing',
    turn: 0,
  };
}

/** Flatten every cleared group across all cascade waves into one ordered list. */
function flattenGroups(waves: ReturnType<typeof resolveMove>['waves']): ClearedGroup[] {
  const groups: ClearedGroup[] = [];
  for (const wave of waves) {
    for (const g of wave.clearedGroups) {
      groups.push(g);
    }
  }
  return groups;
}

/**
 * Apply one enemy action to the current HP values, returning new HP for both sides.
 * The switch is the single extension point for future intent verbs (block, debuff):
 * add a `type` to `EnemyActionType` and one case here.
 */
function applyEnemyAction(
  action: EnemyAction,
  playerHp: number,
  enemyHp: number,
  enemyMaxHp: number,
): { playerHp: number; enemyHp: number } {
  // Exhaustive over EnemyActionType: adding a Stage-3 verb is a COMPILE error here
  // until its case is handled — stronger than a silent default fallthrough.
  switch (action.type) {
    case 'attack':
      return { playerHp: Math.max(0, playerHp - action.value), enemyHp };
    case 'heal':
      return { playerHp, enemyHp: Math.min(enemyMaxHp, enemyHp + action.value) };
    case 'charge':
      return { playerHp, enemyHp }; // a wind-up: no HP change this turn
  }
}

/**
 * Resolve one player move. Pure: never mutates `state`. Throws if the encounter is
 * already terminal, or if the path is invalid (propagated from `resolveMove`).
 *
 * `modifiers` is the OPTIONAL Stage-3 relic seam (see modifiers.ts). When omitted, this
 * is byte-identical to the Stage-2 engine (every existing call passes no modifiers). When
 * supplied it (a) threads relic damage/heal transforms into `computeEffects`, and (b)
 * reduces an incoming enemy ATTACK via `incomingAttack` before it is applied.
 */
export function playTurn(
  state: CombatState,
  path: Path,
  source: TileSource = uniformTileSource,
  config: CombatConfig = DEFAULT_COMBAT_CONFIG,
  modifiers?: CombatModifiers,
): TurnResolution {
  if (state.status !== 'ongoing') {
    throw new Error(`playTurn: encounter is already ${state.status}; no further moves`);
  }

  const enemy: Enemy = getEnemy(state.enemyId);

  // 1. Board resolves fully (all cascades). Path validation lives here.
  const move = resolveMove(state.board, path, state.rngState, source);

  // 2. Combat effects as one batch from the full resolution (relic seam threaded).
  const groups = flattenGroups(move.waves);
  const effects = computeEffects(groups, enemy.affinity, config, modifiers);

  // Apply the player's move: damage the enemy (floored), heal the player (capped).
  const enemyHpAfterMove = Math.max(0, state.enemyHp - effects.damage);
  const playerHpAfterMove = Math.min(state.playerMaxHp, state.playerHp + effects.heal);

  // 3. WIN check — a dead enemy never acts.
  if (enemyHpAfterMove <= 0) {
    const newState: CombatState = {
      ...state,
      board: move.finalBoard,
      rngState: move.rngState,
      playerHp: playerHpAfterMove,
      enemyHp: 0,
      status: 'won',
      turn: state.turn + 1,
    };
    return {
      move,
      groups: effects.groups,
      cascadeMultiplier: effects.cascadeMultiplier,
      damage: effects.damage,
      heal: effects.heal,
      enemyAction: null,
      playerHpBefore: state.playerHp,
      playerHpAfter: playerHpAfterMove,
      enemyHpBefore: state.enemyHp,
      enemyHpAfter: 0,
      telegraph: state.telegraph, // fight over; telegraph is moot
      status: 'won',
      state: newState,
    };
  }

  // 4. Enemy fires its telegraphed intent (exactly what was shown). The relic seam may
  // soften an incoming ATTACK before it lands (defensive relics); with no modifier the
  // action is the untouched telegraph, so the transcript is byte-identical to Stage 2.
  const enemyAction =
    modifiers?.incomingAttack && state.telegraph.type === 'attack'
      ? { type: 'attack' as const, value: Math.max(0, Math.round(modifiers.incomingAttack(state.telegraph.value))) }
      : state.telegraph;
  const applied = applyEnemyAction(enemyAction, playerHpAfterMove, enemyHpAfterMove, state.enemyMaxHp);

  // 5. LOSE check.
  const status = applied.playerHp <= 0 ? 'lost' : 'ongoing';

  // 6. Telegraph the next intent.
  const newIntentIndex = nextIntentIndex(enemy, state.intentIndex);
  const nextTelegraph = scriptStep(enemy, newIntentIndex);

  const newState: CombatState = {
    ...state,
    board: move.finalBoard,
    rngState: move.rngState,
    playerHp: applied.playerHp,
    enemyHp: applied.enemyHp,
    intentIndex: newIntentIndex,
    telegraph: nextTelegraph,
    status,
    turn: state.turn + 1,
  };

  return {
    move,
    groups: effects.groups,
    cascadeMultiplier: effects.cascadeMultiplier,
    damage: effects.damage,
    heal: effects.heal,
    enemyAction,
    playerHpBefore: state.playerHp,
    playerHpAfter: applied.playerHp,
    enemyHpBefore: state.enemyHp,
    enemyHpAfter: applied.enemyHp,
    telegraph: nextTelegraph,
    status,
    state: newState,
  };
}
