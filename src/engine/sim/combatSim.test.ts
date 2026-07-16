/**
 * Combat-sim regression + determinism tests.
 *
 * Like sim.test.ts for the board harness, these lock in the CURRENT combat
 * engine + bot behavior on small fixed-seed runs (seed 42, 50 encounters) so that
 * `npm test` fails loudly if a change to the combat engine, either combat bot, or a
 * combat CONSTANT shifts the balance numbers. Expected values were re-recorded from
 * real runs under the DEFAULT combat config after the 2026-07-15 "Combat
 * recalibration" (ATTACK_BASE 3, HEAL_BASE 2, enemy HP/attack scaled up); if the
 * config or engine legitimately changes again, re-record them and note why in the
 * Verification Log.
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
    expect(slime.totalMoves).toBe(231);
    expect(slime.medianTurnsToWin).toBe(5);
    expect(slime.avgDamagePerMove.toFixed(4)).toBe('20.3593');

    const skeleton = run('skeleton', 'greedy-combat', 50);
    expect(skeleton.wins).toBe(47);
    expect(skeleton.totalMoves).toBe(331);
    expect(skeleton.medianTurnsToWin).toBe(7);

    const bat = run('bat', 'greedy-combat', 50);
    expect(bat.wins).toBe(50);
    expect(bat.totalMoves).toBe(338);
    expect(bat.medianTurnsToWin).toBe(7);
  });
});

describe('combat sim — random baseline fixed-seed regression (50 encounters, seed 42)', () => {
  it('random bot posts the recorded win counts and medians per enemy', () => {
    // Under the recalibrated curve the enemy-agnostic random bot is shut out over this
    // 50-game seed-42 subset (median-to-win is 0 = no wins) — the skill signal.
    const slime = run('slime', 'random', 50);
    expect(slime.wins).toBe(0);
    expect(slime.totalMoves).toBe(404);
    expect(slime.medianTurnsToWin).toBe(0);

    const skeleton = run('skeleton', 'random', 50);
    expect(skeleton.wins).toBe(0);
    expect(skeleton.totalMoves).toBe(450);
    expect(skeleton.medianTurnsToWin).toBe(0);

    const bat = run('bat', 'random', 50);
    expect(bat.wins).toBe(0);
    expect(bat.totalMoves).toBe(1034);
    expect(bat.medianTurnsToWin).toBe(0);
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

  /** Weights for a slime (weak R = 2.0×): R base 6, other damage 3, heal healBase×weight. */
  function slimeWeights(healWeight: number) {
    const colorBase = new Float64Array(TILE_COLORS.length);
    colorBase[CODE.R] = CFG.attackBase * 2.0; // weak
    colorBase[CODE.G] = CFG.attackBase * 1.0;
    colorBase[CODE.B] = CFG.attackBase * 1.0;
    colorBase[CODE.Y] = CFG.attackBase * 1.0;
    colorBase[CODE.P] = CFG.healBase * healWeight;
    return { colorBase, groupSizeBonus: CFG.groupSizeBonus, cascadeBonus: CFG.cascadeBonus };
  }

  it('scores a single weak-color 3-match at attackBase × affinity (=6 for slime R)', () => {
    // 3x3 board, top row R,R,R (a horizontal triple), rest non-matching.
    const codes = new Uint8Array([
      CODE.R, CODE.R, CODE.R,
      CODE.G, CODE.B, CODE.Y,
      CODE.B, CODE.Y, CODE.G,
    ]);
    // one group, size 3, weak R: 3×2×(1+0.25×0) = 6; combos 1 → ×1.
    expect(scoreFirstWave(codes, 3, 3, slimeWeights(0))).toBe(6);
  });

  it('rewards a larger group via the size bonus (R 4-match = 3×2×1.25 = 7.5)', () => {
    // 4x2 board, top row R,R,R,R.
    const codes = new Uint8Array([
      CODE.R, CODE.R, CODE.R, CODE.R,
      CODE.G, CODE.B, CODE.Y, CODE.G,
    ]);
    expect(scoreFirstWave(codes, 4, 2, slimeWeights(0))).toBe(7.5);
  });

  it('two groups lift each other via the cascade multiplier (2×6 base × 1.25 = 15)', () => {
    // 3x3: row0 R,R,R and row2 R,R,R → two separate weak-R triples, combos = 2.
    const codes = new Uint8Array([
      CODE.R, CODE.R, CODE.R,
      CODE.G, CODE.B, CODE.Y,
      CODE.R, CODE.R, CODE.R,
    ]);
    // value 6+6 = 12; cascade 1+0.25×(2−1) = 1.25 → 15.
    expect(scoreFirstWave(codes, 3, 3, slimeWeights(0))).toBe(15);
  });

  it('heal groups score 0 when healthy (weight 0) but positive when hurt (weight 1)', () => {
    // 3x3 top row P,P,P (heal triple).
    const codes = new Uint8Array([
      CODE.P, CODE.P, CODE.P,
      CODE.G, CODE.B, CODE.Y,
      CODE.B, CODE.Y, CODE.G,
    ]);
    expect(scoreFirstWave(codes, 3, 3, slimeWeights(0))).toBe(0); // healthy: heal ignored
    expect(scoreFirstWave(codes, 3, 3, slimeWeights(1))).toBe(2); // hurt: healBase 2 × 1
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
