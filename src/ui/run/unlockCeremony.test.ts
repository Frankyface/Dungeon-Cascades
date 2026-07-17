/**
 * The unlock-ceremony view-model: each engine `UnlockEvent` becomes exactly one celebratory card,
 * relic events carry their full relic card, headline filtering drops the quiet discoveries, and the
 * discovery tally counts enemies vs bosses. Events are built from the real engine derivations so the
 * mapping is checked against live registry data.
 */
import { BIOME_LEGENDARY_RELIC, getBiome } from '../../engine/run';
import type { UnlockEvent } from '../../engine/run';
import { ceremonyCards, discoveryCounts, headlineCeremonies } from './unlockCeremony';

describe('ceremonyCards', () => {
  it('maps a biome unlock to a biome-tone card naming the biome', () => {
    const events: UnlockEvent[] = [{ kind: 'biome', biomeId: 'rotwood' }];
    const [card] = ceremonyCards(events);
    expect(card.tone).toBe('biome');
    expect(card.subtitle).toContain(getBiome('rotwood').name);
    expect(card.relic).toBeNull();
  });

  it('maps a relic unlock to a legendary card carrying the relic card', () => {
    const relicId = BIOME_LEGENDARY_RELIC.rotwood!;
    const events: UnlockEvent[] = [{ kind: 'relic', relicId, source: 'biome' }];
    const [card] = ceremonyCards(events);
    expect(card.tone).toBe('legendary');
    expect(card.relic).not.toBeNull();
    expect(card.relic!.id).toBe(relicId);
    expect(card.title).toContain('Biome Relic');
  });

  it('phrases an altar relic unlock by its source', () => {
    const events: UnlockEvent[] = [{ kind: 'relic', relicId: BIOME_LEGENDARY_RELIC.emberworks!, source: 'altar' }];
    expect(ceremonyCards(events)[0].title).toContain('Relic Unlocked');
  });

  it('maps enemy / boss discovery, boss-rush and god-of-war events to their tones', () => {
    const events: UnlockEvent[] = [
      { kind: 'enemyDiscovered', enemyId: 'permafrost-warden' },
      { kind: 'bossDiscovered', bossId: 'rimeheart' },
      { kind: 'bossRushUnlocked' },
      { kind: 'godOfWarUnlocked' },
    ];
    const cards = ceremonyCards(events);
    expect(cards.map((c) => c.tone)).toEqual(['discovery', 'discovery', 'mode', 'prestige']);
    expect(cards[0].subtitle).toBe('Permafrost Warden');
    expect(cards[1].subtitle).toContain('Rimeheart');
  });

  it('gives every card a unique key', () => {
    const events: UnlockEvent[] = [
      { kind: 'enemyDiscovered', enemyId: 'slime' },
      { kind: 'enemyDiscovered', enemyId: 'bat' },
      { kind: 'biome', biomeId: 'glacial-crypt' },
    ];
    const keys = ceremonyCards(events).map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('headlineCeremonies / discoveryCounts', () => {
  const events: UnlockEvent[] = [
    { kind: 'biome', biomeId: 'rotwood' },
    { kind: 'relic', relicId: BIOME_LEGENDARY_RELIC.rotwood!, source: 'biome' },
    { kind: 'enemyDiscovered', enemyId: 'mirebark-hulk' },
    { kind: 'enemyDiscovered', enemyId: 'rotgrub-swarm' },
    { kind: 'bossDiscovered', bossId: 'the-rotmother' },
  ];

  it('keeps biome + relic headlines and drops the discoveries', () => {
    const heads = headlineCeremonies(events);
    expect(heads.map((c) => c.tone)).toEqual(['biome', 'legendary']);
  });

  it('tallies enemy and boss discoveries separately', () => {
    expect(discoveryCounts(events)).toEqual({ enemies: 2, bosses: 1, total: 3 });
  });

  it('reports zeroes for an empty event list', () => {
    expect(discoveryCounts([])).toEqual({ enemies: 0, bosses: 0, total: 0 });
    expect(headlineCeremonies([])).toEqual([]);
  });
});
