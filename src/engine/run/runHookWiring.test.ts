/**
 * Wave-1c hook-SITE wiring proofs: the run-layer relic hooks (unit-tested as pure folds in
 * relicHooksExpansion.test.ts) actually FIRE where the flow invokes them —
 *   • onEnemyDefeated  → a combat win (playEncounterTurn),
 *   • onCascadeWave gold → banked once at the run layer per turn (never double-applied in combat),
 *   • onActStart       → advanceAct (the act transition),
 *   • onRestUsed       → restAtNode,
 *   • onShopPurchase   → buyFromShop.
 * Each is proved by a WITH-relic vs WITHOUT-relic delta (the rest of the transcript is identical),
 * mirroring the combatIntegration headline-gate style. Owning a locked expansion relic id is legal
 * at the flow layer (locking only filters DRAFT/SHOP offers), so these craft `relicIds` directly.
 */
import { startRun, enterNode, playEncounterTurn, advanceAct } from './runFlow';
import { buyFromShop, restAtNode } from './runNodes';
import { greedyComboPath } from './runPolicy';
import { cascadeWaveGold } from './relicHooks';
import type { NodeType } from './mapTypes';
import type { RunState } from './runTypes';

/** Craft a run positioned at the first Act-1 node of `type`. */
function craftAt(seed: number, type: NodeType, overrides: Partial<RunState> = {}): RunState {
  const base = startRun(seed);
  const node = base.map.nodes.find((n) => n.type === type);
  if (!node) throw new Error(`no ${type} node for seed ${seed}`);
  return { ...base, mapState: { currentNodeId: node.id, visited: [node.id] }, ...overrides };
}

/** Enter a fight, force the enemy to 1 HP, then land the greedy killing move. */
function winFightWith(relicIds: readonly string[], playerHp: number): RunState {
  const entered = enterNode(craftAt(3, 'fight', { relicIds, playerHp, gold: 0 }));
  if (entered.phase.kind !== 'combat') throw new Error('expected combat');
  const oneHp: RunState = {
    ...entered,
    phase: { ...entered.phase, encounter: { ...entered.phase.encounter, enemyHp: 1 } },
  };
  const path = greedyComboPath(oneHp.phase.kind === 'combat' ? oneHp.phase.encounter.board : entered.phase.encounter.board);
  return playEncounterTurn(oneHp, path).state;
}

describe('onEnemyDefeated fires on a combat win (playEncounterTurn)', () => {
  it('banks the bonus gold + capped heal by EXACTLY the relic amounts (rest of the win identical)', () => {
    // gravekeepers-due: +3 gold on defeat; vulture-feather: +3 heal on defeat. Neither touches
    // combat, so the killing move (and its performance gold) is identical with vs without them.
    const without = winFightWith([], 30);
    const withRelics = winFightWith(['gravekeepers-due', 'vulture-feather'], 30);
    expect(withRelics.gold - without.gold).toBe(3); // exactly gravekeepers-due
    expect(withRelics.playerHp - without.playerHp).toBe(3); // exactly vulture-feather (not capped at 30)
  });

  it('the defeat heal is capped at max HP', () => {
    const withRelic = winFightWith(['vulture-feather'], 60); // already full
    const without = winFightWith([], 60);
    expect(withRelic.playerHp).toBe(without.playerHp); // +3 heal capped away at full HP
  });
});

describe('onCascadeWave GOLD is banked once at the run layer, never double-applied in combat', () => {
  it('prospectors-lens gold delta equals cascadeWaveGold(waves); combat resolution is untouched', () => {
    // Drive a fight in lockstep with vs without a GOLD-only cascade relic. Its combat seam returns
    // {enemyDamage:0, playerHeal:0}, so every move is byte-identical; the ONLY difference is the
    // gold the run layer banks = cascadeWaveGold(that move's wave count).
    let withS: RunState = enterNode(craftAt(3, 'fight', { relicIds: ['prospectors-lens'], gold: 0 }));
    let noS: RunState = enterNode(craftAt(3, 'fight', { relicIds: [], gold: 0 }));
    let expectedGold = 0;
    let sawMultiWave = false;
    let guard = 0;
    while (withS.phase.kind === 'combat' && noS.phase.kind === 'combat' && guard++ < 60) {
      const path = greedyComboPath(noS.phase.encounter.board);
      const wR = playEncounterTurn(withS, path);
      const nR = playEncounterTurn(noS, path);
      const waves = nR.resolution.move.waves.length;
      if (waves >= 2) sawMultiWave = true;
      expectedGold += cascadeWaveGold(waves, ['prospectors-lens']);
      // Combat is byte-identical (gold is NOT a combat channel).
      expect(wR.resolution.move).toEqual(nR.resolution.move);
      expect(wR.resolution.enemyHpAfter).toBe(nR.resolution.enemyHpAfter);
      expect(wR.resolution.playerHpAfter).toBe(nR.resolution.playerHpAfter);
      // The running gold gap is exactly the banked cascade gold so far (banked once, at the run layer).
      expect(wR.state.gold - nR.state.gold).toBe(expectedGold);
      withS = wR.state;
      noS = nR.state;
    }
    expect(sawMultiWave).toBe(true); // the fixture actually exercised a multi-wave (gold-bearing) move
    expect(expectedGold).toBeGreaterThan(0);
  });

  it('tremor-stone applies its enemy-damage channel IN combat but banks NO gold at the run layer', () => {
    const s = enterNode(craftAt(3, 'fight', { relicIds: [], gold: 0 }));
    const t = enterNode(craftAt(3, 'fight', { relicIds: ['tremor-stone'], gold: 0 }));
    if (s.phase.kind !== 'combat' || t.phase.kind !== 'combat') throw new Error('combat');
    // Find a multi-wave move so tremor-stone's per-wave enemy damage is non-zero.
    let cur = s;
    let curT = t;
    let guard = 0;
    let proved = false;
    while (cur.phase.kind === 'combat' && curT.phase.kind === 'combat' && guard++ < 60 && !proved) {
      const path = greedyComboPath(cur.phase.encounter.board);
      const nR = playEncounterTurn(cur, path);
      const tR = playEncounterTurn(curT, path);
      if (nR.resolution.move.waves.length >= 2) {
        // Enemy took MORE damage with tremor-stone (its enemyDamage channel fired in combat)…
        expect(tR.resolution.enemyHpAfter).toBeLessThan(nR.resolution.enemyHpAfter);
        // …but NO gold was banked (tremor-stone has no gold channel).
        expect(tR.state.gold).toBe(nR.state.gold);
        proved = true;
      }
      cur = nR.state;
      curT = tR.state;
    }
    expect(proved).toBe(true);
  });
});

describe('onActStart fires in advanceAct (the act transition)', () => {
  it('banks the onActStart gold + capped heal on top of the transition heal', () => {
    // Base transition: heal 50% of max. pathfinders-map: +20 gold; wayfarers-draught: +12 heal.
    const base: RunState = { ...startRun(42), playerHp: 5, gold: 0, phase: { kind: 'act_transition' } };
    const plain = advanceAct(base);
    const withRelics = advanceAct({ ...base, relicIds: ['pathfinders-map', 'wayfarers-draught'] });
    expect(withRelics.gold - plain.gold).toBe(20); // pathfinders-map
    expect(withRelics.playerHp - plain.playerHp).toBe(12); // wayfarers-draught (5 + 30 + 12 = 47, uncapped)
  });
});

describe('onRestUsed fires in restAtNode', () => {
  it('restHeal VALUE-TRANSFORM: Wanderer\'s Hearth doubles the node heal, Ascetic\'s Vow zeroes it', () => {
    const at = (relicIds: string[]) => restAtNode(enterNode(craftAt(42, 'rest', { relicIds, playerHp: 0 })));
    expect(at([]).playerHp).toBe(18); // base 30% of 60 = 18
    expect(at(['wanderers-hearth']).playerHp).toBe(36); // 18 × 2
    expect(at(['ascetics-vow']).playerHp).toBe(0); // 18 × 0
  });

  it('side-channels: bonus heal (Bedroll) + bonus gold (Traveler\'s Tithe) on top of the base heal', () => {
    const s = restAtNode(enterNode(craftAt(42, 'rest', { relicIds: ['bedroll-talisman', 'travelers-tithe'], playerHp: 0, gold: 0 })));
    expect(s.playerHp).toBe(26); // base 18 + bedroll 8
    expect(s.gold).toBe(12); // travelers-tithe
  });
});

describe('onShopPurchase fires in buyFromShop', () => {
  it('price VALUE-TRANSFORM (Haggler\'s Charm ×0.60) decides affordability and the amount paid', () => {
    const shopState = (relicIds: string[], gold: number) => {
      const s = enterNode(craftAt(42, 'shop', { relicIds, gold }));
      if (s.phase.kind !== 'shop') throw new Error('shop');
      const relicIdx = s.phase.shop.items.findIndex((i) => i.kind === 'relic');
      return { s, relicIdx };
    };
    // A common relic stickers at 45. With 30 gold you cannot afford it — unless Haggler's Charm
    // shaves it to round(45 × 0.60) = 27.
    const plain = shopState([], 30);
    expect(buyFromShop(plain.s, plain.relicIdx).result.ok).toBe(false); // 30 < 45 sticker

    const haggle = shopState(['hagglers-charm'], 30);
    const bought = buyFromShop(haggle.s, haggle.relicIdx);
    expect(bought.result.ok).toBe(true);
    expect(bought.state.gold).toBe(3); // 30 − 27 discounted price
  });

  it('side-channels: gold rebate (Haggler\'s Chit) + capped heal (Almsgiver\'s Token) per purchase', () => {
    const s = enterNode(craftAt(42, 'shop', { relicIds: ['hagglers-chit', 'almsgivers-token'], gold: 100, playerHp: 20 }));
    if (s.phase.kind !== 'shop') throw new Error('shop');
    const relicIdx = s.phase.shop.items.findIndex((i) => i.kind === 'relic');
    const price = s.phase.shop.items[relicIdx].price;
    const bought = buyFromShop(s, relicIdx);
    expect(bought.result.ok).toBe(true);
    expect(bought.state.gold).toBe(100 - price + 5); // sticker price paid, +5 chit rebate
    expect(bought.state.playerHp).toBe(26); // 20 + 6 almsgiver heal
  });
});
