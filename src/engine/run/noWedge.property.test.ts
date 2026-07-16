/**
 * No-wedge property (feature-economy-nodes.md): in ANY reachable non-combat state, every node
 * offers ≥1 legal action, so a run can never wedge in an economy node. We fuzz the economy
 * phases (shop with arbitrary gold + arbitrary sold-out pattern, every scripted event, rested
 * or not) and every move-choice position, and assert `legalActions` is always non-empty. The
 * only empty action set is the terminal `ended` phase — which is correct.
 */
import fc from 'fast-check';
import { createRng } from '../board';
import { startRun, enterNode } from './runFlow';
import { legalActions } from './runTypes';
import type { RunPhase, RunState } from './runTypes';
import { RELIC_IDS } from './relics';
import { generateShop, shopHasLegalAction } from './shop';
import type { ShopState } from './shop';
import { EVENT_IDS, eventHasLegalAction } from './events';

/** Craft a run in `phase` (map/nav context comes from a real generated run). */
function withPhase(seed: number, phase: RunPhase, gold = 0): RunState {
  return { ...startRun(seed), gold, phase };
}

describe('no-wedge: every economy node always offers ≥1 legal action', () => {
  it('SHOP — any gold, any sold-out pattern still allows at least leaving', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 2_000_000 }),
        fc.subarray([...RELIC_IDS]),
        fc.nat({ max: 5000 }),
        fc.nat({ max: 255 }),
        (seed, owned, gold, soldMask) => {
          const { shop } = generateShop(owned, createRng(seed));
          // Apply an arbitrary sold-out pattern.
          const mutated: ShopState = { items: shop.items.map((it, i) => ({ ...it, sold: ((soldMask >> i) & 1) === 1 })) };
          const actions = legalActions(withPhase(seed, { kind: 'shop', shop: mutated }, gold));
          expect(actions.length).toBeGreaterThanOrEqual(1);
          expect(actions.some((a) => a.type === 'shop_leave')).toBe(true);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('EVENT — every scripted event offers all its choices (≥2)', () => {
    for (const eventId of EVENT_IDS) {
      const actions = legalActions(withPhase(1, { kind: 'event', eventId, rngState: createRng(1) }));
      expect(actions.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('REST — rested or not, at least one action remains', () => {
    for (const rested of [false, true]) {
      const actions = legalActions(withPhase(1, { kind: 'rest', rest: { rested } }));
      expect(actions.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('MOVE-CHOICE — every non-boss node has ≥1 legal next node', () => {
    fc.assert(
      fc.property(fc.nat({ max: 2_000_000 }), (seed) => {
        const base = startRun(seed);
        const nonBoss = base.map.nodes.filter((n) => n.type !== 'boss');
        for (const node of nonBoss) {
          const s: RunState = { ...base, mapState: { currentNodeId: node.id, visited: [node.id] }, phase: { kind: 'awaiting_move' } };
          expect(legalActions(s).length).toBeGreaterThanOrEqual(1);
        }
      }),
      { numRuns: 60 },
    );
  });

  it('AWAITING-NODE and COMBAT always have an action; ENDED is the only empty set', () => {
    expect(legalActions(startRun(1)).length).toBeGreaterThanOrEqual(1); // awaiting_node
    // A real combat phase always yields exactly one 'play_turn' marker (a board always drags).
    expect(legalActions(enterNode(startRun(1))).length).toBe(1);
    expect(legalActions({ ...startRun(1), status: 'defeat', phase: { kind: 'ended' } }).length).toBe(0);
  });

  it('the shop / event legal-action predicates are unconditionally true', () => {
    expect(shopHasLegalAction()).toBe(true);
    expect(eventHasLegalAction()).toBe(true);
  });
});
