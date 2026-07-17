/**
 * The non-combat NODE actions of the run flow: shop (buy / leave), event (choose), and rest
 * (rest / leave). Split from runFlow.ts so each file stays cohesive and small. Every action is
 * pure, requires an active run, and is guarded to its phase; each leaves the player able to
 * proceed (buying stays in the shop; leaving/choosing/resting advances to the move phase) so a
 * non-combat node can never wedge a run.
 *
 * PURE ENGINE: no React / React Native imports; deterministic; never mutates input.
 */
import { applyDraft } from './draft';
import { buyShopItem } from './shop';
import type { BuyResult } from './shop';
import { resolveEventChoice, applyEventEffect } from './events';
import {
  restHealAmount,
  restUsedPlayerHeal,
  restUsedGold,
  shopPrice,
  shopPurchaseGold,
  shopPurchasePlayerHeal,
} from './relicHooks';
import { REST_HEAL_FRACTION } from './economyConfig';
import { assertRunActive, assertRunPhase } from './runTypes';
import type { RunState } from './runTypes';

/** The result of a shop buy: the new run state plus the (possibly rejected) buy outcome. */
export interface ShopBuyResult {
  readonly state: RunState;
  readonly result: BuyResult;
}

/**
 * Buy shop slot `index`. On success: deduct gold, grant the item (relic → owned set; heal →
 * player HP, capped), mark the slot sold, and STAY in the shop (buy more). A rejection (broke,
 * sold-out, bad index) leaves the run untouched; the reason is returned for the UI.
 */
export function buyFromShop(state: RunState, index: number): ShopBuyResult {
  assertRunActive(state);
  assertRunPhase(state, 'shop');
  const phase = state.phase;
  if (phase.kind !== 'shop') throw new Error('unreachable');

  // Validate the slot (range + not-sold) with an unlimited-gold probe, so the `onShopPurchase`
  // price VALUE-TRANSFORM decides affordability — not the sticker (Haggler's Charm ×0.60 must let
  // you afford the discounted price). With no shop relic the transform is identity, so this stays
  // byte-identical to the pre-hook buy.
  const probe = buyShopItem(phase.shop, index, Number.POSITIVE_INFINITY);
  if (!probe.ok) {
    return { state, result: probe };
  }
  const effectivePrice = shopPrice(probe.item.price, state.relicIds);
  if (state.gold < effectivePrice) {
    return { state, result: { ok: false, reason: 'insufficient-gold' } };
  }

  // Grant the item, plus the `onShopPurchase` side-channels: a capped bonus heal and a gold rebate.
  let relicIds = state.relicIds;
  let playerHp = Math.min(state.playerMaxHp, state.playerHp + shopPurchasePlayerHeal(state.relicIds));
  if (probe.item.kind === 'relic') {
    relicIds = applyDraft(relicIds, probe.item.relicId);
  } else {
    playerHp = Math.min(state.playerMaxHp, playerHp + probe.item.heal);
  }
  const gold = state.gold - effectivePrice + shopPurchaseGold(state.relicIds);
  const result: BuyResult = { ok: true, shop: probe.shop, item: probe.item, goldSpent: effectivePrice };

  return {
    state: { ...state, gold, relicIds, playerHp, phase: { kind: 'shop', shop: probe.shop } },
    result,
  };
}

/** Leave the shop (always legal) — advance to the move-choice phase. */
export function leaveShop(state: RunState): RunState {
  assertRunActive(state);
  assertRunPhase(state, 'shop');
  return { ...state, phase: { kind: 'awaiting_move' } };
}

/**
 * Resolve the current event by picking choice `choiceIndex`: roll any gamble, apply the deltas
 * (gold floored at 0, HP clamped so events never kill, a relic reward added), then advance to
 * the move-choice phase. Throws on an out-of-range choice.
 */
export function chooseEventOption(state: RunState, choiceIndex: number): RunState {
  assertRunActive(state);
  assertRunPhase(state, 'event');
  const phase = state.phase;
  if (phase.kind !== 'event') throw new Error('unreachable');

  const { effect } = resolveEventChoice(phase.eventId, choiceIndex, phase.rngState, state.relicIds);
  const applied = applyEventEffect(effect, {
    gold: state.gold,
    hp: state.playerHp,
    maxHp: state.playerMaxHp,
    relicIds: state.relicIds,
  });
  return {
    ...state,
    gold: applied.gold,
    playerHp: applied.hp,
    relicIds: applied.relicIds,
    phase: { kind: 'awaiting_move' },
  };
}

/**
 * Rest at the current site (single-use): heal the node's base `REST_HEAL_FRACTION` of max HP, then
 * STAY (only leaving remains legal). The `onRestUsed` relic hooks layer on: `restHeal` VALUE-TRANSFORMS
 * the node's own heal (Wanderer's Hearth ×2, Ascetic's Vow ×0), then the `playerHeal` side-channel adds
 * on top (both capped at max), and the `gold` side-channel banks bonus gold. With no rest relic all
 * three are identity/zero, so the base 30%-of-max rest is byte-identical to before.
 */
export function restAtNode(state: RunState): RunState {
  assertRunActive(state);
  assertRunPhase(state, 'rest');
  const phase = state.phase;
  if (phase.kind !== 'rest') throw new Error('unreachable');
  if (phase.rest.rested) {
    throw new Error('restAtNode: already rested at this site (single-use per node)');
  }

  const baseHeal = Math.round(state.playerMaxHp * REST_HEAL_FRACTION);
  const nodeHeal = restHealAmount(baseHeal, state.relicIds); // value-transform of the node's own heal
  const playerHp = Math.min(state.playerMaxHp, state.playerHp + nodeHeal + restUsedPlayerHeal(state.relicIds));
  const gold = state.gold + restUsedGold(state.relicIds);
  return { ...state, playerHp, gold, phase: { kind: 'rest', rest: { rested: true } } };
}

/** Leave the rest site (rested or not) — advance to the move-choice phase. */
export function leaveRest(state: RunState): RunState {
  assertRunActive(state);
  assertRunPhase(state, 'rest');
  return { ...state, phase: { kind: 'awaiting_move' } };
}
