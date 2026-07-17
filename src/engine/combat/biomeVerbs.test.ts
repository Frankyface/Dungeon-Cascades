/**
 * Hand-computed fixtures for the four Stage-6 biome verbs and their channels (content-biomes.md):
 *   - frostArmor → `enemyShield`  (Glacial Crypt): persistent absorb, affinity applies BEFORE it.
 *   - armor      → `enemyArmor`   (Emberworks):    one-shot dampener on the NEXT strike, then clears.
 *   - spore      → `rotStacks`    (Rotwood):       player DoT, ticks at turn-start, decays 1/turn.
 *   - curse      → `curseTurns`   (Sunken Catacombs): halves the player's move heals for N turns.
 *
 * Every expected number is derived by hand from the docs/decisions.md combat constants
 * (ATTACK_BASE 3, HEAL_BASE 2, GROUP_SIZE_BONUS 0.25, CASCADE_BONUS 0.25). Channels are OPTIONAL
 * on CombatState — a byte-identity guard here proves an ABSENT channel leaves a fight untouched.
 */
import { boardFromRows, createRng } from '../board';
import type { Path, RngState, TileColor, TileSource } from '../board';
import { AFFINITY_WEAK } from './config';
import { playTurn } from './encounter';
import type { CombatModifiers } from './modifiers';
import type { CombatState, Enemy } from './types';

/** Deterministic, hand-scriptable refill source (same convention as encounter.test.ts). */
function scriptedSource(colors: readonly TileColor[]): TileSource {
  return {
    next(state: RngState) {
      const index = state.a;
      const color = colors[index];
      if (color === undefined) throw new Error(`scriptedSource exhausted at draw ${index}`);
      return { color, state: { a: index + 1 } };
    },
  };
}

/** Build a CombatState around an `enemy` override, with any biome channel pre-set. */
function makeState(over: Partial<CombatState> & { enemy: Enemy }): CombatState {
  const enemy = over.enemy;
  const intentIndex = over.intentIndex ?? 0;
  return {
    enemyId: 'skeleton', // nominal; the `enemy` override supersedes it
    enemy,
    board: over.board ?? boardFromRows(['RGB', 'GBR', 'BRG']),
    rngState: over.rngState ?? createRng(0),
    playerHp: over.playerHp ?? 60,
    playerMaxHp: over.playerMaxHp ?? 60,
    enemyHp: over.enemyHp ?? enemy.maxHp,
    enemyMaxHp: over.enemyMaxHp ?? enemy.maxHp,
    intentIndex,
    telegraph: over.telegraph ?? enemy.script[intentIndex],
    status: over.status ?? 'ongoing',
    turn: over.turn ?? 0,
    ...(over.enemyShield !== undefined ? { enemyShield: over.enemyShield } : {}),
    ...(over.enemyArmor !== undefined ? { enemyArmor: over.enemyArmor } : {}),
    ...(over.rotStacks !== undefined ? { rotStacks: over.rotStacks } : {}),
    ...(over.curseTurns !== undefined ? { curseTurns: over.curseTurns } : {}),
  };
}

// Boards where picking up (col1,row0) and dragging LEFT makes col0 a vertical triple.
const BBB_BOARD = ['RBG', 'BRG', 'BGR']; // → col0 becomes B,B,B (Blue)
const PPP_BOARD = ['BPR', 'PBR', 'PRB']; // → col0 becomes P,P,P (heal)
const PPPP_BOARD = ['RPR', 'PBR', 'PRB', 'PGR']; // 4-row → col0 becomes P,P,P,P (heal, size 4)
const LEFT_PATH: Path = { start: { col: 1, row: 0 }, steps: ['left'] };
const SAFE_REFILL = scriptedSource(['Y', 'G', 'R', 'Y', 'G', 'R', 'Y', 'G']); // never re-matches

// A checkerboard where swapping (0,0)↔(1,0) forms NO match: player deals 0, no refill draw.
const CHECKER = boardFromRows(['RGR', 'GRG', 'RGR']);
const SWAP_RIGHT: Path = { start: { col: 0, row: 0 }, steps: ['right'] };
const SWAP_BACK: Path = { start: { col: 1, row: 0 }, steps: ['left'] };

/** A minimal enemy with a given affinity + script, isolating the channel under test. */
function enemy(over: Partial<Enemy> & Pick<Enemy, 'script'>): Enemy {
  return {
    id: 'permafrost-warden',
    maxHp: over.maxHp ?? 100,
    affinity: over.affinity ?? {},
    script: over.script,
    biome: over.biome ?? 'glacial-crypt',
  };
}

const CHARGE_ONLY: Enemy = enemy({ affinity: { B: AFFINITY_WEAK }, script: [{ type: 'charge', value: 0 }] });

describe('frostArmor / enemyShield (Glacial Crypt) — persistent absorb; affinity BEFORE shield', () => {
  it('shield absorbs post-affinity damage; a Blue 3-match rolls 6 (=3×2.0), shield eats it, 0 to HP', () => {
    const state = makeState({ enemy: CHARGE_ONLY, enemyHp: 100, enemyShield: 10, board: boardFromRows(BBB_BOARD) });
    const res = playTurn(state, LEFT_PATH, SAFE_REFILL);
    expect(res.damage).toBe(6); // affinity applied BEFORE the shield: the shield sees 6, not 3
    expect(res.enemyHpAfter).toBe(100); // fully absorbed
    expect(res.state.enemyShield).toBe(4); // 10 − 6
    expect(res.enemyAction).toEqual({ type: 'charge', value: 0 });
    expect(res.playerHpAfter).toBe(60);
  });

  it('overflow carries the remainder through to HP (shatter the barrier AND bite the body)', () => {
    const state = makeState({ enemy: CHARGE_ONLY, enemyHp: 100, enemyShield: 4, board: boardFromRows(BBB_BOARD) });
    const res = playTurn(state, LEFT_PATH, SAFE_REFILL);
    expect(res.damage).toBe(6); // rolled damage unchanged
    expect(res.enemyHpAfter).toBe(98); // 6 − 4 absorbed = 2 through to HP
    expect(res.state.enemyShield ?? 0).toBe(0); // shield shattered
  });

  it('the frostArmor verb raises the shield to `value` (via max) when the enemy acts', () => {
    const raiser = enemy({ script: [{ type: 'frostArmor', value: 14 }] });
    const res = playTurn(makeState({ enemy: raiser, board: CHECKER }), SWAP_RIGHT);
    expect(res.enemyAction).toEqual({ type: 'frostArmor', value: 14 });
    expect(res.state.enemyShield).toBe(14);
  });

  it('frostArmor never LOWERS an existing shield (max, not set)', () => {
    const raiser = enemy({ script: [{ type: 'frostArmor', value: 14 }] });
    const res = playTurn(makeState({ enemy: raiser, enemyShield: 20, board: CHECKER }), SWAP_RIGHT);
    expect(res.state.enemyShield).toBe(20); // max(20, 14)
  });

  it('never regenerates passively: a non-frostArmor turn leaves the shield untouched, and once broken it stays 0', () => {
    const held = playTurn(makeState({ enemy: CHARGE_ONLY, enemyShield: 5, board: CHECKER }), SWAP_RIGHT);
    expect(held.state.enemyShield).toBe(5); // no decay, no passive regen

    // Shatter a 3-shield with a 6 hit → 0, then next (charge) turn it does NOT come back.
    const broken = playTurn(makeState({ enemy: CHARGE_ONLY, enemyShield: 3, board: boardFromRows(BBB_BOARD) }), LEFT_PATH, SAFE_REFILL);
    expect(broken.state.enemyShield ?? 0).toBe(0);
    expect(broken.enemyHpAfter).toBe(97); // 6 − 3 = 3 through
  });
});

describe('armor / enemyArmor (Emberworks) — one-shot dampener on the NEXT strike, then clears', () => {
  it('dampens the move by `armor` (post-affinity), then clears; a 6 hit vs armor 5 lands 1', () => {
    const brute = enemy({ affinity: { B: AFFINITY_WEAK }, biome: 'emberworks', script: [{ type: 'charge', value: 0 }] });
    const res = playTurn(makeState({ enemy: brute, enemyHp: 100, enemyArmor: 5, board: boardFromRows(BBB_BOARD) }), LEFT_PATH, SAFE_REFILL);
    expect(res.damage).toBe(6); // rolled damage unchanged
    expect(res.enemyHpAfter).toBe(99); // max(0, 6 − 5) = 1 to HP
    expect(res.state.enemyArmor ?? 0).toBe(0); // cleared after the strike it dampened
  });

  it('clears after one strike: with no armor the same hit lands full', () => {
    const brute = enemy({ affinity: { B: AFFINITY_WEAK }, biome: 'emberworks', script: [{ type: 'charge', value: 0 }] });
    const res = playTurn(makeState({ enemy: brute, enemyHp: 100, board: boardFromRows(BBB_BOARD) }), LEFT_PATH, SAFE_REFILL);
    expect(res.enemyHpAfter).toBe(94); // full 6
  });

  it('dampening floors at 0 (huge armor fully blocks the strike, then still clears)', () => {
    const brute = enemy({ affinity: { B: AFFINITY_WEAK }, biome: 'emberworks', script: [{ type: 'charge', value: 0 }] });
    const res = playTurn(makeState({ enemy: brute, enemyHp: 100, enemyArmor: 100, board: boardFromRows(BBB_BOARD) }), LEFT_PATH, SAFE_REFILL);
    expect(res.enemyHpAfter).toBe(100); // max(0, 6 − 100) = 0
    expect(res.state.enemyArmor ?? 0).toBe(0);
  });

  it('the armor verb sets enemyArmor when the enemy plates itself', () => {
    const plater = enemy({ biome: 'emberworks', script: [{ type: 'armor', value: 12 }] });
    const res = playTurn(makeState({ enemy: plater, board: CHECKER }), SWAP_RIGHT);
    expect(res.enemyAction).toEqual({ type: 'armor', value: 12 });
    expect(res.state.enemyArmor).toBe(12);
  });

  it('documented order when both channels are present: armor dampens first, then the shield absorbs', () => {
    const both = enemy({ affinity: { B: AFFINITY_WEAK }, script: [{ type: 'charge', value: 0 }] });
    const res = playTurn(makeState({ enemy: both, enemyHp: 100, enemyArmor: 2, enemyShield: 10, board: boardFromRows(BBB_BOARD) }), LEFT_PATH, SAFE_REFILL);
    // 6 rolled → armor 2 → 4 → shield absorbs 4 → 0 to HP; shield 10 − 4 = 6; armor cleared.
    expect(res.enemyHpAfter).toBe(100);
    expect(res.state.enemyArmor ?? 0).toBe(0);
    expect(res.state.enemyShield).toBe(6);
  });
});

describe('spore / rotStacks (Rotwood) — player DoT: ticks at turn-start, decays 1/turn', () => {
  const rotEnemy = enemy({ biome: 'rotwood', script: [{ type: 'charge', value: 0 }] });

  it('ticks the current stacks at the players turn-start, reports rotTick, then decays 1', () => {
    const res = playTurn(makeState({ enemy: rotEnemy, playerHp: 60, rotStacks: 3, board: CHECKER }), SWAP_RIGHT);
    expect(res.rotTick).toBe(3);
    expect(res.playerHpAfter).toBe(57); // 60 − 3
    expect(res.state.rotStacks).toBe(2); // decayed by 1
  });

  it('a spore of 3 deals 3+2+1 = 6 over three turns, then clears (content-biomes.md)', () => {
    let state = makeState({ enemy: rotEnemy, playerHp: 60, rotStacks: 3, board: CHECKER });
    const ticks: number[] = [];
    for (let t = 0; t < 4; t++) {
      const res = playTurn(state, t % 2 === 0 ? SWAP_RIGHT : SWAP_BACK);
      ticks.push(res.rotTick);
      state = res.state;
    }
    expect(ticks).toEqual([3, 2, 1, 0]); // decay chain, then clear
    expect(state.playerHp).toBe(54); // 60 − (3+2+1) = 54
  });

  it('the spore verb ADDS stacks (stacking with carried rot is the intended pressure)', () => {
    const seeder = enemy({ biome: 'rotwood', script: [{ type: 'spore', value: 3 }] });
    const fresh = playTurn(makeState({ enemy: seeder, playerHp: 60, board: CHECKER }), SWAP_RIGHT);
    expect(fresh.enemyAction).toEqual({ type: 'spore', value: 3 });
    expect(fresh.state.rotStacks).toBe(3); // 0 (nothing to tick) + 3
    expect(fresh.playerHpAfter).toBe(60); // spore deals no direct damage

    // Carried rot 2 ticks (→1) THEN the enemy adds 3 → 4.
    const stacked = playTurn(makeState({ enemy: seeder, playerHp: 60, rotStacks: 2, board: CHECKER }), SWAP_RIGHT);
    expect(stacked.rotTick).toBe(2);
    expect(stacked.playerHpAfter).toBe(58);
    expect(stacked.state.rotStacks).toBe(4); // (2 → 1) + 3
  });

  it('rot CAN be lethal: rot ticking the player to 0 ends the fight lost ("carried rot can finish you")', () => {
    const res = playTurn(makeState({ enemy: rotEnemy, enemyHp: 100, playerHp: 3, rotStacks: 5, board: CHECKER }), SWAP_RIGHT);
    expect(res.rotTick).toBe(5); // rolled DoT (overkill retained)
    expect(res.playerHpAfter).toBe(0);
    expect(res.status).toBe('lost');
    expect(res.state.status).toBe('lost');
  });

  it('rot is dealt on its own channel — NOT reduced by the defensive-relic seam', () => {
    const mods: CombatModifiers = { incomingAttack: (v) => Math.max(0, v - 100) };
    const res = playTurn(makeState({ enemy: rotEnemy, playerHp: 60, rotStacks: 5, board: CHECKER }), SWAP_RIGHT, undefined, undefined, mods);
    expect(res.playerHpAfter).toBe(55); // full 5 rot despite a −100 incomingAttack modifier present
  });
});

describe('curse / curseTurns (Sunken Catacombs) — halves player heals for N turns', () => {
  const curseEnemy = enemy({ biome: 'sunken-catacombs', script: [{ type: 'charge', value: 0 }] });

  it('halves the rolled move heal while active (round-half-up); a 2-heal applies 1', () => {
    const res = playTurn(makeState({ enemy: curseEnemy, playerHp: 50, curseTurns: 2, board: boardFromRows(PPP_BOARD) }), LEFT_PATH, SAFE_REFILL);
    expect(res.heal).toBe(2); // rolled heal reported (pre-halving)
    expect(res.playerHpAfter).toBe(51); // 50 + round(2 × 0.5) = 50 + 1
    expect(res.state.curseTurns).toBe(1); // decays by 1 at end of turn
  });

  it('round-half-up on the halving: a 3-heal (4-tile P) applies 2', () => {
    const res = playTurn(makeState({ enemy: curseEnemy, playerHp: 40, curseTurns: 2, board: boardFromRows(PPPP_BOARD) }), LEFT_PATH, SAFE_REFILL);
    expect(res.heal).toBe(3); // 2 × sizeBonus(4)=1.25 → 2.5 → round 3
    expect(res.playerHpAfter).toBe(42); // 40 + round(3 × 0.5) = 40 + 2
  });

  it('uncursed heals are full', () => {
    const res = playTurn(makeState({ enemy: curseEnemy, playerHp: 50, board: boardFromRows(PPP_BOARD) }), LEFT_PATH, SAFE_REFILL);
    expect(res.heal).toBe(2);
    expect(res.playerHpAfter).toBe(52); // full 2
  });

  it('the curse verb sets the timer and deals 0 direct damage; a fresh curse is NOT decremented the same turn', () => {
    // A curse→charge loop so the turn AFTER the curse is a non-curse turn (which decrements).
    const curser = enemy({ biome: 'sunken-catacombs', script: [{ type: 'curse', value: 2 }, { type: 'charge', value: 0 }] });
    const res = playTurn(makeState({ enemy: curser, playerHp: 60, board: CHECKER }), SWAP_RIGHT);
    expect(res.enemyAction).toEqual({ type: 'curse', value: 2 });
    expect(res.playerHpAfter).toBe(60); // curse forgoes its attack (0 direct damage)
    expect(res.state.curseTurns).toBe(2); // fresh set — NOT decremented this turn

    // The very next (non-curse, charge) turn decrements → 1: so `curse 2` covers exactly 2 of the player's turns.
    const next = playTurn(res.state, SWAP_BACK);
    expect(next.state.curseTurns).toBe(1);
  });

  it('decrements to 0 and expires (curse 1 → halved this turn, then gone)', () => {
    const res = playTurn(makeState({ enemy: curseEnemy, playerHp: 50, curseTurns: 1, board: boardFromRows(PPP_BOARD) }), LEFT_PATH, SAFE_REFILL);
    expect(res.playerHpAfter).toBe(51); // still halved this turn (curse was active at heal time)
    expect(res.state.curseTurns ?? 0).toBe(0); // now expired
  });
});

describe('byte-identity guard — an ABSENT channel leaves a default-biome fight untouched', () => {
  it('a plain fight adds NO channel fields and reports rotTick 0', () => {
    const plain = enemy({ affinity: { B: AFFINITY_WEAK }, biome: 'glacial-crypt', script: [{ type: 'attack', value: 7 }] });
    const res = playTurn(makeState({ enemy: plain, enemyHp: 100, board: boardFromRows(BBB_BOARD) }), LEFT_PATH, SAFE_REFILL);
    expect(res.rotTick).toBe(0);
    expect(res.enemyHpAfter).toBe(94); // full 6 to HP (no shield/armor)
    expect(res.playerHpAfter).toBe(53); // 60 − 7
    expect('enemyShield' in res.state).toBe(false);
    expect('enemyArmor' in res.state).toBe(false);
    expect('rotStacks' in res.state).toBe(false);
    expect('curseTurns' in res.state).toBe(false);
  });
});
