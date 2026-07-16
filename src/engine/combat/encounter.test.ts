/**
 * Encounter state-machine fixtures. Covers: startEncounter initial state; the
 * turn-order contract (board+combat resolves → win check BEFORE the enemy acts →
 * enemy fires its telegraph → lose check → next telegraph); win/lose/terminal
 * edges; overkill + floor + overheal-cap; trustworthy-telegraph transcripts; intent
 * cycling through the machine; and transcript determinism.
 *
 * White-box tests CONSTRUCT CombatState directly (it is plain data) with hand-built
 * boards + a scripted refill source so exact damage/heal is pen-and-paper known.
 */
import { boardFromRows, createRng, findMatches } from '../board';
import type { Path, RngState, TileColor, TileSource } from '../board';
import { startEncounter, playTurn } from './encounter';
import { getEnemy } from './enemies';
import type { CombatState, EnemyId, TurnResolution } from './types';

/** Deterministic, hand-scriptable refill source (copied convention from board tests). */
function scriptedSource(colors: readonly TileColor[]): TileSource {
  return {
    next(state: RngState) {
      const index = state.a;
      const color = colors[index];
      if (color === undefined) {
        throw new Error(`scriptedSource exhausted at draw ${index}`);
      }
      return { color, state: { a: index + 1 } };
    },
  };
}

/** Construct a CombatState with sensible defaults, overridable per test. */
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
    telegraph: over.telegraph ?? enemy.script[over.intentIndex ?? 0],
    status: over.status ?? 'ongoing',
    turn: over.turn ?? 0,
  };
}

// Boards where picking up (col1,row0) and dragging LEFT makes col0 a vertical triple.
const RRR_BOARD = ['BRG', 'RBG', 'RGB']; // → col0 becomes R,R,R
const GGG_BOARD = ['BGR', 'GBR', 'GRB']; // → col0 becomes G,G,G
const PPP_BOARD = ['BPR', 'PBR', 'PRB']; // → col0 becomes P,P,P (heal)
const LEFT_PATH: Path = { start: { col: 1, row: 0 }, steps: ['left'] };
const SAFE_REFILL = scriptedSource(['Y', 'B', 'Y', 'G', 'B', 'Y']); // never re-matches col0

describe('startEncounter', () => {
  it('produces a full-HP, ongoing state with the first telegraph and a match-free board', () => {
    const s = startEncounter('slime', 2026);
    expect(s.status).toBe('ongoing');
    expect(s.playerHp).toBe(60);
    expect(s.playerMaxHp).toBe(60);
    expect(s.enemyHp).toBe(80);
    expect(s.enemyMaxHp).toBe(80);
    expect(s.intentIndex).toBe(0);
    expect(s.telegraph).toEqual({ type: 'attack', value: 8 });
    expect(s.turn).toBe(0);
    expect(s.board.cols).toBe(6);
    expect(s.board.rows).toBe(5);
    expect(findMatches(s.board)).toHaveLength(0); // no pre-existing matches
  });

  it('is deterministic: same enemyId + seed ⇒ deep-equal state', () => {
    expect(startEncounter('skeleton', 123)).toEqual(startEncounter('skeleton', 123));
  });

  it('derives an independent refill stream from the board-creation stream', () => {
    // The stored move RNG must NOT be createRng(seed) — that would correlate refills
    // with the board's first cells. It is a separately-derived stream.
    const s = startEncounter('bat', 7);
    expect(s.rngState).not.toEqual(createRng(7));
  });
});

describe('turn order — win check fires BEFORE the enemy acts', () => {
  it('a lethal move kills the enemy, which never acts; player HP untouched', () => {
    const state = makeState({ enemyId: 'slime', enemyHp: 5, enemyMaxHp: 80, rngState: createRng(0), board: boardFromRows(RRR_BOARD) });
    const res = playTurn(state, LEFT_PATH, SAFE_REFILL);

    expect(res.damage).toBe(6); // R weak (2.0×) 3-match: 3 × 2.0 × 1.0
    expect(res.status).toBe('won');
    expect(res.enemyAction).toBeNull(); // dead enemy never acts
    expect(res.enemyHpAfter).toBe(0); // floored (overkill 6 vs 5 HP)
    expect(res.playerHpBefore).toBe(60);
    expect(res.playerHpAfter).toBe(60); // enemy never attacked
    expect(res.state.status).toBe('won');
  });

  it('overkill is allowed on the killing blow (damage retained, HP floored at 0)', () => {
    const state = makeState({ enemyId: 'slime', enemyHp: 1, enemyMaxHp: 80, rngState: createRng(0), board: boardFromRows(RRR_BOARD) });
    const res = playTurn(state, LEFT_PATH, SAFE_REFILL);
    expect(res.damage).toBe(6); // full damage number retained
    expect(res.enemyHpAfter).toBe(0); // never negative
  });
});

describe('turn order — enemy acts, then lose check', () => {
  it('a non-lethal move lets the enemy fire its telegraph and kill the player', () => {
    const state = makeState({ enemyId: 'slime', enemyHp: 30, enemyMaxHp: 80, playerHp: 5, rngState: createRng(0), board: boardFromRows(GGG_BOARD) });
    const res = playTurn(state, LEFT_PATH, SAFE_REFILL);

    expect(res.damage).toBe(3); // G normal (1.0×) 3-match: 3 × 1.0 × 1.0
    expect(res.enemyHpAfter).toBe(27); // 30 − 3, enemy survived
    expect(res.enemyAction).toEqual({ type: 'attack', value: 8 }); // telegraph fired
    expect(res.playerHpAfter).toBe(0); // 5 − 8 floored at 0 (no underflow)
    expect(res.status).toBe('lost');
    expect(res.state.status).toBe('lost');
  });
});

describe('terminal states reject further moves', () => {
  it('playTurn throws once the encounter is won or lost', () => {
    const won = makeState({ enemyId: 'slime', status: 'won' });
    const lost = makeState({ enemyId: 'slime', status: 'lost' });
    expect(() => playTurn(won, LEFT_PATH)).toThrow();
    expect(() => playTurn(lost, LEFT_PATH)).toThrow();
  });
});

describe('overheal is capped at max HP', () => {
  it('a heal move never lifts the player above playerMaxHp', () => {
    // Skeleton at intentIndex 1 telegraphs CHARGE (0 dmg) so the heal is isolated.
    const state = makeState({
      enemyId: 'skeleton',
      enemyHp: 120,
      enemyMaxHp: 120,
      playerHp: 59,
      playerMaxHp: 60,
      intentIndex: 1,
      rngState: createRng(0),
      board: boardFromRows(PPP_BOARD),
    });
    const res = playTurn(state, LEFT_PATH, scriptedSource(['Y', 'G', 'Y']));

    expect(res.heal).toBe(2); // rolled heal (2 × 1.0 × 1.0)
    expect(res.enemyAction).toEqual({ type: 'charge', value: 0 }); // charge, no player damage
    expect(res.playerHpAfter).toBe(60); // 59 + 2 capped at 60, not 61
    expect(res.status).toBe('ongoing');
  });
});

describe('multi-wave + affinity + cascade integration through playTurn', () => {
  it('a 2-wave move aggregates damage across waves with affinity and cascade', () => {
    // Board + path + refill reproduce the board engine's proven 2-wave fixture:
    // wave 1 = GGG, wave 2 = RRR (totalCombos = 2).
    const state = makeState({
      enemyId: 'slime',
      enemyHp: 100,
      enemyMaxHp: 100,
      rngState: createRng(0),
      board: boardFromRows(['YBP', 'RRG', 'GGY', 'BRP', 'PRB']),
    });
    const path: Path = { start: { col: 2, row: 1 }, steps: ['down'] };
    const res = playTurn(state, path, scriptedSource(['Y', 'G', 'B', 'Y', 'G', 'Y']));

    expect(res.groups).toHaveLength(2);
    expect(res.cascadeMultiplier).toBe(1.25); // 2 combos
    // G normal (3) + R weak (6) = 9 base, × 1.25 = 11.25 → round 11.
    expect(res.damage).toBe(11);
    expect(res.enemyHpAfter).toBe(89); // 100 − 11
    expect(res.enemyAction).toEqual({ type: 'attack', value: 8 });
    expect(res.playerHpAfter).toBe(52); // 60 − 8
    expect(res.status).toBe('ongoing');
  });
});

describe('intents are trustworthy — every fired action matches its prior telegraph', () => {
  // A checkerboard board where swapping (0,0)↔(1,0) forms no match: the player deals
  // 0 damage every turn, so a high-HP enemy survives a full intent cycle.
  const CHECKER = boardFromRows(['RGR', 'GRG', 'RGR']);
  const swapRight: Path = { start: { col: 0, row: 0 }, steps: ['right'] };
  const swapBack: Path = { start: { col: 1, row: 0 }, steps: ['left'] };

  it("skeleton: transcript wraps attack8 → charge → attack14 and telegraphs are honest", () => {
    let state = makeState({
      enemyId: 'skeleton',
      enemyHp: 120,
      enemyMaxHp: 120,
      playerHp: 999,
      playerMaxHp: 999,
      board: CHECKER,
    });
    const fired: unknown[] = [];
    for (let t = 0; t < 7; t++) {
      const telegraphBefore = state.telegraph;
      const res: TurnResolution = playTurn(state, t % 2 === 0 ? swapRight : swapBack);
      expect(res.enemyAction).toEqual(telegraphBefore); // fired == telegraphed
      fired.push(res.enemyAction);
      state = res.state;
    }
    expect(fired).toEqual([
      { type: 'attack', value: 8 },
      { type: 'charge', value: 0 },
      { type: 'attack', value: 16 },
      { type: 'attack', value: 8 }, // cycle wraps
      { type: 'charge', value: 0 },
      { type: 'attack', value: 16 },
      { type: 'attack', value: 8 },
    ]);
  });

  it('bat: transcript alternates attack4 ↔ self-heal5 (heal capped at max HP)', () => {
    let state = makeState({
      enemyId: 'bat',
      enemyHp: 90,
      enemyMaxHp: 90,
      playerHp: 999,
      playerMaxHp: 999,
      board: CHECKER,
    });
    const fired: unknown[] = [];
    for (let t = 0; t < 4; t++) {
      const res = playTurn(state, t % 2 === 0 ? swapRight : swapBack);
      fired.push(res.enemyAction);
      // On its heal turn the bat is already at max HP → stays capped at 90.
      expect(res.enemyHpAfter).toBe(90);
      state = res.state;
    }
    expect(fired).toEqual([
      { type: 'attack', value: 6 },
      { type: 'heal', value: 8 },
      { type: 'attack', value: 6 },
      { type: 'heal', value: 8 },
    ]);
  });
});

describe('determinism — same enemyId + seed + path sequence ⇒ identical transcript', () => {
  function playSequence(enemyId: EnemyId, seed: number, paths: readonly Path[]): TurnResolution[] {
    let state = startEncounter(enemyId, seed);
    const out: TurnResolution[] = [];
    for (const path of paths) {
      if (state.status !== 'ongoing') break;
      const res = playTurn(state, path);
      out.push(res);
      state = res.state;
    }
    return out;
  }

  it('two runs of the same sequence deep-equal', () => {
    const paths: Path[] = [
      { start: { col: 2, row: 2 }, steps: ['up', 'left', 'down', 'right'] },
      { start: { col: 3, row: 2 }, steps: ['left', 'up', 'right', 'down'] },
      { start: { col: 1, row: 1 }, steps: ['down', 'right', 'up', 'left'] },
      { start: { col: 4, row: 3 }, steps: ['up', 'left'] },
    ];
    const runA = playSequence('skeleton', 4242, paths);
    const runB = playSequence('skeleton', 4242, paths);
    expect(JSON.stringify(runA)).toBe(JSON.stringify(runB));
    expect(runA.length).toBeGreaterThan(0);
  });

  it('does not mutate the input state', () => {
    const state = startEncounter('slime', 9);
    const snapshot = JSON.stringify(state);
    playTurn(state, { start: { col: 2, row: 2 }, steps: ['up', 'left'] });
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});
