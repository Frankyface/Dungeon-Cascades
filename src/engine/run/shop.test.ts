/**
 * Shop fixtures: seeded stock (2–3 unowned relics + 1 instant-heal item), config prices,
 * and a buy/reject/leave state machine. Buying deducts gold, grants the item, marks the
 * slot sold; insufficient gold is rejected (not thrown); leaving is always legal.
 */
import { createRng } from '../board';
import {
  SHOP_HEAL_AMOUNT,
  SHOP_HEAL_PRICE,
  SHOP_PRICE_ELITE,
  SHOP_PRICE_NORMAL,
  SHOP_RELIC_MAX,
  SHOP_RELIC_MIN,
} from './economyConfig';
import { buyShopItem, generateShop, shopHasLegalAction } from './shop';

describe('generateShop — seeded stock', () => {
  it('stocks 2–3 unowned relics + exactly one heal item, all priced from config', () => {
    const { shop } = generateShop([], createRng(42));
    const relics = shop.items.filter((i) => i.kind === 'relic');
    const heals = shop.items.filter((i) => i.kind === 'heal');

    expect(relics.length).toBeGreaterThanOrEqual(SHOP_RELIC_MIN);
    expect(relics.length).toBeLessThanOrEqual(SHOP_RELIC_MAX);
    expect(heals).toHaveLength(1);

    for (const item of relics) {
      expect([SHOP_PRICE_NORMAL, SHOP_PRICE_ELITE]).toContain(item.price);
      expect(item.sold).toBe(false);
    }
    expect(heals[0].price).toBe(SHOP_HEAL_PRICE);
    expect(heals[0].kind === 'heal' && heals[0].heal).toBe(SHOP_HEAL_AMOUNT);
  });

  it('never stocks an owned relic', () => {
    const owned = ['emberfang', 'verdant-idol', 'tidecaller-pearl'];
    const { shop } = generateShop(owned, createRng(7));
    for (const item of shop.items) {
      if (item.kind === 'relic') expect(owned).not.toContain(item.relicId);
    }
  });

  it('is deterministic for a given seed + owned set', () => {
    const a = generateShop(['emberfang'], createRng(99)).shop;
    const b = generateShop(['emberfang'], createRng(99)).shop;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('prices relics by tier (normal 45 / elite 70)', () => {
    const { shop } = generateShop([], createRng(3));
    for (const item of shop.items) {
      if (item.kind === 'relic' && item.tier === 'elite') expect(item.price).toBe(SHOP_PRICE_ELITE);
      if (item.kind === 'relic' && item.tier === 'normal') expect(item.price).toBe(SHOP_PRICE_NORMAL);
    }
  });
});

describe('buyShopItem — buy/reject state machine', () => {
  it('buys an affordable item: deducts gold, marks it sold, reports the item', () => {
    const { shop } = generateShop([], createRng(42));
    const idx = shop.items.findIndex((i) => i.kind === 'heal');
    const result = buyShopItem(shop, idx, 100);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.goldSpent).toBe(SHOP_HEAL_PRICE);
    expect(result.shop.items[idx].sold).toBe(true);
    expect(result.item.kind).toBe('heal');
    // Other slots untouched (immutable update).
    expect(result.shop.items.filter((i) => i.sold)).toHaveLength(1);
  });

  it('rejects an unaffordable buy without throwing (insufficient gold)', () => {
    const { shop } = generateShop([], createRng(42));
    const idx = shop.items.findIndex((i) => i.kind === 'relic');
    const result = buyShopItem(shop, idx, 0);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected rejection');
    expect(result.reason).toBe('insufficient-gold');
  });

  it('rejects re-buying an already-sold slot', () => {
    const { shop } = generateShop([], createRng(42));
    const idx = shop.items.findIndex((i) => i.kind === 'heal');
    const bought = buyShopItem(shop, idx, 100);
    if (!bought.ok) throw new Error('expected ok');
    const again = buyShopItem(bought.shop, idx, 100);
    expect(again.ok).toBe(false);
    if (again.ok) throw new Error('expected rejection');
    expect(again.reason).toBe('already-sold');
  });

  it('rejects an out-of-range index', () => {
    const { shop } = generateShop([], createRng(42));
    const result = buyShopItem(shop, 999, 100);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected rejection');
    expect(result.reason).toBe('out-of-range');
  });
});

describe('shopHasLegalAction — leaving is always legal (no wedge)', () => {
  it('is true even when broke and every slot is sold (leave still counts)', () => {
    let { shop } = generateShop([], createRng(42));
    // Sell out everything the (rich) player can, then go broke.
    shop = { items: shop.items.map((i) => ({ ...i, sold: true })) };
    expect(shopHasLegalAction()).toBe(true);
  });
});
