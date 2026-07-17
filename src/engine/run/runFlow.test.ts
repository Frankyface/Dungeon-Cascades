/**
 * Run-lifecycle state-machine fixtures: start → enter node → resolve → move, across every
 * node type, plus the win→gold→draft path, death→defeat, boss→victory, and terminal-state
 * rejection of all further actions. Combat is driven with the deterministic greedy / trivial
 * policies from runPolicy so outcomes are reproducible.
 */
import { startRun, enterNode, playEncounterTurn, resolveDraftPick, advanceToNode, advanceAct, abandonRun } from './runFlow';
import { buyFromShop, leaveShop, chooseEventOption, restAtNode, leaveRest } from './runNodes';
import { greedyComboPath, trivialSwapPath } from './runPolicy';
import { bossMaxHp } from './boss';
import { getBossForBiome } from './biomeBosses';
import { getBiome, ACT2_BIOME_IDS } from './biomes';
import { BIOME_ENEMY_IDS } from '../combat';
import { legalNextNodes } from './mapNav';
import type { NodeType } from './mapTypes';
import type { RunState } from './runTypes';

/** Craft a run already IN Act 2 (parked on the Act-2 map's start), via a real act transition. */
function craftAct2(seed: number): RunState {
  const transitioned = advanceAct({ ...startRun(seed), phase: { kind: 'act_transition' } });
  return transitioned;
}

/** Craft an Act-2 run positioned at the first node of `type` on the Act-2 map. */
function craftAct2At(seed: number, type: NodeType, overrides: Partial<RunState> = {}): RunState {
  const base = craftAct2(seed);
  const node = base.map.nodes.find((n) => n.type === type);
  if (!node) throw new Error(`no ${type} node in Act-2 map for seed ${seed}`);
  return { ...base, mapState: { currentNodeId: node.id, visited: [node.id] }, ...overrides };
}

/** Craft a run positioned (for enterNode testing) at the first node of `type`. */
function craftAt(seed: number, type: NodeType, overrides: Partial<RunState> = {}): RunState {
  const base = startRun(seed);
  const node = base.map.nodes.find((n) => n.type === type);
  if (!node) throw new Error(`no ${type} node in map for seed ${seed}`);
  return { ...base, mapState: { currentNodeId: node.id, visited: [node.id] }, ...overrides };
}

/** Play the current combat to a terminal-or-post-combat phase with a policy. */
function fightOut(state: RunState, policy: (b: import('../board').Board) => import('../board').Path): RunState {
  let s = state;
  let guard = 0;
  while (s.status === 'active' && s.phase.kind === 'combat' && guard++ < 200) {
    s = playEncounterTurn(s, policy(s.phase.encounter.board)).state;
  }
  return s;
}

describe('startRun', () => {
  it('parks the player at the start node, full HP, no gold/relics, active', () => {
    const s = startRun(42);
    expect(s.version).toBe(1);
    expect(s.seed).toBe(42);
    expect(s.mapState.currentNodeId).toBe(s.map.startId);
    expect(s.playerHp).toBe(s.playerMaxHp);
    expect(s.gold).toBe(0);
    expect(s.relicIds).toEqual([]);
    expect(s.phase.kind).toBe('awaiting_node');
    expect(s.status).toBe('active');
  });
});

describe('enterNode dispatch', () => {
  it('the floor-0 opening is always the intro slime, HP carried in', () => {
    const s = enterNode(startRun(42));
    expect(s.phase.kind).toBe('combat');
    if (s.phase.kind !== 'combat') return;
    expect(s.phase.encounterKind).toBe('fight');
    expect(s.phase.encounter.enemy?.id).toBe('slime');
    expect(s.playerHp).toBe(60);
  });

  it('a boss node opens a boss combat with the ramp-scaled boss enemy', () => {
    const node = startRun(42).map.nodes.find((n) => n.type === 'boss');
    const s = enterNode(craftAt(42, 'boss'));
    expect(s.phase.kind).toBe('combat');
    if (s.phase.kind !== 'combat') return;
    expect(s.phase.encounterKind).toBe('boss');
    expect(s.phase.encounter.enemyMaxHp).toBe(bossMaxHp(node!.floor));
  });

  it('shop / event / rest nodes open their interaction phases', () => {
    expect(enterNode(craftAt(42, 'shop')).phase.kind).toBe('shop');
    expect(enterNode(craftAt(42, 'event')).phase.kind).toBe('event');
    expect(enterNode(craftAt(42, 'rest')).phase.kind).toBe('rest');
  });
});

describe('combat resolution → gold + draft (win) / defeat (loss)', () => {
  it('winning a fight pays gold and opens a draft; picking adds the relic and advances', () => {
    const won = fightOut(enterNode(startRun(3)), greedyComboPath);
    expect(won.phase.kind).toBe('draft');
    expect(won.gold).toBeGreaterThan(0);
    if (won.phase.kind !== 'draft') return;
    const pick = won.phase.options[0];
    const after = resolveDraftPick(won, pick);
    expect(after.relicIds).toContain(pick);
    expect(after.phase.kind).toBe('awaiting_move');
  });

  it('a skipped draft advances without adding a relic', () => {
    const won = fightOut(enterNode(startRun(3)), greedyComboPath);
    if (won.phase.kind !== 'draft') throw new Error('expected a draft');
    const after = resolveDraftPick(won, null);
    expect(after.relicIds).toEqual([]);
    expect(after.phase.kind).toBe('awaiting_move');
  });

  it('resolveDraftPick rejects an unoffered relic', () => {
    const won = fightOut(enterNode(startRun(3)), greedyComboPath);
    if (won.phase.kind !== 'draft') throw new Error('expected a draft');
    expect(() => resolveDraftPick(won, 'not-an-option')).toThrow(/not an offered option/i);
  });

  it('losing a fight ends the run in defeat', () => {
    const lost = fightOut(enterNode(startRun(3)), trivialSwapPath);
    expect(lost.status).toBe('defeat');
    expect(lost.phase.kind).toBe('ended');
    expect(lost.playerHp).toBe(0);
  });

  it('killing the ACT-1 boss enters the act transition (not victory)', () => {
    // Enter the Act-1 boss, then drop it to 1 HP and land a finishing hit.
    const entered = enterNode(craftAt(42, 'boss'));
    if (entered.phase.kind !== 'combat') throw new Error('expected combat');
    const nearDead: RunState = {
      ...entered,
      phase: { ...entered.phase, encounter: { ...entered.phase.encounter, enemyHp: 1 } },
    };
    const done = fightOut(nearDead, greedyComboPath);
    expect(done.status).toBe('active'); // Act-1 boss beaten ⇒ transition, run still active
    expect(done.phase.kind).toBe('act_transition');
    expect(done.act).toBe(1); // act flips only on advanceAct
  });

  it('killing the ACT-2 boss ends the run in victory', () => {
    const entered = enterNode(craftAct2At(42, 'boss'));
    if (entered.phase.kind !== 'combat') throw new Error('expected combat');
    expect(entered.phase.encounterKind).toBe('boss');
    const nearDead: RunState = {
      ...entered,
      phase: { ...entered.phase, encounter: { ...entered.phase.encounter, enemyHp: 1 } },
    };
    const done = fightOut(nearDead, greedyComboPath);
    expect(done.status).toBe('victory');
    expect(done.phase.kind).toBe('ended');
  });
});

describe('act transition (Act 1 → Act 2)', () => {
  it('advanceAct heals ~50% of max, generates the Act-2 map, and parks at its start in act 2', () => {
    const s0 = startRun(42);
    const atTransition: RunState = { ...s0, playerHp: 10, phase: { kind: 'act_transition' } };
    const after = advanceAct(atTransition);
    expect(after.act).toBe(2);
    expect(after.playerHp).toBe(Math.min(60, 10 + Math.round(60 * 0.5))); // 10 + 30 = 40
    expect(after.phase.kind).toBe('awaiting_node');
    expect(after.mapState.currentNodeId).toBe(after.map.startId);
    // A NEW map (independent Act-2 layout stream) replaces the Act-1 map.
    expect(after.map).not.toEqual(s0.map);
    // act2BiomeId is unchanged by the transition (fixed at start, deterministic per seed).
    expect(after.act2BiomeId).toBe(s0.act2BiomeId);
  });

  it('the transition heal caps at max HP', () => {
    const after = advanceAct({ ...startRun(42), playerHp: 55, phase: { kind: 'act_transition' } });
    expect(after.playerHp).toBe(60); // 55 + 30 capped at 60
  });

  it('advanceAct rejects a run that is not in the act_transition phase', () => {
    expect(() => advanceAct(startRun(42))).toThrow(/expected phase 'act_transition'/i);
  });
});

describe('Act-2 encounters draw from the run\'s Act-2 biome', () => {
  it('an Act-2 fight uses one of the biome\'s four exclusive enemies (via the enemy override)', () => {
    const s = enterNode(craftAct2At(42, 'fight'));
    if (s.phase.kind !== 'combat') throw new Error('expected combat');
    const biome = getBiome(s.act2BiomeId);
    expect(ACT2_BIOME_IDS).toContain(s.act2BiomeId);
    expect(s.phase.encounter.enemy).toBeDefined();
    expect(biome.enemyIds).toContain(s.phase.encounter.enemy!.id);
    expect(BIOME_ENEMY_IDS).toContain(s.phase.encounter.enemy!.id);
  });

  it('the Act-2 boss is the biome\'s boss, at the continued (floor 13+) scaling', () => {
    const entered = enterNode(craftAct2At(42, 'boss'));
    if (entered.phase.kind !== 'combat') throw new Error('expected combat');
    const boss = getBossForBiome(craftAct2(42).act2BiomeId);
    expect(entered.phase.encounter.enemy!.id).toBe(boss.id);
    expect(entered.phase.encounter.enemy!.biome).toBe(boss.biome);
    // Continued difficulty: the Act-2 boss HP exceeds the same boss's Act-1-floor HP (harder).
    expect(entered.phase.encounter.enemyMaxHp).toBeGreaterThan(boss.baseHp);
  });
});

describe('terminal states reject all further actions', () => {
  it('a defeated run rejects enter / play / move / abandon', () => {
    const dead = abandonRun(startRun(1));
    expect(dead.status).toBe('defeat');
    expect(() => enterNode(dead)).toThrow(/terminal/i);
    expect(() => advanceToNode(dead, 'x')).toThrow(/terminal/i);
    expect(() => abandonRun(dead)).toThrow(/terminal/i);
    expect(() => playEncounterTurn(dead, { start: { col: 0, row: 0 }, steps: ['right'] })).toThrow(/terminal/i);
  });
});

describe('advanceToNode', () => {
  it('moves to a legal next node and awaits the node', () => {
    const won = resolveDraftPick(fightOut(enterNode(startRun(3)), greedyComboPath), null);
    const next = legalNextNodes(won.map, won.mapState)[0];
    const moved = advanceToNode(won, next);
    expect(moved.mapState.currentNodeId).toBe(next);
    expect(moved.phase.kind).toBe('awaiting_node');
    expect(moved.nodesCompleted).toBe(1);
  });

  it('rejects an illegal jump', () => {
    const won = resolveDraftPick(fightOut(enterNode(startRun(3)), greedyComboPath), null);
    expect(() => advanceToNode(won, 'f9n9')).toThrow(/illegal jump/i);
  });
});

describe('economy node actions', () => {
  it('shop: buy a relic (gold down, relic added, slot sold), then leave', () => {
    const s = enterNode(craftAt(42, 'shop', { gold: 500 }));
    if (s.phase.kind !== 'shop') throw new Error('expected shop');
    const relicIdx = s.phase.shop.items.findIndex((i) => i.kind === 'relic');
    const bought = buyFromShop(s, relicIdx);
    expect(bought.result.ok).toBe(true);
    expect(bought.state.gold).toBeLessThan(500);
    expect(bought.state.relicIds.length).toBe(1);
    expect(leaveShop(bought.state).phase.kind).toBe('awaiting_move');
  });

  it('shop: buying the heal item raises HP', () => {
    const s = enterNode(craftAt(42, 'shop', { gold: 500, playerHp: 20 }));
    if (s.phase.kind !== 'shop') throw new Error('expected shop');
    const healIdx = s.phase.shop.items.findIndex((i) => i.kind === 'heal');
    const bought = buyFromShop(s, healIdx);
    expect(bought.state.playerHp).toBeGreaterThan(20);
  });

  it('shop: an unaffordable buy leaves the run untouched', () => {
    const s = enterNode(craftAt(42, 'shop', { gold: 0 }));
    if (s.phase.kind !== 'shop') throw new Error('expected shop');
    const relicIdx = s.phase.shop.items.findIndex((i) => i.kind === 'relic');
    const rejected = buyFromShop(s, relicIdx);
    expect(rejected.result.ok).toBe(false);
    expect(rejected.state).toBe(s); // unchanged
  });

  it('event: choosing applies the effect and advances', () => {
    const s = enterNode(craftAt(42, 'event', { gold: 100 }));
    if (s.phase.kind !== 'event') throw new Error('expected event');
    const after = chooseEventOption(s, 0);
    expect(after.phase.kind).toBe('awaiting_move');
  });

  it('rest: resting heals then only leaving remains; leaving advances', () => {
    const s = enterNode(craftAt(42, 'rest', { playerHp: 20 }));
    if (s.phase.kind !== 'rest') throw new Error('expected rest');
    const rested = restAtNode(s);
    expect(rested.playerHp).toBe(38); // 20 + round(60×0.3)=18
    if (rested.phase.kind !== 'rest') throw new Error('still rest phase');
    expect(rested.phase.rest.rested).toBe(true);
    expect(() => restAtNode(rested)).toThrow(/already rested/i); // single-use
    expect(leaveRest(rested).phase.kind).toBe('awaiting_move');
  });
});
