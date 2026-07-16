/**
 * Starting-variant tests: the run-start modifier data model, its pure resolution, and the
 * hard "vanilla is byte-identical to today" contract that protects every existing run test.
 */
import { startRun } from './runFlow';
import {
  VARIANTS,
  VARIANT_IDS,
  VARIANT_REGISTRY,
  MIN_VARIANT_MAX_HP,
  getVariant,
  resolveVariantStart,
  assertVariantsWellFormed,
} from './variants';
import { RUN_PLAYER_MAX_HP } from './runConfig';
import { STARTING_GOLD } from './economyConfig';
import { getRelic } from './relics';

describe('variant roster — integrity', () => {
  it('ships exactly six well-formed variants with unique ids and valid start relics', () => {
    expect(VARIANTS).toHaveLength(6);
    expect(VARIANT_IDS).toHaveLength(6);
    expect(new Set(VARIANT_IDS).size).toBe(6); // unique
    expect(() => assertVariantsWellFormed()).not.toThrow();
  });

  it('every start relic referenced by a variant is a real roster relic', () => {
    for (const v of VARIANTS) {
      for (const id of v.modifiers.startRelicIds ?? []) {
        expect(() => getRelic(id)).not.toThrow();
      }
    }
  });

  it('the registry maps every id to its variant, and getVariant throws on an unknown id', () => {
    for (const id of VARIANT_IDS) expect(VARIANT_REGISTRY[id].id).toBe(id);
    expect(getVariant('ember-start').name).toBe('Ember Start');
    expect(() => getVariant('nope')).toThrow(/unknown variant id/i);
  });

  it('rejects a malformed variant slate (unknown start relic)', () => {
    expect(() =>
      assertVariantsWellFormed([
        { id: 'x', name: 'X', flavor: '', modifiers: { startRelicIds: ['not-a-relic'] } },
      ]),
    ).toThrow(/unknown relic/i);
  });

  it('rejects a duplicated start relic within one variant', () => {
    expect(() =>
      assertVariantsWellFormed([
        { id: 'x', name: 'X', flavor: '', modifiers: { startRelicIds: ['emberfang', 'emberfang'] } },
      ]),
    ).toThrow(/repeats start relic/i);
  });
});

describe('resolveVariantStart — pure modifier folding', () => {
  it('applies max-HP, gold, and start-relic deltas over a vanilla base', () => {
    const r = resolveVariantStart(60, 0, [], { maxHpDelta: -6, goldDelta: 55, startRelicIds: ['emberfang'] });
    expect(r.maxHp).toBe(54);
    expect(r.gold).toBe(55);
    expect(r.relicIds).toEqual(['emberfang']);
  });

  it('floors max HP at MIN_VARIANT_MAX_HP and gold at 0 (aggressive downside is safe)', () => {
    const r = resolveVariantStart(60, 0, [], { maxHpDelta: -1000, goldDelta: -1000 });
    expect(r.maxHp).toBe(MIN_VARIANT_MAX_HP);
    expect(r.gold).toBe(0);
  });

  it('never double-adds a start relic the run already owns', () => {
    const r = resolveVariantStart(60, 0, ['emberfang'], { startRelicIds: ['emberfang'] });
    expect(r.relicIds).toEqual(['emberfang']);
  });

  it('validates start relic ids (throws on a typo)', () => {
    expect(() => resolveVariantStart(60, 0, [], { startRelicIds: ['nope'] })).toThrow(/unknown relic/i);
  });

  it('is a no-op when the variant carries no modifiers', () => {
    const r = resolveVariantStart(60, 0, [], {});
    expect(r).toEqual({ maxHp: 60, gold: 0, relicIds: [] });
  });
});

describe('startRun — vanilla is byte-identical to a pre-variant start', () => {
  it('omits the variantId field entirely for a vanilla run', () => {
    const s = startRun(42);
    expect('variantId' in s).toBe(false);
    expect(s.playerMaxHp).toBe(RUN_PLAYER_MAX_HP);
    expect(s.playerHp).toBe(RUN_PLAYER_MAX_HP);
    expect(s.gold).toBe(STARTING_GOLD);
    expect(s.relicIds).toEqual([]);
  });

  it('serializes byte-for-byte identically across two vanilla starts of the same seed', () => {
    expect(JSON.stringify(startRun(42))).toBe(JSON.stringify(startRun(42)));
  });
});

describe('startRun — applying a variant reshapes only the initial state', () => {
  it('Ember Start: grants emberfang and trims max HP; run begins at full (trimmed) HP', () => {
    const s = startRun(42, 'ember-start');
    expect(s.variantId).toBe('ember-start');
    expect(s.playerMaxHp).toBe(48); // 60 − 12
    expect(s.playerHp).toBe(48); // full pool
    expect(s.relicIds).toEqual(['emberfang']);
    expect(s.gold).toBe(0);
    // The map, position, phase, and status are untouched vs vanilla (same seed ⇒ same map).
    expect(s.map).toEqual(startRun(42).map);
    expect(s.phase.kind).toBe('awaiting_node');
    expect(s.status).toBe('active');
  });

  it("Merchant's Purse: banks starting gold and trims max HP", () => {
    const s = startRun(42, 'merchants-purse');
    expect(s.gold).toBe(55);
    expect(s.playerMaxHp).toBe(55); // 60 − 5
    expect(s.relicIds).toEqual([]);
  });

  it('Glass Cannon: a strong relic for a steep HP cost', () => {
    const s = startRun(42, 'glass-cannon');
    expect(s.relicIds).toEqual(['cascade-sigil']);
    expect(s.playerMaxHp).toBe(42); // 60 − 18
    expect(s.playerHp).toBe(42);
  });

  it('Cartographer: the revealMap flag is NOT stored on RunState (UI reads it from the variant)', () => {
    const s = startRun(42, 'cartographer');
    expect(s.variantId).toBe('cartographer');
    expect('revealMap' in s).toBe(false);
    expect(getVariant('cartographer').modifiers.revealMap).toBe(true);
    expect(s.playerMaxHp).toBe(56); // 60 − 4
  });

  it('throws on an unknown variant id', () => {
    expect(() => startRun(42, 'not-a-variant')).toThrow(/unknown variant id/i);
  });

  it('a variant run differs from vanilla but shares the seed-derived map', () => {
    const vanilla = startRun(7);
    const variant = startRun(7, 'glass-cannon');
    expect(variant).not.toEqual(vanilla);
    expect(variant.map).toEqual(vanilla.map); // same seed ⇒ same generated map
    expect(variant.seed).toBe(vanilla.seed);
  });
});
