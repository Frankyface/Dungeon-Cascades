/**
 * The start-selection view-model (Stage 4 meta): vanilla is always the first, available, default
 * card; variants are selectable exactly when earned and otherwise shown LOCKED with unlock progress;
 * and each variant's modifier summary is derived from its engine modifiers (reusing relic effect
 * text). These tests pin that mapping so the selection screen stays a thin renderer.
 */
import {
  INITIAL_META_STATE,
  UNLOCK_TRANCHES,
  bankRun,
  getRelic,
  getVariant,
  selectableStarts,
} from '../../engine/run';
import type { MetaState } from '../../engine/run';
import {
  VANILLA_START_NAME,
  describeVariantModifiers,
  startCards,
} from './variantPresentation';

/** A profile at exactly `score` with its earned unlocks applied (via the engine). */
function metaAtScore(score: number): MetaState {
  return bankRun(INITIAL_META_STATE, score);
}

describe('startCards — card list shape', () => {
  it('puts vanilla first: available, default, no modifiers, no lock', () => {
    const [first] = startCards(INITIAL_META_STATE);
    expect(first.variantId).toBeNull();
    expect(first.name).toBe(VANILLA_START_NAME);
    expect(first.isDefault).toBe(true);
    expect(first.locked).toBe(false);
    expect(first.modifiers).toHaveLength(0);
    expect(first.progress).toBeNull();
  });

  it('renders vanilla + every variant (one card each), in canonical order', () => {
    const cards = startCards(INITIAL_META_STATE);
    expect(cards).toHaveLength(1 + UNLOCK_TRANCHES.length);
    expect(cards.slice(1).map((c) => c.variantId)).toEqual(UNLOCK_TRANCHES.map((t) => t.variantId));
  });

  it('locks every variant on a fresh profile (only vanilla is selectable)', () => {
    const cards = startCards(INITIAL_META_STATE);
    expect(cards.filter((c) => !c.locked).map((c) => c.variantId)).toEqual([null]);
  });
});

describe('startCards — selectability tracks the engine', () => {
  it('the non-locked card ids always equal selectableStarts(meta)', () => {
    for (const score of [0, 50, 120, 300, 999]) {
      const meta = metaAtScore(score);
      const selectableFromCards = startCards(meta)
        .filter((c) => !c.locked)
        .map((c) => c.variantId);
      expect(selectableFromCards).toEqual([...selectableStarts(meta)]);
    }
  });

  it('unlocks the first-tranche variant once its score is reached', () => {
    const t1 = UNLOCK_TRANCHES[0];
    const card = startCards(metaAtScore(t1.score)).find((c) => c.variantId === t1.variantId);
    expect(card?.locked).toBe(false);
    expect(card?.progress).toBeNull(); // unlocked cards carry no progress meter
  });
});

describe('startCards — locked cards carry unlock progress', () => {
  it('reports "Score current/required" and the remaining gap for a locked variant', () => {
    const t1 = UNLOCK_TRANCHES[0]; // required = 50
    const meta = metaAtScore(30); // below the first tranche
    const card = startCards(meta).find((c) => c.variantId === t1.variantId);

    expect(card?.locked).toBe(true);
    expect(card?.progress).toEqual({
      current: 30,
      required: t1.score,
      remaining: t1.score - 30,
      label: `Score 30/${t1.score}`,
    });
  });

  it('never reports a negative remaining gap', () => {
    // A high-but-not-yet-unlocking score for a later tranche still floors remaining at 0 boundary.
    const last = UNLOCK_TRANCHES[UNLOCK_TRANCHES.length - 1];
    const card = startCards(metaAtScore(last.score - 1)).find((c) => c.variantId === last.variantId);
    expect(card?.progress?.remaining).toBe(1);
  });
});

describe('describeVariantModifiers — derived from engine modifiers', () => {
  it('summarizes a relic-granting variant (relic effect reused, plus its max-HP cost)', () => {
    const lines = describeVariantModifiers(getVariant('ember-start').modifiers);
    expect(lines).toEqual([
      { kind: 'relic', label: getRelic('emberfang').name, detail: '+50% Red damage', tone: 'boon' },
      { kind: 'maxHp', label: '-12 max HP', detail: null, tone: 'bane' },
    ]);
  });

  it('summarizes the gold-loan variant (gold boon, max-HP bane)', () => {
    const lines = describeVariantModifiers(getVariant('merchants-purse').modifiers);
    expect(lines).toEqual([
      { kind: 'gold', label: '+55 starting gold', detail: null, tone: 'boon' },
      { kind: 'maxHp', label: '-5 max HP', detail: null, tone: 'bane' },
    ]);
  });

  it('summarizes the map-reveal variant (max-HP cost, then the reveal aid)', () => {
    const lines = describeVariantModifiers(getVariant('cartographer').modifiers);
    expect(lines).toEqual([
      { kind: 'maxHp', label: '-4 max HP', detail: null, tone: 'bane' },
      { kind: 'map', label: 'Full map revealed', detail: null, tone: 'boon' },
    ]);
  });

  it('produces a non-empty, well-formed summary for every shipped variant', () => {
    for (const t of UNLOCK_TRANCHES) {
      const lines = describeVariantModifiers(getVariant(t.variantId).modifiers);
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line.label.length).toBeGreaterThan(0);
      }
    }
  });
});
