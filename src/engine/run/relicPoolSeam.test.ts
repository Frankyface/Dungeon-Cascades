/**
 * Locked-pool SEAM (Stage-6 wave 1b groundwork). The 76 expansion relics start locked; draft and
 * shop pools must NEVER surface them until an explicit `unlockedIds` filter admits them (wave 2
 * wires the real meta state). These tests pin: (a) the default pool is exactly the base-12
 * unlocked-by-default set, so the run stays byte-identical; (b) a locked relic can be admitted by
 * passing it in `unlockedIds`.
 */
import { createRng } from '../board';
import { draftOptions } from './draft';
import { generateShop } from './shop';
import { startRun, enterNode } from './runFlow';
import { RELIC_IDS, UNLOCKED_BY_DEFAULT_IDS } from './relics';

const LOCKED_IDS = RELIC_IDS.filter((id) => !UNLOCKED_BY_DEFAULT_IDS.includes(id));

describe('pool seam — locked relics excluded by default', () => {
  it('there are 76 locked expansion relics and 12 unlocked-by-default', () => {
    expect(LOCKED_IDS).toHaveLength(76);
    expect(UNLOCKED_BY_DEFAULT_IDS).toHaveLength(12);
  });

  it('draftOptions default pool is the unlocked set only (across many seeds)', () => {
    for (let seed = 0; seed < 200; seed++) {
      const { options } = draftOptions([], createRng(seed), 'common');
      for (const id of options) {
        expect(UNLOCKED_BY_DEFAULT_IDS).toContain(id);
        expect(LOCKED_IDS).not.toContain(id);
      }
    }
  });

  it('draftOptions offers nothing once all unlocked relics are owned (locked never backfill)', () => {
    const { options } = draftOptions([...UNLOCKED_BY_DEFAULT_IDS], createRng(3), 'common');
    expect(options).toHaveLength(0);
  });

  it('generateShop default stock excludes locked relics (across many seeds)', () => {
    for (let seed = 0; seed < 200; seed++) {
      const { shop } = generateShop([], createRng(seed));
      for (const item of shop.items) {
        if (item.kind === 'relic') {
          expect(UNLOCKED_BY_DEFAULT_IDS).toContain(item.relicId);
          expect(LOCKED_IDS).not.toContain(item.relicId);
        }
      }
    }
  });
});

describe('pool seam — explicit unlockedIds admits a specific locked relic', () => {
  it('draftOptions can offer a newly-unlocked legendary', () => {
    const unlocked = [...UNLOCKED_BY_DEFAULT_IDS, 'crescendo-crown'];
    // Own all base 12 so the ONLY draftable relic is the newly-unlocked one.
    const { options } = draftOptions([...UNLOCKED_BY_DEFAULT_IDS], createRng(1), 'legendary', unlocked);
    expect(options).toEqual(['crescendo-crown']);
  });

  it('generateShop can stock a newly-unlocked legendary', () => {
    const unlocked = [...UNLOCKED_BY_DEFAULT_IDS, 'bloodstone-altar'];
    const { shop } = generateShop([...UNLOCKED_BY_DEFAULT_IDS], createRng(5), unlocked);
    const relicIds = shop.items.filter((i) => i.kind === 'relic').map((i) => (i.kind === 'relic' ? i.relicId : ''));
    for (const id of relicIds) {
      expect(id).toBe('bloodstone-altar');
    }
    expect(shop.items.some((i) => i.kind === 'heal')).toBe(true);
  });
});

describe('pool seam LIVE — the RunState snapshot flows through startRun → enterNode (wave 2)', () => {
  it('a run whose snapshot admits an expansion relic stocks it in the shop (owning the base 12)', () => {
    const unlocked = [...UNLOCKED_BY_DEFAULT_IDS, 'bloodstone-altar'];
    const base = startRun(9, undefined, unlocked);
    expect(base.unlockedRelicIds).toEqual(unlocked);
    const shopNode = base.map.nodes.find((n) => n.type === 'shop');
    expect(shopNode).toBeDefined();
    // Own the base 12 so the ONLY unowned+unlocked relic is the snapshot's expansion relic.
    const atShop: typeof base = {
      ...base,
      relicIds: [...UNLOCKED_BY_DEFAULT_IDS],
      mapState: { currentNodeId: shopNode!.id, visited: [shopNode!.id] },
    };
    const entered = enterNode(atShop);
    if (entered.phase.kind !== 'shop') throw new Error('expected a shop phase');
    const relicIds = entered.phase.shop.items
      .filter((i) => i.kind === 'relic')
      .map((i) => (i.kind === 'relic' ? i.relicId : ''));
    for (const id of relicIds) expect(id).toBe('bloodstone-altar');
  });

  it('a run with NO snapshot stocks only base-12 relics (byte-identical default)', () => {
    const base = startRun(9); // no snapshot ⇒ pools default to the base 12
    expect('unlockedRelicIds' in base).toBe(false);
    const shopNode = base.map.nodes.find((n) => n.type === 'shop')!;
    const atShop: typeof base = { ...base, mapState: { currentNodeId: shopNode.id, visited: [shopNode.id] } };
    const entered = enterNode(atShop);
    if (entered.phase.kind !== 'shop') throw new Error('expected a shop phase');
    for (const item of entered.phase.shop.items) {
      if (item.kind === 'relic') expect(UNLOCKED_BY_DEFAULT_IDS).toContain(item.relicId);
    }
  });
});
