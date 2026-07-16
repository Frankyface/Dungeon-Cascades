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
import { applyRest } from './rest';
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

  const result = buyShopItem(phase.shop, index, state.gold);
  if (!result.ok) {
    return { state, result };
  }

  let relicIds = state.relicIds;
  let playerHp = state.playerHp;
  if (result.item.kind === 'relic') {
    relicIds = applyDraft(relicIds, result.item.relicId);
  } else {
    playerHp = Math.min(state.playerMaxHp, playerHp + result.item.heal);
  }

  return {
    state: {
      ...state,
      gold: state.gold - result.goldSpent,
      relicIds,
      playerHp,
      phase: { kind: 'shop', shop: result.shop },
    },
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

/** Rest at the current site: heal 30% of max (once), then STAY (only leaving remains legal). */
export function restAtNode(state: RunState): RunState {
  assertRunActive(state);
  assertRunPhase(state, 'rest');
  const phase = state.phase;
  if (phase.kind !== 'rest') throw new Error('unreachable');

  const rested = applyRest(phase.rest, state.playerHp, state.playerMaxHp); // throws on a 2nd rest
  return { ...state, playerHp: rested.hp, phase: { kind: 'rest', rest: rested.state } };
}

/** Leave the rest site (rested or not) — advance to the move-choice phase. */
export function leaveRest(state: RunState): RunState {
  assertRunActive(state);
  assertRunPhase(state, 'rest');
  return { ...state, phase: { kind: 'awaiting_move' } };
}
