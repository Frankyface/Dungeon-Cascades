/**
 * Registry-FIDELITY tests for the Stage-6 relic expansion (wave 1b). This is the transcription
 * check: every relic's tier, unlock gate, and EXACT per-hook modifiers are pinned against a
 * hand-transcribed table sourced from content-relics.md — a number/kind typo in the roster is a
 * test failure, not a silent balance drift. Plus the rarity ledger, duplicate-id guard, the
 * unlocked-by-default set, and the every-relic-validates gate.
 */
import { ROSTER, RELIC_IDS, RELIC_REGISTRY, UNLOCKED_BY_DEFAULT_IDS, assertRelicWellFormed, getRelic } from './relics';
import type { Relic, RelicTier } from './relicTypes';

interface Expected {
  readonly id: string;
  readonly tier: RelicTier;
  readonly unlocked: boolean;
  readonly hooks: Relic['hooks'];
}

/** The whole roster, hand-transcribed from content-relics.md (base 12 + 76 expansion). */
const EXPECTED: readonly Expected[] = [
  // ── Base 12 (unlockedByDefault) ──
  { id: 'emberfang', tier: 'common', unlocked: true, hooks: { onDamageComputed: { op: 'mul', amount: 0.5, color: 'R' } } },
  { id: 'verdant-idol', tier: 'common', unlocked: true, hooks: { onDamageComputed: { op: 'mul', amount: 0.5, color: 'G' } } },
  { id: 'tidecaller-pearl', tier: 'common', unlocked: true, hooks: { onDamageComputed: { op: 'mul', amount: 0.5, color: 'B' } } },
  { id: 'sunspike-medallion', tier: 'common', unlocked: true, hooks: { onDamageComputed: { op: 'mul', amount: 0.5, color: 'Y' } } },
  { id: 'rowan-chalice', tier: 'common', unlocked: true, hooks: { onHealComputed: { op: 'mul', amount: 0.5 } } },
  { id: 'cascade-sigil', tier: 'epic', unlocked: true, hooks: { onDamageComputed: { op: 'mul', amount: 0.06, perCombo: true } } },
  { id: 'misers-knuckle', tier: 'common', unlocked: true, hooks: { onGoldEarned: { op: 'mul', amount: 0.25 } } },
  { id: 'bulwark-rune', tier: 'common', unlocked: true, hooks: { onIncomingDamage: { op: 'add', amount: -2 } } },
  { id: 'ambushers-cowl', tier: 'epic', unlocked: true, hooks: { onCombatStart: { op: 'add', amount: 10, kind: 'enemyChip' } } },
  { id: 'phoenix-feather', tier: 'epic', unlocked: true, hooks: { onCombatStart: { op: 'add', amount: 8, kind: 'playerHeal' } } },
  { id: 'second-wind', tier: 'common', unlocked: true, hooks: { onTurnStart: { op: 'add', amount: 1, kind: 'regen' } } },
  { id: 'whetstone-charm', tier: 'common', unlocked: true, hooks: { onDamageComputed: { op: 'add', amount: 2 } } },

  // ── Expansion COMMON (40) ──
  { id: 'cinderbrand-nail', tier: 'common', unlocked: false, hooks: { onDamageComputed: { op: 'add', amount: 3, color: 'R' } } },
  { id: 'thornmaw-fetish', tier: 'common', unlocked: false, hooks: { onDamageComputed: { op: 'add', amount: 3, color: 'G' } } },
  { id: 'frostglass-shard', tier: 'common', unlocked: false, hooks: { onDamageComputed: { op: 'add', amount: 3, color: 'B' } } },
  { id: 'gilded-fulgurite', tier: 'common', unlocked: false, hooks: { onDamageComputed: { op: 'add', amount: 3, color: 'Y' } } },
  { id: 'emberflow-chain', tier: 'common', unlocked: false, hooks: { onDamageComputed: { op: 'add', amount: 1, color: 'R', perCombo: true } } },
  { id: 'bramblewind-chain', tier: 'common', unlocked: false, hooks: { onDamageComputed: { op: 'add', amount: 1, color: 'G', perCombo: true } } },
  { id: 'undertow-chain', tier: 'common', unlocked: false, hooks: { onDamageComputed: { op: 'add', amount: 1, color: 'B', perCombo: true } } },
  { id: 'solar-chain', tier: 'common', unlocked: false, hooks: { onDamageComputed: { op: 'add', amount: 1, color: 'Y', perCombo: true } } },
  { id: 'magma-seal', tier: 'common', unlocked: false, hooks: { onDamageComputed: { op: 'add', amount: 4, color: 'R', comboThreshold: 3 } } },
  { id: 'moss-seal', tier: 'common', unlocked: false, hooks: { onDamageComputed: { op: 'add', amount: 4, color: 'G', comboThreshold: 3 } } },
  { id: 'rime-seal', tier: 'common', unlocked: false, hooks: { onDamageComputed: { op: 'add', amount: 4, color: 'B', comboThreshold: 3 } } },
  { id: 'dawn-seal', tier: 'common', unlocked: false, hooks: { onDamageComputed: { op: 'add', amount: 4, color: 'Y', comboThreshold: 3 } } },
  { id: 'groundswell-totem', tier: 'common', unlocked: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.1, comboThreshold: 3 } } },
  { id: 'avalanche-totem', tier: 'common', unlocked: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.15, comboThreshold: 4 } } },
  { id: 'tectonic-idol', tier: 'common', unlocked: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.25, comboThreshold: 5 } } },
  { id: 'cataclysm-bead', tier: 'common', unlocked: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.35, comboThreshold: 6 } } },
  { id: 'rockslide-idol', tier: 'common', unlocked: false, hooks: { onDamageComputed: { op: 'add', amount: 2, comboThreshold: 3 } } },
  { id: 'faultline-charm', tier: 'common', unlocked: false, hooks: { onDamageComputed: { op: 'add', amount: 5, comboThreshold: 5 } } },
  { id: 'sunder-charm', tier: 'common', unlocked: false, hooks: { onDamageComputed: { op: 'add', amount: 8, comboThreshold: 6 } } },
  { id: 'tremor-stone', tier: 'common', unlocked: false, hooks: { onCascadeWave: { op: 'add', amount: 1, kind: 'enemyDamage' } } },
  { id: 'springwater-charm', tier: 'common', unlocked: false, hooks: { onCascadeWave: { op: 'add', amount: 1, kind: 'playerHeal' } } },
  { id: 'prospectors-lens', tier: 'common', unlocked: false, hooks: { onCascadeWave: { op: 'add', amount: 1, kind: 'gold' } } },
  { id: 'dewleaf-poultice', tier: 'common', unlocked: false, hooks: { onHealComputed: { op: 'add', amount: 2 } } },
  { id: 'wellspring-locket', tier: 'common', unlocked: false, hooks: { onHealComputed: { op: 'add', amount: 1, perCombo: true } } },
  { id: 'font-of-renewal', tier: 'common', unlocked: false, hooks: { onHealComputed: { op: 'mul', amount: 0.25, comboThreshold: 4 } } },
  { id: 'verdant-balm', tier: 'common', unlocked: false, hooks: { onHealComputed: { op: 'add', amount: 3, comboThreshold: 3 } } },
  { id: 'coinpurse-charm', tier: 'common', unlocked: false, hooks: { onGoldEarned: { op: 'add', amount: 3 } } },
  { id: 'gravekeepers-due', tier: 'common', unlocked: false, hooks: { onEnemyDefeated: { op: 'add', amount: 3, kind: 'gold' } } },
  { id: 'hagglers-chit', tier: 'common', unlocked: false, hooks: { onShopPurchase: { op: 'add', amount: 5, kind: 'gold' } } },
  { id: 'travelers-tithe', tier: 'common', unlocked: false, hooks: { onRestUsed: { op: 'add', amount: 12, kind: 'gold' } } },
  { id: 'pathfinders-map', tier: 'common', unlocked: false, hooks: { onActStart: { op: 'add', amount: 20, kind: 'gold' } } },
  { id: 'vulture-feather', tier: 'common', unlocked: false, hooks: { onEnemyDefeated: { op: 'add', amount: 3, kind: 'playerHeal' } } },
  { id: 'bedroll-talisman', tier: 'common', unlocked: false, hooks: { onRestUsed: { op: 'add', amount: 8, kind: 'playerHeal' } } },
  { id: 'wayfarers-draught', tier: 'common', unlocked: false, hooks: { onActStart: { op: 'add', amount: 12, kind: 'playerHeal' } } },
  { id: 'almsgivers-token', tier: 'common', unlocked: false, hooks: { onShopPurchase: { op: 'add', amount: 6, kind: 'playerHeal' } } },
  { id: 'skirmishers-dart', tier: 'common', unlocked: false, hooks: { onCombatStart: { op: 'add', amount: 5, kind: 'enemyChip' } } },
  { id: 'travelers-ration', tier: 'common', unlocked: false, hooks: { onCombatStart: { op: 'add', amount: 4, kind: 'playerHeal' } } },
  { id: 'aegis-scale', tier: 'common', unlocked: false, hooks: { onIncomingDamage: { op: 'mul', amount: -0.15 } } },
  { id: 'trollblood-charm', tier: 'common', unlocked: false, hooks: { onTurnStart: { op: 'add', amount: 3, kind: 'regen', playerHpBelow: 0.5 } } },
  { id: 'chain-link-charm', tier: 'common', unlocked: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.03, perCombo: true } } },

  // ── Expansion EPIC (22) ──
  { id: 'avalanche-crown', tier: 'epic', unlocked: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.55, comboThreshold: 5 }, onIncomingDamage: { op: 'add', amount: 2 } } },
  { id: 'chain-fed-ruin', tier: 'epic', unlocked: false, hooks: { onCascadeWave: { op: 'add', amount: 3, kind: 'enemyDamage' }, onDamageComputed: { op: 'mul', amount: -0.15 } } },
  { id: 'deepening-spiral', tier: 'epic', unlocked: false, hooks: { onHealComputed: { op: 'mul', amount: 0.09, perCombo: true }, onGoldEarned: { op: 'mul', amount: -0.2 } } },
  { id: 'berserkers-bargain', tier: 'epic', unlocked: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.45 }, onIncomingDamage: { op: 'add', amount: 3 } } },
  { id: 'bloodless-edge', tier: 'epic', unlocked: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.35 }, onHealComputed: { op: 'mul', amount: -1 } } },
  { id: 'misers-ruin', tier: 'epic', unlocked: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.4 }, onGoldEarned: { op: 'mul', amount: -1 } } },
  { id: 'ironroot-aegis', tier: 'epic', unlocked: false, hooks: { onIncomingDamage: { op: 'add', amount: -5 }, onDamageComputed: { op: 'mul', amount: -0.15 } } },
  { id: 'counterweight-sigil', tier: 'epic', unlocked: false, hooks: { onIncomingDamage: { op: 'mul', amount: -0.3 }, onDamageComputed: { op: 'mul', amount: 0.25, comboThreshold: 4 }, onGoldEarned: { op: 'mul', amount: -0.2 } } },
  { id: 'hagglers-charm', tier: 'epic', unlocked: false, hooks: { onShopPurchase: { op: 'mul', amount: -0.4, kind: 'price' }, onGoldEarned: { op: 'mul', amount: -0.15 } } },
  { id: 'toll-of-plenty', tier: 'epic', unlocked: false, hooks: { onEnemyDefeated: { op: 'add', amount: 12, kind: 'gold' }, onIncomingDamage: { op: 'add', amount: 1 } } },
  { id: 'wanderers-hearth', tier: 'epic', unlocked: false, hooks: { onRestUsed: { op: 'mul', amount: 1, kind: 'restHeal' }, onIncomingDamage: { op: 'add', amount: 2 } } },
  { id: 'ascetics-vow', tier: 'epic', unlocked: false, hooks: { onRestUsed: { op: 'mul', amount: -1, kind: 'restHeal' }, onDamageComputed: { op: 'mul', amount: 0.25 } } },
  { id: 'second-dawn', tier: 'epic', unlocked: false, hooks: { onActStart: { op: 'add', amount: 30, kind: 'playerHeal' }, onGoldEarned: { op: 'mul', amount: -0.2 } } },
  { id: 'crescendo-idol', tier: 'epic', unlocked: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.6, comboThreshold: 6 }, onIncomingDamage: { op: 'add', amount: 2 } } },
  { id: 'reapers-tally', tier: 'epic', unlocked: false, hooks: { onEnemyDefeated: { op: 'add', amount: 15, kind: 'gold' }, onHealComputed: { op: 'mul', amount: -0.25 } } },
  { id: 'harvest-of-souls', tier: 'epic', unlocked: false, hooks: { onEnemyDefeated: { op: 'add', amount: 15, kind: 'playerHeal' }, onHealComputed: { op: 'mul', amount: -0.4 } } },
  { id: 'wavecrash-totem', tier: 'epic', unlocked: false, hooks: { onCascadeWave: { op: 'add', amount: 2, kind: 'playerHeal' }, onHealComputed: { op: 'mul', amount: -0.25 } } },
  { id: 'tidal-coffers', tier: 'epic', unlocked: false, hooks: { onCascadeWave: { op: 'add', amount: 2, kind: 'gold' }, onDamageComputed: { op: 'mul', amount: -0.1 } } },
  { id: 'emberspiral-torc', tier: 'epic', unlocked: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.12, color: 'R', perCombo: true }, onHealComputed: { op: 'mul', amount: -0.2 } } },
  { id: 'prism-overcharge', tier: 'epic', unlocked: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.3 }, onHealComputed: { op: 'mul', amount: -0.3 } } },
  { id: 'zenith-chalice', tier: 'epic', unlocked: false, hooks: { onHealComputed: { op: 'mul', amount: 0.6, comboThreshold: 4 }, onDamageComputed: { op: 'add', amount: -2 } } },
  { id: 'heralds-gambit', tier: 'epic', unlocked: false, hooks: { onCombatStart: { op: 'add', amount: 18, kind: 'enemyChip' }, onHealComputed: { op: 'mul', amount: -0.2 } } },

  // ── Expansion LEGENDARY (14) — biome/boss (8) + designer (6) ──
  { id: 'rimebound-sigil', tier: 'legendary', unlocked: false, hooks: { onDamageComputed: { op: 'mul', amount: 1, color: 'B', comboThreshold: 4 } } },
  { id: 'rimeheart-shard', tier: 'legendary', unlocked: false, hooks: { onIncomingDamage: { op: 'mul', amount: -0.3 }, onDamageComputed: { op: 'mul', amount: 0.3, color: 'B' } } },
  { id: 'bellows-heart', tier: 'legendary', unlocked: false, hooks: { onDamageComputed: { op: 'mul', amount: 1, color: 'R', also: { op: 'mul', amount: -0.5, color: 'B' } } } },
  { id: 'forgeheart-ember', tier: 'legendary', unlocked: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.75, color: 'R' }, onIncomingDamage: { op: 'add', amount: 2 } } },
  { id: 'heartrot-seed', tier: 'legendary', unlocked: false, hooks: { onTurnStart: { op: 'add', amount: 2, kind: 'regen', also: { op: 'add', amount: 1, kind: 'regen', perRotStack: true, rotStackCap: 6 } } } },
  { id: 'sporecrown', tier: 'legendary', unlocked: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.08, perRotStack: true, rotStackCap: 5 } } },
  { id: 'maelstrom-pearl', tier: 'legendary', unlocked: false, hooks: { onCascadeWave: { op: 'add', amount: 3, kind: 'playerHeal', also: { op: 'add', amount: 3, kind: 'gold' } } } },
  { id: 'crown-of-the-drowned-sovereign', tier: 'legendary', unlocked: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.12, color: 'B', perCombo: true }, onCombatStart: { op: 'add', amount: 12, kind: 'enemyChip' } } },
  { id: 'bloodstone-altar', tier: 'legendary', unlocked: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.75 }, onIncomingDamage: { op: 'mul', amount: 0.6 } } },
  { id: 'avalanche-core', tier: 'legendary', unlocked: false, hooks: { onCascadeWave: { op: 'add', amount: 2, kind: 'enemyDamage', perWaveIndex: true } } },
  { id: 'gravebound-tithe', tier: 'legendary', unlocked: false, hooks: { onEnemyDefeated: { op: 'add', amount: 12, kind: 'playerHeal', also: { op: 'add', amount: 20, kind: 'gold' } } } },
  { id: 'thornheart-reliquary', tier: 'legendary', unlocked: false, hooks: { onHealComputed: { op: 'mul', amount: 0.5 }, onCombatStart: { op: 'add', amount: 15, kind: 'enemyChip' } } },
  { id: 'crescendo-crown', tier: 'legendary', unlocked: false, hooks: { onDamageComputed: { op: 'mul', amount: 1, comboThreshold: 4 } } },
  { id: 'marrow-of-the-colossus', tier: 'legendary', unlocked: false, hooks: { onCombatStart: { op: 'add', amount: 0, kind: 'enemyChip', maxHpFraction: 0.12, also: { op: 'add', amount: 10, kind: 'playerHeal' } } } },
];

describe('relic registry — transcription fidelity', () => {
  it('the expected table names exactly the 88 roster ids (no missing / extra / mis-ordered)', () => {
    expect(EXPECTED.map((e) => e.id)).toEqual([...RELIC_IDS]);
  });

  it.each(EXPECTED.map((e) => [e.id, e] as const))('%s matches its exact spec (tier, unlock, hooks)', (_id, e) => {
    const r = getRelic(e.id);
    expect(r.tier).toBe(e.tier);
    expect(r.unlockedByDefault).toBe(e.unlocked);
    expect(r.hooks).toEqual(e.hooks);
  });
});

describe('relic registry — rarity ledger (post-migration)', () => {
  it('is 49 common / 25 epic / 14 legendary = 88 total', () => {
    const count = (tier: RelicTier): number => ROSTER.filter((r) => r.tier === tier).length;
    expect(count('common')).toBe(49); // 9 base + 40 expansion
    expect(count('epic')).toBe(25); //   3 base + 22 expansion
    expect(count('legendary')).toBe(14); // 0 base + 14 expansion
    expect(ROSTER).toHaveLength(88);
  });

  it('splits new-vs-base as the migration note describes', () => {
    const newRelics = ROSTER.filter((r) => r.unlockedByDefault !== true);
    const base = ROSTER.filter((r) => r.unlockedByDefault === true);
    expect(base).toHaveLength(12);
    expect(newRelics).toHaveLength(76);
    expect(newRelics.filter((r) => r.tier === 'common')).toHaveLength(40);
    expect(newRelics.filter((r) => r.tier === 'epic')).toHaveLength(22);
    expect(newRelics.filter((r) => r.tier === 'legendary')).toHaveLength(14);
  });
});

describe('relic registry — integrity', () => {
  it('has no duplicate ids', () => {
    expect(new Set(RELIC_IDS).size).toBe(RELIC_IDS.length);
    expect(RELIC_IDS).toHaveLength(88);
  });

  it('every relic validates against the canonical schema', () => {
    for (const relic of ROSTER) {
      expect(() => assertRelicWellFormed(relic)).not.toThrow();
    }
  });

  it('the unlocked-by-default set is exactly the base 12, in canonical order', () => {
    expect(UNLOCKED_BY_DEFAULT_IDS).toEqual([
      'emberfang',
      'verdant-idol',
      'tidecaller-pearl',
      'sunspike-medallion',
      'rowan-chalice',
      'cascade-sigil',
      'misers-knuckle',
      'bulwark-rune',
      'ambushers-cowl',
      'phoenix-feather',
      'second-wind',
      'whetstone-charm',
    ]);
    // Every unlocked-by-default id resolves and is flagged true; every other relic is locked.
    for (const r of ROSTER) {
      const shouldBeUnlocked = UNLOCKED_BY_DEFAULT_IDS.includes(r.id);
      expect(r.unlockedByDefault === true).toBe(shouldBeUnlocked);
    }
  });

  it('every registry entry equals its roster object (id → relic)', () => {
    for (const relic of ROSTER) {
      expect(RELIC_REGISTRY[relic.id]).toBe(relic);
    }
  });
});
