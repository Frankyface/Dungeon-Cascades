/**
 * The encounter state machine — the pure heart of combat.
 *
 * `startEncounter` builds a fresh fight (board + full HP + first telegraph);
 * `playTurn` resolves ONE player move into a fully-animatable `TurnResolution` and
 * the next state. Turn-order contract (feature-combat-resolution.md + Stage-6 biome channels):
 *
 *   0. ROT tick (Rotwood) — player-turn-start DoT on its own channel, then decay 1,
 *   1. board `resolveMove` runs first (all cascades),
 *   2. combat effects apply as ONE batch (heal halved while cursed & capped; enemy damage
 *      passes through Emberworks armor then the Glacial shield — affinity applies BEFORE both),
 *   3. WIN check — enemy HP ≤ 0 ⇒ won, and a dead enemy NEVER acts,
 *   4. otherwise the enemy fires its telegraphed intent exactly as shown (may set a channel),
 *   5. LOSE check — player HP ≤ 0 ⇒ lost (rot can be lethal),
 *   6. the next intent is telegraphed.
 *
 * Every biome channel is OPTIONAL on CombatState; ABSENT ⇒ 0 ⇒ byte-identical to Stage 2,
 * so all default-biome / boss combat (and the combat sim) is provably unaffected.
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
  enemyDef?: Enemy,
): CombatState {
  // `enemyDef` is the OPTIONAL Stage-3 run-layer override (scaled / boss enemies). When
  // omitted this is byte-identical to the Stage-2 engine (registry lookup by id).
  const enemy = enemyDef ?? getEnemy(enemyId); // throws on unknown id (boundary validation)
  const { boardSeed, moveSeed } = deriveStreams(seed);
  const board = createBoard(boardSeed, source);

  return {
    enemyId,
    ...(enemyDef ? { enemy: enemyDef } : {}),
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
 * The mutable HP + biome-channel values threaded through one enemy action. Plain numbers
 * (no `undefined`): the `?? 0` reads happen once, at the playTurn boundary.
 */
interface TurnChannels {
  readonly playerHp: number;
  readonly enemyHp: number;
  readonly enemyShield: number;
  readonly enemyArmor: number;
  readonly rotStacks: number;
  readonly curseTurns: number;
}

/**
 * Apply one enemy action to the post-player-move channel values, returning the new values.
 * The switch is EXHAUSTIVE over `EnemyActionType`: adding a verb is a COMPILE error here until
 * its case is handled — stronger than a silent default fallthrough. Each Stage-6 verb touches
 * exactly one channel (content-biomes.md); `curse` deals 0 direct damage.
 */
function applyEnemyAction(action: EnemyAction, c: TurnChannels, enemyMaxHp: number): TurnChannels {
  switch (action.type) {
    case 'attack':
      return { ...c, playerHp: Math.max(0, c.playerHp - action.value) };
    case 'heal':
      return { ...c, enemyHp: Math.min(enemyMaxHp, c.enemyHp + action.value) };
    case 'charge':
      return c; // a wind-up: no change this turn
    case 'frostArmor':
      // Glacial Crypt: raise the persistent shield to at least `value` (never regenerates
      // passively — only this verb re-raises it, and only absorption depletes it).
      return { ...c, enemyShield: Math.max(c.enemyShield, action.value) };
    case 'armor':
      // Emberworks: plate for one hit — the dampener lands on the player's NEXT strike.
      return { ...c, enemyArmor: action.value };
    case 'spore':
      // Rotwood: seed rot on the player (stacks with any carried rot).
      return { ...c, rotStacks: c.rotStacks + action.value };
    case 'curse':
      // Sunken Catacombs: 0 direct damage — set the heal-halving timer on the player.
      return { ...c, curseTurns: action.value };
  }
}

/**
 * Build the biome-channel patch for the next `CombatState`. A channel field is included ONLY
 * when its next value is non-zero OR the field was already present — so a default-biome fight
 * (which never activates a channel) gains NO field and stays byte-identical, while a biome
 * fight that depletes a channel to 0 explicitly overwrites the stale spread with 0.
 */
function channelPatch(
  prev: CombatState,
  enemyShield: number,
  enemyArmor: number,
  rotStacks: number,
  curseTurns: number,
): Partial<Pick<CombatState, 'enemyShield' | 'enemyArmor' | 'rotStacks' | 'curseTurns'>> {
  const patch: {
    enemyShield?: number;
    enemyArmor?: number;
    rotStacks?: number;
    curseTurns?: number;
  } = {};
  if (enemyShield > 0 || prev.enemyShield !== undefined) patch.enemyShield = enemyShield;
  if (enemyArmor > 0 || prev.enemyArmor !== undefined) patch.enemyArmor = enemyArmor;
  if (rotStacks > 0 || prev.rotStacks !== undefined) patch.rotStacks = rotStacks;
  if (curseTurns > 0 || prev.curseTurns !== undefined) patch.curseTurns = curseTurns;
  return patch;
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

  // Run-layer enemy override (scaled / boss / biome) supersedes the registry when present;
  // absent ⇒ byte-identical Stage-2 behavior. `state.enemy` threads across turns via `{ ...state }`.
  const enemy: Enemy = state.enemy ?? getEnemy(state.enemyId);

  // Read the biome channels once (absent ⇒ 0 ⇒ byte-identical default-biome behavior).
  const shield0 = state.enemyShield ?? 0;
  const armor0 = state.enemyArmor ?? 0;
  const rot0 = state.rotStacks ?? 0;
  const curse0 = state.curseTurns ?? 0;

  // 0. ROT tick (Rotwood): player-turn-start DoT on its OWN channel — NOT reduced by the
  // defensive relic seam (it is applied here, never through `incomingAttack`). Then decay 1.
  // `rotTick` reports the rolled DoT (overkill retained, like `damage`).
  const rotTick = rot0;
  const playerHpAfterRot = Math.max(0, state.playerHp - rotTick);
  const rotAfterTick = Math.max(0, rot0 - 1);

  // 1. Board resolves fully (all cascades). Path validation lives here.
  const move = resolveMove(state.board, path, state.rngState, source);

  // 2. Combat effects as one batch from the full resolution (relic seam threaded).
  const groups = flattenGroups(move.waves);
  const effects = computeEffects(groups, enemy.affinity, config, modifiers);

  // Stage-6 cascade-wave relics (wave 1b seam): per-wave direct enemy damage + player heal,
  // summed over waves 2..N of THIS move. Absent modifier ⇒ 0 ⇒ byte-identical Stage-2 combat.
  const cascade = modifiers?.cascadeWave?.(move.waves.length);
  const cascadeEnemyDamage = cascade?.enemyDamage ?? 0;
  const cascadePlayerHeal = cascade?.playerHeal ?? 0;

  // Curse (Sunken Catacombs) halves the rolled move heal while active — read the INCOMING
  // curse (before the enemy may re-curse this turn). Rounded once (round-half-up). Cascade-wave
  // heal is a SEPARATE relic channel (not the P-group move heal), so curse does not halve it.
  const effectiveHeal = curse0 > 0 ? Math.round(effects.heal * 0.5) : effects.heal;
  const playerHpAfterMove = Math.min(state.playerMaxHp, playerHpAfterRot + effectiveHeal + cascadePlayerHeal);

  // Outgoing damage: affinity + cascade are ALREADY baked into `effects.damage`; mitigation
  // applies AFTER (so affinity comes BEFORE shield/armor). Order: Emberworks armor (one-shot
  // dampener) then Glacial shield (persistent absorb); the remainder carries through to HP.
  // Cascade-wave enemy damage is DIRECT, affinity-ignoring HP loss dealt alongside the move.
  const afterArmor = Math.max(0, effects.damage - armor0);
  const armorAfter = 0; // one-shot: cleared by the strike it dampened
  const shieldAbsorbed = Math.min(shield0, afterArmor);
  const shieldAfterMove = shield0 - shieldAbsorbed;
  const dmgToEnemy = afterArmor - shieldAbsorbed;
  const enemyHpAfterMove = Math.max(0, state.enemyHp - dmgToEnemy - cascadeEnemyDamage);

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
      ...channelPatch(state, shieldAfterMove, armorAfter, rotAfterTick, curse0),
    };
    return {
      move,
      groups: effects.groups,
      cascadeMultiplier: effects.cascadeMultiplier,
      damage: effects.damage,
      heal: effects.heal,
      enemyAction: null,
      rotTick,
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
  const applied = applyEnemyAction(
    enemyAction,
    {
      playerHp: playerHpAfterMove,
      enemyHp: enemyHpAfterMove,
      enemyShield: shieldAfterMove,
      enemyArmor: armorAfter,
      rotStacks: rotAfterTick,
      curseTurns: curse0,
    },
    state.enemyMaxHp,
  );

  // Curse timer: a curse APPLIED this turn starts its clock fresh (not decremented now, so
  // `curse N` halves heals for exactly N of the player's subsequent turns); otherwise decay 1.
  const curseFinal =
    enemyAction.type === 'curse' ? applied.curseTurns : Math.max(0, applied.curseTurns - 1);

  // 5. LOSE check (accounts for rot: the player HP already reflects this turn's rot tick).
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
    ...channelPatch(state, applied.enemyShield, applied.enemyArmor, applied.rotStacks, curseFinal),
  };

  return {
    move,
    groups: effects.groups,
    cascadeMultiplier: effects.cascadeMultiplier,
    damage: effects.damage,
    heal: effects.heal,
    enemyAction,
    rotTick,
    playerHpBefore: state.playerHp,
    playerHpAfter: applied.playerHp,
    enemyHpBefore: state.enemyHp,
    enemyHpAfter: applied.enemyHp,
    telegraph: nextTelegraph,
    status,
    state: newState,
  };
}
