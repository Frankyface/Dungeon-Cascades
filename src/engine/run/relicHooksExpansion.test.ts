/**
 * Stage-6 (wave 1b) hook-engine fixtures. Hand-computed arithmetic pins the NEW hook families:
 * the `onCascadeWave` per-wave fold (flat + `perWaveIndex` snowball), the run-layer event helpers
 * (onEnemyDefeated / onActStart / onRestUsed / onShopPurchase), the new conditions/scalers
 * (`comboThreshold`, `playerHpBelow`, `perRotStack`, `maxHpFraction`), the `also` multi-channel
 * chain, the `cascadeWave` combat seam (byte-identical when absent), and the canonical-schema
 * validator's rejection of typo'd hooks/kinds/ops.
 */
import { boardFromRows, createRng } from '../board';
import type { Path, RngState, TileColor, TileSource } from '../board';
import { playTurn } from '../combat';
import type { CombatState } from '../combat';
import {
  applyCascadeWaveHooks,
  applyRelicHooks,
  buildCombatModifiers,
  cascadeWaveEnemyDamage,
  cascadeWaveGold,
  cascadeWavePlayerHeal,
  combatStartEnemyChip,
  combatStartPlayerHeal,
  enemyDefeatedGold,
  enemyDefeatedPlayerHeal,
  actStartGold,
  actStartPlayerHeal,
  restUsedGold,
  restUsedPlayerHeal,
  restHealAmount,
  shopPurchaseGold,
  shopPurchasePlayerHeal,
  shopPrice,
  turnStartRegen,
} from './relicHooks';
import { RELIC_REGISTRY, assertRelicWellFormed } from './relics';
import type { Relic } from './relicTypes';

// ── onCascadeWave fold (waves 2..N) ────────────────────────────────────────────────────────
describe('applyCascadeWaveHooks / cascadeWave* — per-wave fold', () => {
  it('flat modifier sums over waves after the first (amount × (waveCount − 1))', () => {
    // Tremor Stone: +1 enemy damage per wave after the first. 4-wave move ⇒ +3; 1-wave ⇒ 0.
    expect(cascadeWaveEnemyDamage(4, ['tremor-stone'])).toBe(3);
    expect(cascadeWaveEnemyDamage(2, ['tremor-stone'])).toBe(1);
    expect(cascadeWaveEnemyDamage(1, ['tremor-stone'])).toBe(0);
    expect(cascadeWaveEnemyDamage(0, ['tremor-stone'])).toBe(0);
    // Chain-Fed Ruin: +3 per wave after the first ⇒ 4-wave = 9.
    expect(cascadeWaveEnemyDamage(4, ['chain-fed-ruin'])).toBe(9);
  });

  it('perWaveIndex snowball: amount × (i − 1) summed over i = 2..N', () => {
    // Landslide Core: +2 on wave 2, +4 on wave 3, +6 on wave 4 ⇒ 4-wave = 12; 3-wave = 6; 2-wave = 2.
    expect(cascadeWaveEnemyDamage(4, ['avalanche-core'])).toBe(12);
    expect(cascadeWaveEnemyDamage(3, ['avalanche-core'])).toBe(6);
    expect(cascadeWaveEnemyDamage(2, ['avalanche-core'])).toBe(2);
    expect(cascadeWaveEnemyDamage(1, ['avalanche-core'])).toBe(0);
  });

  it('routes by kind: playerHeal / gold channels are independent', () => {
    expect(cascadeWavePlayerHeal(4, ['springwater-charm'])).toBe(3);
    expect(cascadeWaveGold(4, ['prospectors-lens'])).toBe(3);
    // Tremor Stone only touches enemyDamage, so heal/gold folds see nothing.
    expect(cascadeWavePlayerHeal(4, ['tremor-stone'])).toBe(0);
    expect(cascadeWaveGold(4, ['tremor-stone'])).toBe(0);
  });

  it('maelstrom-pearl folds BOTH channels (also-chain): +3 HP and +3 gold per wave', () => {
    // 4-wave move ⇒ +9 HP and +9 gold.
    expect(cascadeWavePlayerHeal(4, ['maelstrom-pearl'])).toBe(9);
    expect(cascadeWaveGold(4, ['maelstrom-pearl'])).toBe(9);
    expect(cascadeWaveEnemyDamage(4, ['maelstrom-pearl'])).toBe(0);
  });

  it('stacks multiple cascade relics on one kind (tremor +1/wave + landslide snowball)', () => {
    // 4-wave: tremor 3 + landslide 12 = 15.
    expect(cascadeWaveEnemyDamage(4, ['tremor-stone', 'avalanche-core'])).toBe(15);
    expect(applyCascadeWaveHooks('enemyDamage', 4, ['tremor-stone', 'avalanche-core'])).toBe(15);
  });
});

// ── cascadeWave combat seam ────────────────────────────────────────────────────────────────
describe('buildCombatModifiers — cascadeWave seam', () => {
  it('exposes cascadeWave only when an owned relic uses onCascadeWave', () => {
    expect(buildCombatModifiers(['tremor-stone']).cascadeWave).toBeDefined();
    expect(buildCombatModifiers(['emberfang']).cascadeWave).toBeUndefined();
    expect(buildCombatModifiers([]).cascadeWave).toBeUndefined();
  });

  it('the transform returns the per-wave enemyDamage + playerHeal totals', () => {
    const t = buildCombatModifiers(['tremor-stone']).cascadeWave!;
    expect(t(4)).toEqual({ enemyDamage: 3, playerHeal: 0 });
    const m = buildCombatModifiers(['maelstrom-pearl']).cascadeWave!;
    expect(m(4)).toEqual({ enemyDamage: 0, playerHeal: 9 });
  });
});

/** Deterministic, hand-scriptable refill source (board-test convention). */
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

describe('playTurn — cascadeWave consumption (byte-identical when absent)', () => {
  // A single R vertical triple (no cascade) so the base move is fixed; the ONLY difference is the
  // injected per-wave effect. RRR_BOARD + LEFT_PATH make col0 a vertical R triple; SAFE_REFILL
  // never re-matches, so the move is one wave.
  const RRR_BOARD = boardFromRows(['BRG', 'RBG', 'RGB']);
  const LEFT_PATH: Path = { start: { col: 1, row: 0 }, steps: ['left'] };
  const SAFE_REFILL = scriptedSource(['Y', 'B', 'Y', 'G', 'B', 'Y', 'Y', 'B', 'Y']);
  const base: CombatState = {
    enemyId: 'slime',
    board: RRR_BOARD,
    rngState: createRng(0),
    playerHp: 30,
    playerMaxHp: 60,
    enemyHp: 500,
    enemyMaxHp: 500,
    intentIndex: 0,
    telegraph: { type: 'attack', value: 8 },
    status: 'ongoing',
    turn: 0,
  };

  it('omitted / empty modifiers ⇒ byte-identical resolution', () => {
    const plain = playTurn(base, LEFT_PATH, SAFE_REFILL);
    const empty = playTurn(base, LEFT_PATH, SAFE_REFILL, undefined, {});
    expect(empty).toEqual(plain);
  });

  it('applies cascade enemyDamage (direct) and playerHeal (pre-enemy-attack)', () => {
    const plain = playTurn(base, LEFT_PATH, SAFE_REFILL);
    const withCascade = playTurn(base, LEFT_PATH, SAFE_REFILL, undefined, {
      cascadeWave: () => ({ enemyDamage: 5, playerHeal: 3 }),
    });
    // Enemy took the same move damage PLUS the 5 direct cascade damage.
    expect(withCascade.enemyHpAfter).toBe(plain.enemyHpAfter - 5);
    // Player got +3 heal before the slime's 8-damage attack landed.
    expect(withCascade.playerHpAfter).toBe(plain.playerHpAfter + 3);
  });
});

// ── run-layer event helpers ─────────────────────────────────────────────────────────────────
describe('run-layer event helpers (pure folds; wave 1c invokes them)', () => {
  it('onEnemyDefeated gold / playerHeal route by kind', () => {
    expect(enemyDefeatedGold(['gravekeepers-due'])).toBe(3);
    expect(enemyDefeatedGold(['toll-of-plenty'])).toBe(12);
    expect(enemyDefeatedGold(['reapers-tally'])).toBe(15);
    expect(enemyDefeatedPlayerHeal(['vulture-feather'])).toBe(3);
    expect(enemyDefeatedPlayerHeal(['harvest-of-souls'])).toBe(15);
    // Vulture heals but grants no gold; gravekeeper the reverse.
    expect(enemyDefeatedGold(['vulture-feather'])).toBe(0);
    expect(enemyDefeatedPlayerHeal(['gravekeepers-due'])).toBe(0);
  });

  it('gravebound-tithe (also-chain) splits its two onEnemyDefeated channels', () => {
    expect(enemyDefeatedGold(['gravebound-tithe'])).toBe(20);
    expect(enemyDefeatedPlayerHeal(['gravebound-tithe'])).toBe(12);
  });

  it('onActStart gold / playerHeal', () => {
    expect(actStartGold(['pathfinders-map'])).toBe(20);
    expect(actStartPlayerHeal(['wayfarers-draught'])).toBe(12);
    expect(actStartPlayerHeal(['second-dawn'])).toBe(30);
  });

  it('onRestUsed side-channels (gold / playerHeal) vs restHeal value-transform', () => {
    expect(restUsedGold(['travelers-tithe'])).toBe(12);
    expect(restUsedPlayerHeal(['bedroll-talisman'])).toBe(8);
    // Value-transform: Wanderer's Hearth doubles the node's base heal (×2), Ascetic's Vow zeroes it.
    expect(restHealAmount(30, ['wanderers-hearth'])).toBe(60);
    expect(restHealAmount(30, ['ascetics-vow'])).toBe(0);
    expect(restHealAmount(30, [])).toBe(30);
    // The value-transform does NOT bleed into the additive side-channels.
    expect(restUsedGold(['wanderers-hearth'])).toBe(0);
    expect(restUsedPlayerHeal(['wanderers-hearth'])).toBe(0);
  });

  it('onShopPurchase side-channels (gold rebate / playerHeal) vs price value-transform', () => {
    expect(shopPurchaseGold(['hagglers-chit'])).toBe(5);
    expect(shopPurchasePlayerHeal(['almsgivers-token'])).toBe(6);
    // Haggler's Charm shaves 40% off a price (pay 60%).
    expect(shopPrice(100, ['hagglers-charm'])).toBe(60);
    expect(shopPrice(100, [])).toBe(100);
    expect(shopPurchaseGold(['hagglers-charm'])).toBe(0);
  });
});

// ── new conditions / scalers ─────────────────────────────────────────────────────────────────
describe('conditions — comboThreshold', () => {
  it('fires only at/above the threshold', () => {
    // Magma Seal: +4 flat Red on 3+ combos.
    expect(applyRelicHooks('onDamageComputed', 10, { color: 'R', totalCombos: 2 }, ['magma-seal'])).toBeCloseTo(10, 10);
    expect(applyRelicHooks('onDamageComputed', 10, { color: 'R', totalCombos: 3 }, ['magma-seal'])).toBeCloseTo(14, 10);
    // wrong color misses even at threshold.
    expect(applyRelicHooks('onDamageComputed', 10, { color: 'G', totalCombos: 3 }, ['magma-seal'])).toBeCloseTo(10, 10);
    // Groundswell Totem: +10% ALL on 3+ combos.
    expect(applyRelicHooks('onDamageComputed', 10, { totalCombos: 2 }, ['groundswell-totem'])).toBeCloseTo(10, 10);
    expect(applyRelicHooks('onDamageComputed', 10, { totalCombos: 3 }, ['groundswell-totem'])).toBeCloseTo(11, 10);
    // Crescendo Crown: ×2 ALL on 4+ combos.
    expect(applyRelicHooks('onDamageComputed', 10, { totalCombos: 3 }, ['crescendo-crown'])).toBeCloseTo(10, 10);
    expect(applyRelicHooks('onDamageComputed', 10, { totalCombos: 4 }, ['crescendo-crown'])).toBeCloseTo(20, 10);
    // Rimebound Fang: Blue ×2 at 4+ combos only.
    expect(applyRelicHooks('onDamageComputed', 10, { color: 'B', totalCombos: 4 }, ['rimebound-sigil'])).toBeCloseTo(20, 10);
    expect(applyRelicHooks('onDamageComputed', 10, { color: 'B', totalCombos: 3 }, ['rimebound-sigil'])).toBeCloseTo(10, 10);
    expect(applyRelicHooks('onDamageComputed', 10, { color: 'R', totalCombos: 4 }, ['rimebound-sigil'])).toBeCloseTo(10, 10);
  });
});

describe('conditions — playerHpBelow (comeback gate)', () => {
  it('Trollblood Charm heals 3/turn only strictly below 50% HP', () => {
    expect(turnStartRegen(['trollblood-charm'], RELIC_REGISTRY, { playerHpFraction: 0.4 })).toBe(3);
    expect(turnStartRegen(['trollblood-charm'], RELIC_REGISTRY, { playerHpFraction: 0.6 })).toBe(0);
    expect(turnStartRegen(['trollblood-charm'], RELIC_REGISTRY, { playerHpFraction: 0.5 })).toBe(0); // strictly below
    // No context ⇒ treated as full HP ⇒ inert.
    expect(turnStartRegen(['trollblood-charm'])).toBe(0);
  });
});

describe('scalers — perRotStack (Rotwood)', () => {
  it('Sporecrown: +8% damage per rot stack, capped at 5 stacks', () => {
    expect(applyRelicHooks('onDamageComputed', 100, { rotStacks: 0 }, ['sporecrown'])).toBeCloseTo(100, 10);
    expect(applyRelicHooks('onDamageComputed', 100, { rotStacks: 3 }, ['sporecrown'])).toBeCloseTo(124, 10);
    expect(applyRelicHooks('onDamageComputed', 100, { rotStacks: 5 }, ['sporecrown'])).toBeCloseTo(140, 10);
    expect(applyRelicHooks('onDamageComputed', 100, { rotStacks: 9 }, ['sporecrown'])).toBeCloseTo(140, 10); // cap 5
  });

  it('Heartrot Seed (also-chain): +2 base regen plus +1 per rot stack, capped at 6', () => {
    expect(turnStartRegen(['heartrot-seed'], RELIC_REGISTRY, { rotStacks: 0 })).toBe(2);
    expect(turnStartRegen(['heartrot-seed'], RELIC_REGISTRY, { rotStacks: 3 })).toBe(5); // 2 + 3
    expect(turnStartRegen(['heartrot-seed'], RELIC_REGISTRY, { rotStacks: 10 })).toBe(8); // 2 + min(6,10)
    // Outside the Rotwood (no rot context) ⇒ degrades to a flat +2/turn.
    expect(turnStartRegen(['heartrot-seed'])).toBe(2);
  });
});

describe('scalers — maxHpFraction chip (Marrow of the Colossus)', () => {
  it('rends 12% of the enemy max HP and heals 10 (its two onCombatStart channels)', () => {
    expect(applyRelicHooks('onCombatStart', 0, { kind: 'enemyChip', enemyMaxHp: 150 }, ['marrow-of-the-colossus'])).toBeCloseTo(18, 10);
    expect(applyRelicHooks('onCombatStart', 0, { kind: 'playerHeal' }, ['marrow-of-the-colossus'])).toBeCloseTo(10, 10);
    // Threaded through the combat-start helper.
    expect(combatStartEnemyChip(['marrow-of-the-colossus'], RELIC_REGISTRY, 150)).toBe(18);
    expect(combatStartPlayerHeal(['marrow-of-the-colossus'])).toBe(10);
    // With no enemyMaxHp in context the fraction chip is inert (0), not a crash.
    expect(combatStartEnemyChip(['marrow-of-the-colossus'])).toBe(0);
  });
});

describe('also-chain (two modifiers on one hook)', () => {
  it('Bellows Heart: Red ×2 and Blue ×0.5 on onDamageComputed', () => {
    expect(applyRelicHooks('onDamageComputed', 10, { color: 'R' }, ['bellows-heart'])).toBeCloseTo(20, 10);
    expect(applyRelicHooks('onDamageComputed', 10, { color: 'B' }, ['bellows-heart'])).toBeCloseTo(5, 10);
    expect(applyRelicHooks('onDamageComputed', 10, { color: 'G' }, ['bellows-heart'])).toBeCloseTo(10, 10);
  });
});

// ── canonical-schema validator ───────────────────────────────────────────────────────────────
describe('assertRelicWellFormed — rejects typo\'d hooks / kinds / ops', () => {
  const bad = (hooks: unknown): Relic => ({ id: 'x', name: 'X', flavor: '.', tier: 'common', hooks: hooks as Relic['hooks'] });

  it('accepts every roster relic (spot-check a legendary with an also-chain)', () => {
    expect(() => assertRelicWellFormed(RELIC_REGISTRY['bellows-heart'])).not.toThrow();
    expect(() => assertRelicWellFormed(RELIC_REGISTRY['marrow-of-the-colossus'])).not.toThrow();
  });

  it('throws on an unknown hook name', () => {
    expect(() => assertRelicWellFormed(bad({ onBogusHook: { op: 'add', amount: 1 } }))).toThrow(/unknown hook/);
  });

  it('throws on an unknown (non-canonical) kind spelling', () => {
    // 'waveHeal' was canonicalized to 'playerHeal' — the old spelling must be rejected.
    expect(() => assertRelicWellFormed(bad({ onCascadeWave: { op: 'add', amount: 1, kind: 'waveHeal' } }))).toThrow(/unknown kind/);
  });

  it('throws on an unknown op and a bad color, incl. inside an also-chain', () => {
    expect(() => assertRelicWellFormed(bad({ onDamageComputed: { op: 'div', amount: 1 } }))).toThrow(/unknown op/);
    expect(() => assertRelicWellFormed(bad({ onDamageComputed: { op: 'mul', amount: 1, color: 'Z' } }))).toThrow(/unknown color/);
    expect(() =>
      assertRelicWellFormed(bad({ onDamageComputed: { op: 'mul', amount: 1, color: 'R', also: { op: 'mul', amount: 1, kind: 'bogus' } } })),
    ).toThrow(/unknown kind/);
  });

  it('throws on out-of-range condition/scaler values and a non-finite amount', () => {
    expect(() => assertRelicWellFormed(bad({ onDamageComputed: { op: 'add', amount: Number.NaN } }))).toThrow(/non-finite/);
    expect(() => assertRelicWellFormed(bad({ onDamageComputed: { op: 'add', amount: 1, comboThreshold: 0 } }))).toThrow(/comboThreshold/);
    expect(() => assertRelicWellFormed(bad({ onDamageComputed: { op: 'add', amount: 1, comboThreshold: 2.5 } }))).toThrow(/comboThreshold/);
    expect(() => assertRelicWellFormed(bad({ onTurnStart: { op: 'add', amount: 1, kind: 'regen', playerHpBelow: 1.5 } }))).toThrow(/playerHpBelow/);
    expect(() => assertRelicWellFormed(bad({ onDamageComputed: { op: 'mul', amount: 1, perRotStack: true, rotStackCap: 0 } }))).toThrow(/rotStackCap/);
    expect(() => assertRelicWellFormed(bad({ onCombatStart: { op: 'add', amount: 0, kind: 'enemyChip', maxHpFraction: 2 } }))).toThrow(/maxHpFraction/);
    expect(() => assertRelicWellFormed({ id: '', name: 'X', flavor: '.', tier: 'common', hooks: {} })).toThrow(/id/);
  });
});
