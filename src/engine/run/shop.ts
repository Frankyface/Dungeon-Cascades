/**
 * The shop node: convert gold into relics / healing. A shop stocks a seeded 2–3 unowned
 * relics plus one instant-heal item, priced from economyConfig. The buy/reject/leave state
 * machine is pure: `buyShopItem` returns a discriminated result (never throws on a rejected
 * buy — insufficient gold / sold-out / bad index are expected outcomes, not boundary bugs),
 * and leaving is ALWAYS legal (`shopHasLegalAction`), so a shop can never wedge a run.
 *
 * PURE ENGINE: no React / React Native imports; deterministic; never mutates input.
 */
import { nextFloat, nextInt } from '../board';
import type { RngState } from '../board';
import { RELIC_IDS, RELIC_REGISTRY, getRelic } from './relics';
import type { RelicRegistry, RelicTier } from './relicTypes';
import {
  SHOP_HEAL_AMOUNT,
  SHOP_HEAL_PRICE,
  SHOP_PRICE_ELITE,
  SHOP_PRICE_NORMAL,
  SHOP_RELIC_MAX,
  SHOP_RELIC_MIN,
} from './economyConfig';

/** One stocked relic slot. */
export interface ShopRelicItem {
  readonly kind: 'relic';
  readonly relicId: string;
  readonly tier: RelicTier;
  readonly price: number;
  readonly sold: boolean;
}

/** The single instant-heal slot. */
export interface ShopHealItem {
  readonly kind: 'heal';
  readonly heal: number;
  readonly price: number;
  readonly sold: boolean;
}

export type ShopItem = ShopRelicItem | ShopHealItem;

/** Serializable shop state: the ordered stock (relics first, heal last). */
export interface ShopState {
  readonly items: readonly ShopItem[];
}

/** The result of generating a shop: its state plus the advanced RNG. */
export interface ShopGenResult {
  readonly shop: ShopState;
  readonly rngState: RngState;
}

/** Relic price for a tier (config). */
function priceForTier(tier: RelicTier): number {
  return tier === 'elite' ? SHOP_PRICE_ELITE : SHOP_PRICE_NORMAL;
}

/**
 * Generate a shop: roll a stock size in [SHOP_RELIC_MIN, SHOP_RELIC_MAX], sample that many
 * DISTINCT unowned relics (uniform, without replacement, canonical order for determinism),
 * then append the heal item. If the unowned pool is smaller than the rolled size it stocks
 * what remains (graceful degradation — the heal item is always present, so leaving/buying
 * heal stays possible). Threads `rngState`; deterministic.
 */
export function generateShop(
  ownedRelicIds: readonly string[],
  rngState: RngState,
  registry: RelicRegistry = RELIC_REGISTRY,
): ShopGenResult {
  const owned = new Set(ownedRelicIds);
  const pool = (registry === RELIC_REGISTRY ? RELIC_IDS : Object.keys(registry)).filter((id) => !owned.has(id));

  // Roll the stock size, then clamp to the available pool.
  const span = SHOP_RELIC_MAX - SHOP_RELIC_MIN + 1;
  const sizeRoll = nextInt(rngState, span);
  let state = sizeRoll.state;
  const targetSize = Math.min(SHOP_RELIC_MIN + sizeRoll.value, pool.length);

  const remaining = [...pool];
  const relicItems: ShopRelicItem[] = [];
  for (let n = 0; n < targetSize; n++) {
    const pick = nextFloat(state);
    state = pick.state;
    const idx = Math.min(remaining.length - 1, Math.floor(pick.value * remaining.length));
    const relicId = remaining[idx];
    remaining.splice(idx, 1);
    const tier = getRelic(relicId, registry).tier;
    relicItems.push({ kind: 'relic', relicId, tier, price: priceForTier(tier), sold: false });
  }

  const heal: ShopHealItem = { kind: 'heal', heal: SHOP_HEAL_AMOUNT, price: SHOP_HEAL_PRICE, sold: false };
  return { shop: { items: [...relicItems, heal] }, rngState: state };
}

/** Why a buy was rejected. */
export type BuyRejection = 'out-of-range' | 'already-sold' | 'insufficient-gold';

/** The outcome of attempting to buy a shop slot. */
export type BuyResult =
  | { readonly ok: true; readonly shop: ShopState; readonly item: ShopItem; readonly goldSpent: number }
  | { readonly ok: false; readonly reason: BuyRejection };

/**
 * Attempt to buy slot `index` with `gold` on hand. On success returns a NEW shop with that
 * slot marked sold, the bought item, and the gold spent (the caller deducts gold and grants
 * the item — relic to the owned set, heal to the player's HP). Rejections are returned, not
 * thrown: buying is an optional, fallible player action, never a wedge.
 */
export function buyShopItem(shop: ShopState, index: number, gold: number): BuyResult {
  if (index < 0 || index >= shop.items.length) {
    return { ok: false, reason: 'out-of-range' };
  }
  const item = shop.items[index];
  if (item.sold) {
    return { ok: false, reason: 'already-sold' };
  }
  if (gold < item.price) {
    return { ok: false, reason: 'insufficient-gold' };
  }
  const items = shop.items.map((it, i) => (i === index ? { ...it, sold: true } : it));
  return { ok: true, shop: { items }, item, goldSpent: item.price };
}

/**
 * Whether a shop offers at least one legal action. Always true — LEAVING a shop is always
 * legal regardless of gold or stock, so a shop node can never wedge a run. (A parameterless
 * predicate documents the invariant and anchors the no-wedge property test.)
 */
export function shopHasLegalAction(): boolean {
  return true;
}
