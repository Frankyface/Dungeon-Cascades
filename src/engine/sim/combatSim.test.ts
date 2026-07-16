/**
 * Combat-sim regression + determinism tests.
 *
 * Like sim.test.ts for the board harness, these lock in the CURRENT combat
 * engine + bot behavior on small fixed-seed runs (seed 42, 50 encounters) so that
 * `npm test` fails loudly if a change to the combat engine, either combat bot, or a
 * combat CONSTANT shifts the balance numbers. Expected values were recorded from real
 * runs under the DEFAULT combat config; if the config or engine legitimately changes,
 * re-record them and note why in the Verification Log.
 *
 * Also unit-tests the greedy bot's objective scorer (scoreFirstWave) with
 * hand-computed values so the affinity/heal weighting is pen-and-paper verifiable.
 */
import { TILE_COLORS } from '../board';
import { DEFAULT_COMBAT_CONFIG } from '../combat';
import type { EnemyId } from '../combat';
import {
  DEFAULT_BOT_CONFIG,
  DEFAULT_MAX_TURNS,
  formatCombatReport,
  runCombatHarness,
  scoreFirstWave,
  summarizeCombat,
} from './index';
import type { CombatBotName, CombatHarnessConfig } from './index';

function makeConfig(enemy: EnemyId, bot: CombatBotName, games: number): CombatHarnessConfig {
  return {
    enemy,
    bot,
    games,
    baseSeed: 42,
    botConfig: DEFAULT_BOT_CONFIG,
    combatConfig: DEFAULT_COMBAT_CONFIG,
    maxTurns: DEFAULT_MAX_TURNS,
  };
}

function run(enemy: EnemyId, bot: CombatBotName, games: number) {
  const config = makeConfig(enemy, bot, games);
  return summarizeCombat(config, runCombatHarness(config));
}

/** Color code (index into TILE_COLORS) for a color char, for building scorer inputs. */
const CODE: Record<string, number> = Object.fromEntries(TILE_COLORS.map((c, i) => [c, i]));

describe('combat sim — greedy-combat fixed-seed regression (50 encounters, seed 42)', () => {
  it('greedy-combat beats each enemy with the recorded win counts and medians', () => {
    const slime = run('slime', 'greedy-combat', 50);
    expect(slime.wins).toBe(50);
    expect(slime.totalMoves).toBe(55);
    expect(slime.medianTurnsToWin).toBe(1);
    expect(slime.avgDamagePerMove.toFixed(4)).toBe('70.0727');

    const skeleton = run('skeleton', 'greedy-combat', 50);
    expect(skeleton.wins).toBe(50);
    expect(skeleton.totalMoves).toBe(70);
    expect(skeleton.medianTurnsToWin).toBe(1);

    const bat = run('bat', 'greedy-combat', 50);
    expect(bat.wins).toBe(50);
    expect(bat.totalMoves).toBe(60);
    expect(bat.medianTurnsToWin).toBe(1);
  });
});

describe('combat sim — random baseline fixed-seed regression (50 encounters, seed 42)', () => {
  it('random bot posts the recorded win counts and medians per enemy', () => {
    const slime = run('slime', 'random', 50);
    expect(slime.wins).toBe(30);
    expect(slime.totalMoves).toBe(384);
    expect(slime.medianTurnsToWin).toBe(6);

    const skeleton = run('skeleton', 'random', 50);
    expect(skeleton.wins).toBe(7);
    expect(skeleton.totalMoves).toBe(437);
    expect(skeleton.medianTurnsToWin).toBe(8);

    const bat = run('bat', 'random', 50);
    expect(bat.wins).toBe(39);
    expect(bat.totalMoves).toBe(893);
    expect(bat.medianTurnsToWin).toBe(12);
  });
});

describe('combat sim — skill signal (greedy strictly out-wins random)', () => {
  it('greedy-combat win rate ≥ random win rate on every enemy', () => {
    for (const enemy of ['slime', 'skeleton', 'bat'] as EnemyId[]) {
      const greedy = run(enemy, 'greedy-combat', 50);
      const random = run(enemy, 'random', 50);
      expect(greedy.winRatePct).toBeGreaterThanOrEqual(random.winRatePct);
    }
  });
});

describe('combat sim — determinism', () => {
  it('produces byte-identical reports across two runs (greedy)', () => {
    const config = makeConfig('skeleton', 'greedy-combat', 40);
    const a = formatCombatReport(summarizeCombat(config, runCombatHarness(config)));
    const b = formatCombatReport(summarizeCombat(config, runCombatHarness(config)));
    expect(b).toBe(a);
  });

  it('produces byte-identical reports across two runs (random)', () => {
    const config = makeConfig('bat', 'random', 40);
    const a = formatCombatReport(summarizeCombat(config, runCombatHarness(config)));
    const b = formatCombatReport(summarizeCombat(config, runCombatHarness(config)));
    expect(b).toBe(a);
  });
});

describe('scoreFirstWave — greedy objective is hand-computable', () => {
  const CFG = DEFAULT_COMBAT_CONFIG;

  /** Weights for a slime (weak R = 2.0×): R base 20, other damage 10, heal healBase×weight. */
  function slimeWeights(healWeight: number) {
    const colorBase = new Float64Array(TILE_COLORS.length);
    colorBase[CODE.R] = CFG.attackBase * 2.0; // weak
    colorBase[CODE.G] = CFG.attackBase * 1.0;
    colorBase[CODE.B] = CFG.attackBase * 1.0;
    colorBase[CODE.Y] = CFG.attackBase * 1.0;
    colorBase[CODE.P] = CFG.healBase * healWeight;
    return { colorBase, groupSizeBonus: CFG.groupSizeBonus, cascadeBonus: CFG.cascadeBonus };
  }

  it('scores a single weak-color 3-match at attackBase × affinity (=20 for slime R)', () => {
    // 3x3 board, top row R,R,R (a horizontal triple), rest non-matching.
    const codes = new Uint8Array([
      CODE.R, CODE.R, CODE.R,
      CODE.G, CODE.B, CODE.Y,
      CODE.B, CODE.Y, CODE.G,
    ]);
    // one group, size 3, weak R: 10×2×(1+0.25×0) = 20; combos 1 → ×1.
    expect(scoreFirstWave(codes, 3, 3, slimeWeights(0))).toBe(20);
  });

  it('rewards a larger group via the size bonus (R 4-match = 10×2×1.25 = 25)', () => {
    // 4x2 board, top row R,R,R,R.
    const codes = new Uint8Array([
      CODE.R, CODE.R, CODE.R, CODE.R,
      CODE.G, CODE.B, CODE.Y, CODE.G,
    ]);
    expect(scoreFirstWave(codes, 4, 2, slimeWeights(0))).toBe(25);
  });

  it('two groups lift each other via the cascade multiplier (2×20 base × 1.25 = 50)', () => {
    // 3x3: row0 R,R,R and row2 R,R,R → two separate weak-R triples, combos = 2.
    const codes = new Uint8Array([
      CODE.R, CODE.R, CODE.R,
      CODE.G, CODE.B, CODE.Y,
      CODE.R, CODE.R, CODE.R,
    ]);
    // value 20+20 = 40; cascade 1+0.25×(2−1) = 1.25 → 50.
    expect(scoreFirstWave(codes, 3, 3, slimeWeights(0))).toBe(50);
  });

  it('heal groups score 0 when healthy (weight 0) but positive when hurt (weight 1)', () => {
    // 3x3 top row P,P,P (heal triple).
    const codes = new Uint8Array([
      CODE.P, CODE.P, CODE.P,
      CODE.G, CODE.B, CODE.Y,
      CODE.B, CODE.Y, CODE.G,
    ]);
    expect(scoreFirstWave(codes, 3, 3, slimeWeights(0))).toBe(0); // healthy: heal ignored
    expect(scoreFirstWave(codes, 3, 3, slimeWeights(1))).toBe(5); // hurt: healBase 5 × 1
  });

  it('returns 0 for a board with no matches', () => {
    const codes = new Uint8Array([
      CODE.R, CODE.G, CODE.B,
      CODE.G, CODE.B, CODE.Y,
      CODE.B, CODE.Y, CODE.R,
    ]);
    expect(scoreFirstWave(codes, 3, 3, slimeWeights(1))).toBe(0);
  });
});
