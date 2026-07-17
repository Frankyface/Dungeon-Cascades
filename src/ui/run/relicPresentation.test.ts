import { ROSTER } from '../../engine/run';
import { describeRelic, relicCard, relicCards } from './relicPresentation';

describe('describeRelic — derived effect text', () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ['emberfang', '+50% Red damage'],
    ['verdant-idol', '+50% Green damage'],
    ['tidecaller-pearl', '+50% Blue damage'],
    ['sunspike-medallion', '+50% Yellow damage'],
    ['rowan-chalice', '+50% healing'],
    ['cascade-sigil', '+6% damage per extra combo'],
    ['misers-knuckle', '+25% gold'],
    ['bulwark-rune', 'Reduce incoming damage by 2'],
    ['ambushers-cowl', 'Enemies start with 10 less HP'],
    ['phoenix-feather', 'Start each fight +8 HP'],
    ['second-wind', 'Heal 1 HP each turn'],
    ['whetstone-charm', '+2 flat damage'],
  ];

  it.each(cases)('%s → "%s"', (id, expected) => {
    expect(relicCard(id).effect).toBe(expected);
  });
});

describe('relicCard / relicCards', () => {
  it('carries the relic identity, flavor and tier', () => {
    const card = relicCard('cascade-sigil');
    expect(card.name).toBe('Cascade Sigil');
    expect(card.tier).toBe('epic');
    expect(card.flavor.length).toBeGreaterThan(0);
  });

  it('produces a non-empty effect line for every relic in the roster', () => {
    for (const relic of ROSTER) {
      expect(describeRelic(relic).length).toBeGreaterThan(0);
    }
  });

  it('maps a list of ids to cards preserving order', () => {
    const cards = relicCards(['emberfang', 'bulwark-rune']);
    expect(cards.map((c) => c.id)).toEqual(['emberfang', 'bulwark-rune']);
  });
});
