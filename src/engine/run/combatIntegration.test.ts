/**
 * Relic ↔ combat integration fixtures. The headline gate: the SAME encounter seed with vs
 * without a damage relic yields a transcript that differs by EXACTLY the modified damage
 * (everything else identical). Plus: defensive incoming-damage reduction through playTurn,
 * the combat-start / turn-start wrappers, and a guard that the seam is byte-identical when
 * no relic touches it (protecting the Stage-2 combat baseline).
 */
import { boardFromRows, createRng } from '../board';
import type { Path, RngState, TileColor, TileSource } from '../board';
import { DEFAULT_COMBAT_CONFIG, computeEffects, getEnemy, playTurn, startEncounter } from '../combat';
import type { CombatState, EnemyId } from '../combat';
import { buildCombatModifiers, playTurnWithRelics, startEncounterWithRelics } from './relicHooks';

/** Hand-scriptable refill (same convention as combat/encounter.test.ts). */
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

function makeState(over: Partial<CombatState> & { enemyId: EnemyId }): CombatState {
  const enemy = getEnemy(over.enemyId);
  return {
    enemyId: over.enemyId,
    board: over.board ?? boardFromRows(['RGB', 'GBR', 'BRG']),
    rngState: over.rngState ?? createRng(0),
    playerHp: over.playerHp ?? 60,
    playerMaxHp: over.playerMaxHp ?? 60,
    enemyHp: over.enemyHp ?? enemy.maxHp,
    enemyMaxHp: over.enemyMaxHp ?? enemy.maxHp,
    intentIndex: over.intentIndex ?? 0,
    telegraph: over.telegraph ?? enemy.script[0],
    status: over.status ?? 'ongoing',
    turn: over.turn ?? 0,
  };
}

// Board where picking up (col1,row0) and dragging LEFT makes col0 a vertical triple.
const RRR_BOARD = ['BRG', 'RBG', 'RGB']; // → col0 R,R,R (slime is WEAK to R: ×2.0)
const GGG_BOARD = ['BGR', 'GBR', 'GRB']; // → col0 G,G,G (normal)
const LEFT_PATH: Path = { start: { col: 1, row: 0 }, steps: ['left'] };
const SAFE_REFILL = scriptedSource(['Y', 'B', 'Y', 'G', 'B', 'Y']); // never re-matches col0

describe('damage relic changes the transcript by EXACTLY the modifier (headline gate)', () => {
  it('Emberfang (+50% Red) turns a 6-damage red hit into 9, nothing else changed', () => {
    const base = () =>
      makeState({ enemyId: 'slime', enemyHp: 100, enemyMaxHp: 100, rngState: createRng(0), board: boardFromRows(RRR_BOARD) });

    const without = playTurn(base(), LEFT_PATH, SAFE_REFILL);
    const withRelic = playTurn(base(), LEFT_PATH, SAFE_REFILL, DEFAULT_COMBAT_CONFIG, buildCombatModifiers(['emberfang']));

    expect(without.damage).toBe(6); // 3 × 2.0 (weak) × cascade 1
    expect(withRelic.damage).toBe(9); // (6) × 1.5
    expect(withRelic.damage - without.damage).toBe(3); // exactly the +50%

    // Enemy HP delta reflects the extra damage; everything else is identical.
    expect(without.enemyHpAfter).toBe(94);
    expect(withRelic.enemyHpAfter).toBe(91);
    expect(withRelic.enemyAction).toEqual(without.enemyAction);
    expect(withRelic.playerHpAfter).toBe(without.playerHpAfter);
    expect(withRelic.telegraph).toEqual(without.telegraph);
  });
});

describe('heal relic scales a heal group through playTurn', () => {
  it('Chalice of Rowan (×1.5 heal) turns a 2-heal into 3; outgoing damage unchanged', () => {
    // PPP board → col0 becomes a P (heal) triple on LEFT_PATH.
    const PPP_BOARD = ['BPR', 'PBR', 'PRB'];
    const healRefill = scriptedSource(['Y', 'G', 'Y', 'B', 'G', 'Y']);
    const base = () =>
      makeState({ enemyId: 'slime', enemyHp: 100, enemyMaxHp: 100, playerHp: 50, rngState: createRng(0), board: boardFromRows(PPP_BOARD) });

    const without = playTurn(base(), LEFT_PATH, healRefill);
    const withRelic = playTurn(base(), LEFT_PATH, healRefill, DEFAULT_COMBAT_CONFIG, buildCombatModifiers(['rowan-chalice']));

    expect(without.heal).toBe(2); // 2 × cascade 1
    expect(withRelic.heal).toBe(3); // 2 × 1.5
    expect(withRelic.damage).toBe(without.damage); // no outgoing change
  });
});

describe('defensive relic reduces incoming damage through playTurn', () => {
  it('Bulwark Rune (−2) softens the enemy attack; outgoing damage unchanged', () => {
    const base = () =>
      makeState({ enemyId: 'slime', enemyHp: 30, enemyMaxHp: 80, playerHp: 60, rngState: createRng(0), board: boardFromRows(GGG_BOARD) });

    const without = playTurn(base(), LEFT_PATH, SAFE_REFILL);
    const withRelic = playTurn(base(), LEFT_PATH, SAFE_REFILL, DEFAULT_COMBAT_CONFIG, buildCombatModifiers(['bulwark-rune']));

    expect(without.damage).toBe(3);
    expect(withRelic.damage).toBe(3); // no outgoing change
    expect(without.enemyAction).toEqual({ type: 'attack', value: 8 });
    expect(withRelic.enemyAction).toEqual({ type: 'attack', value: 6 }); // 8 − 2
    expect(without.playerHpAfter).toBe(52); // 60 − 8
    expect(withRelic.playerHpAfter).toBe(54); // 60 − 6
  });
});

describe('no-modifier byte-identity guard (protects the Stage-2 baseline)', () => {
  it('computeEffects is identical with undefined / empty modifiers', () => {
    const groups = [
      { color: 'R' as TileColor, positions: [{ col: 0, row: 0 }, { col: 0, row: 1 }, { col: 0, row: 2 }] },
      { color: 'P' as TileColor, positions: [{ col: 1, row: 0 }, { col: 1, row: 1 }, { col: 1, row: 2 }] },
    ];
    const a = computeEffects(groups, { R: 2.0 }, DEFAULT_COMBAT_CONFIG);
    const b = computeEffects(groups, { R: 2.0 }, DEFAULT_COMBAT_CONFIG, undefined);
    const c = computeEffects(groups, { R: 2.0 }, DEFAULT_COMBAT_CONFIG, {});
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(JSON.stringify(c)).toBe(JSON.stringify(a));
  });

  it('playTurn with empty relics (buildCombatModifiers([])) equals a plain playTurn', () => {
    const s = () => makeState({ enemyId: 'slime', enemyHp: 100, enemyMaxHp: 100, rngState: createRng(0), board: boardFromRows(RRR_BOARD) });
    const plain = playTurn(s(), LEFT_PATH, SAFE_REFILL);
    const emptyMods = playTurn(s(), LEFT_PATH, SAFE_REFILL, DEFAULT_COMBAT_CONFIG, buildCombatModifiers([]));
    expect(JSON.stringify(emptyMods)).toBe(JSON.stringify(plain));
  });
});

describe('startEncounterWithRelics — combat-start effects', () => {
  it('with no relics equals a plain start', () => {
    const plain = startEncounter('slime', 2026);
    const wrapped = startEncounterWithRelics('slime', 2026, []);
    expect(wrapped.enemyHp).toBe(plain.enemyHp);
    expect(wrapped.playerHp).toBe(plain.playerHp);
    expect(wrapped.board).toEqual(plain.board);
    expect(wrapped.telegraph).toEqual(plain.telegraph);
  });

  it("Ambusher's Cowl chips the enemy by 10 up front", () => {
    const s = startEncounterWithRelics('slime', 2026, ['ambushers-cowl']);
    expect(s.enemyMaxHp).toBe(80);
    expect(s.enemyHp).toBe(70); // 80 − 10
    expect(s.playerHp).toBe(60);
  });

  it('Phoenix Feather heals the carried-over HP at start (capped at max)', () => {
    const low = startEncounterWithRelics('slime', 2026, ['phoenix-feather'], { startingPlayerHp: 40 });
    expect(low.playerHp).toBe(48); // 40 + 8
    const full = startEncounterWithRelics('slime', 2026, ['phoenix-feather'], { startingPlayerHp: 58 });
    expect(full.playerHp).toBe(60); // 58 + 8 capped
  });
});

describe('playTurnWithRelics — turn-start regen', () => {
  it('Second Wind heals 1 at turn start, leaving the player 1 HP higher after the turn', () => {
    // A checkerboard makes no match → 0 outgoing damage, so only regen + enemy attack move HP.
    const CHECKER = boardFromRows(['RGR', 'GRG', 'RGR']);
    const swap: Path = { start: { col: 0, row: 0 }, steps: ['right'] };
    const base = () => makeState({ enemyId: 'slime', enemyHp: 80, enemyMaxHp: 80, playerHp: 50, board: CHECKER });

    const without = playTurn(base(), swap);
    const withRelic = playTurnWithRelics(base(), swap, ['second-wind']);

    expect(without.damage).toBe(0);
    expect(withRelic.damage).toBe(0);
    expect(without.playerHpAfter).toBe(42); // 50 − 8
    expect(withRelic.playerHpAfter).toBe(43); // (50 + 1 regen) − 8
  });
});
