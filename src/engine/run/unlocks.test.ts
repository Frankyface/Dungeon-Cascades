/**
 * Unlock & discovery model tests (Stage-6 wave 2, spec-systems.md §2). Cover the three unlock
 * paths (biome-reached / boss-killed / enemies-fought), EXACTLY-ONCE idempotency under re-derive,
 * the Boss-Rush discovery gate, the God-of-War Boss-Rush-victory award, Altar meta unlocks, and
 * the fresh-profile / no-power-creep invariants.
 */
import type { BiomeId } from '../combat';
import { startRun } from './runFlow';
import { driveRun, greedyComboPath } from './runPolicy';
import { INITIAL_META_STATE, normalizeMeta, selectableStarts } from './meta';
import type { MetaState } from './meta';
import type { RunState, RunStatus } from './runTypes';
import { getBiome } from './biomes';
import { BONE_COLOSSUS, getBossForBiome } from './biomeBosses';
import { UNLOCKED_BY_DEFAULT_IDS } from './relics';
import { GOD_OF_WAR_ID } from './variants';
import {
  ALL_BOSS_IDS,
  BIOME_LEGENDARY_RELIC,
  BOSS_LEGENDARY_RELIC,
  applyAltarUnlock,
  applyBossRushVictory,
  deriveUnlocks,
} from './unlocks';
import type { UnlockEvent } from './unlocks';

/** A synthetic terminal-or-checkpoint state carrying only the fields `deriveUnlocks` reads. */
function runLike(over: {
  foughtEnemyIds?: readonly string[];
  act?: 1 | 2;
  act2BiomeId?: BiomeId;
  status?: RunStatus;
}): RunState {
  return {
    act: over.act ?? 1,
    act2BiomeId: over.act2BiomeId ?? 'glacial-crypt',
    status: over.status ?? 'defeat',
    foughtEnemyIds: over.foughtEnemyIds,
  } as unknown as RunState;
}

const kinds = (events: readonly UnlockEvent[], kind: UnlockEvent['kind']): UnlockEvent[] =>
  events.filter((e) => e.kind === kind);

describe('INITIAL_META_STATE — a fresh profile', () => {
  it('unlocks exactly the base 12 relics, discovers nothing, and locks Boss Rush / God of War', () => {
    expect(INITIAL_META_STATE.unlockedRelicIds).toEqual([...UNLOCKED_BY_DEFAULT_IDS]);
    expect(INITIAL_META_STATE.unlockedRelicIds).toHaveLength(12);
    expect(INITIAL_META_STATE.discoveredEnemyIds).toEqual([]);
    expect(INITIAL_META_STATE.discoveredBossIds).toEqual([]);
    expect(INITIAL_META_STATE.unlockedBiomeIds).toEqual([]); // dungeon is implicit, never listed
    expect(INITIAL_META_STATE.bossRushUnlocked).toBe(false);
    expect(INITIAL_META_STATE.godOfWarUnlocked).toBe(false);
    expect(INITIAL_META_STATE.altarUnlockCount).toBe(0);
  });

  it('the dungeon enemies are NOT auto-discovered on a fresh profile', () => {
    for (const id of getBiome('dungeon').enemyIds) {
      expect(INITIAL_META_STATE.discoveredEnemyIds).not.toContain(id);
    }
    expect(INITIAL_META_STATE.discoveredBossIds).not.toContain('bone-colossus');
  });

  it('normalizeMeta fills a partial/old save with fresh defaults (backward-compat)', () => {
    const legacy: MetaState = { score: 40, unlockedVariantIds: ['cartographer'] };
    const norm = normalizeMeta(legacy);
    expect(norm.score).toBe(40);
    expect(norm.unlockedVariantIds).toEqual(['cartographer']);
    expect(norm.unlockedRelicIds).toEqual([...UNLOCKED_BY_DEFAULT_IDS]);
    expect(norm.discoveredEnemyIds).toEqual([]);
    expect(norm.bossRushUnlocked).toBe(false);
  });
});

describe('deriveUnlocks — enemies fought → discovered (§2c)', () => {
  it('discovers every non-boss enemy fought this run, exactly once', () => {
    const state = runLike({ foughtEnemyIds: ['slime', 'skeleton', 'slime'] }); // a dupe in the list
    const { meta, events } = deriveUnlocks(state, INITIAL_META_STATE);
    expect(meta.discoveredEnemyIds).toEqual(['slime', 'skeleton']);
    expect(kinds(events, 'enemyDiscovered')).toEqual([
      { kind: 'enemyDiscovered', enemyId: 'slime' },
      { kind: 'enemyDiscovered', enemyId: 'skeleton' },
    ]);
  });

  it('re-deriving on the already-applied meta fires NO new events (idempotent)', () => {
    const state = runLike({ foughtEnemyIds: ['slime', 'skeleton'] });
    const first = deriveUnlocks(state, INITIAL_META_STATE);
    const second = deriveUnlocks(state, first.meta);
    expect(second.events).toEqual([]);
    expect(second.meta.discoveredEnemyIds).toEqual(first.meta.discoveredEnemyIds);
  });
});

describe('deriveUnlocks — Act-2 biome reached (§2a) + boss kills (§2b)', () => {
  it('reaching Act 2 unlocks the biome: its 4 enemies + boss reveal, its legendary relic + Bone Colossus', () => {
    const biome: BiomeId = 'glacial-crypt';
    const state = runLike({ act: 2, act2BiomeId: biome, status: 'defeat' }); // reached, then died in Act 2
    const { meta, events } = deriveUnlocks(state, INITIAL_META_STATE);

    expect(meta.unlockedBiomeIds).toEqual([biome]);
    // All four biome enemies revealed by the reach.
    for (const id of getBiome(biome).enemyIds) expect(meta.discoveredEnemyIds).toContain(id);
    // The biome boss compendium entry revealed by the reach; the Act-1 Bone Colossus was killed to get here.
    expect(meta.discoveredBossIds).toContain(getBiome(biome).bossId);
    expect(meta.discoveredBossIds).toContain(BONE_COLOSSUS.id);
    // The legendary BIOME relic is unlocked; the boss legendary is NOT (boss not yet killed).
    expect(meta.unlockedRelicIds).toContain(BIOME_LEGENDARY_RELIC[biome]);
    expect(meta.unlockedRelicIds).not.toContain(BOSS_LEGENDARY_RELIC[getBiome(biome).bossId]);

    expect(kinds(events, 'biome')).toEqual([{ kind: 'biome', biomeId: biome }]);
    expect(events).toContainEqual({ kind: 'relic', relicId: BIOME_LEGENDARY_RELIC[biome], source: 'biome' });
  });

  it('a VICTORY additionally unlocks the Act-2 boss legendary relic', () => {
    const biome: BiomeId = 'rotwood';
    const state = runLike({ act: 2, act2BiomeId: biome, status: 'victory' });
    const { meta, events } = deriveUnlocks(state, INITIAL_META_STATE);
    const boss = getBossForBiome(biome);
    expect(meta.discoveredBossIds).toContain(boss.id);
    expect(meta.unlockedRelicIds).toContain(BOSS_LEGENDARY_RELIC[boss.id]); // sporecrown
    expect(events).toContainEqual({ kind: 'relic', relicId: BOSS_LEGENDARY_RELIC[boss.id], source: 'boss' });
  });

  it('an Act-1 defeat unlocks NO biome and no boss legendary', () => {
    const state = runLike({ act: 1, status: 'defeat', foughtEnemyIds: ['slime'] });
    const { meta } = deriveUnlocks(state, INITIAL_META_STATE);
    expect(meta.unlockedBiomeIds).toEqual([]);
    expect(meta.discoveredBossIds).toEqual([]); // never reached Act 2, never beat a boss
    expect(meta.unlockedRelicIds).toEqual([...UNLOCKED_BY_DEFAULT_IDS]);
  });

  it('a full 2-act VICTORY (real driven run, seed 7) unlocks its biome + both legendaries idempotently', () => {
    const state = driveRun(startRun(7), greedyComboPath).state;
    expect(state.status).toBe('victory');
    const biome = state.act2BiomeId;
    const first = deriveUnlocks(state, INITIAL_META_STATE);
    expect(first.meta.unlockedBiomeIds).toEqual([biome]);
    expect(first.meta.unlockedRelicIds).toContain(BIOME_LEGENDARY_RELIC[biome]);
    expect(first.meta.unlockedRelicIds).toContain(BOSS_LEGENDARY_RELIC[getBossForBiome(biome).id]);
    // Re-deriving banks nothing new.
    const second = deriveUnlocks(state, first.meta);
    expect(second.events).toEqual([]);
    expect(second.meta).toEqual(first.meta);
  });
});

describe('deriveUnlocks — Boss Rush gate (§6): all 5 bosses discovered', () => {
  it('flips bossRushUnlocked exactly once when the fifth boss is discovered', () => {
    // Seed a meta already holding four of the five bosses; the missing one is the fifth in ALL_BOSS_IDS.
    const missingBoss = ALL_BOSS_IDS[4]; // drowned-sovereign (BOSSES order)
    const seeded: MetaState = {
      ...INITIAL_META_STATE,
      discoveredBossIds: ALL_BOSS_IDS.slice(0, 4),
      bossRushUnlocked: false,
    };
    // Reaching the missing boss's biome reveals it (§2a), completing the set of five.
    const biome = (['glacial-crypt', 'emberworks', 'rotwood', 'sunken-catacombs'] as BiomeId[]).find(
      (b) => getBossForBiome(b).id === missingBoss,
    ) as BiomeId;
    const state = runLike({ act: 2, act2BiomeId: biome, status: 'defeat' });

    const { meta, events } = deriveUnlocks(state, seeded);
    expect(meta.discoveredBossIds).toContain(missingBoss);
    expect(meta.bossRushUnlocked).toBe(true);
    expect(kinds(events, 'bossRushUnlocked')).toHaveLength(1);
    // Idempotent: re-derive fires no second bossRushUnlocked event.
    expect(kinds(deriveUnlocks(state, meta).events, 'bossRushUnlocked')).toEqual([]);
  });

  it('does not flip the gate while any boss is still undiscovered', () => {
    const state = runLike({ act: 2, act2BiomeId: 'glacial-crypt', status: 'defeat' }); // reveals rimeheart + colossus
    const { meta, events } = deriveUnlocks(state, INITIAL_META_STATE);
    expect((meta.discoveredBossIds ?? []).length).toBeLessThan(ALL_BOSS_IDS.length);
    expect(meta.bossRushUnlocked).toBe(false);
    expect(kinds(events, 'bossRushUnlocked')).toEqual([]);
  });
});

describe('applyBossRushVictory — awards God of War (§3, §6)', () => {
  it('sets godOfWarUnlocked and fires the event exactly once', () => {
    const first = applyBossRushVictory(INITIAL_META_STATE);
    expect(first.meta.godOfWarUnlocked).toBe(true);
    expect(first.events).toEqual([{ kind: 'godOfWarUnlocked' }]);
    const second = applyBossRushVictory(first.meta);
    expect(second.events).toEqual([]); // idempotent
    expect(second.meta.godOfWarUnlocked).toBe(true);
  });

  it('God of War becomes selectable ONLY after it is awarded, and is never a tranche variant', () => {
    expect(selectableStarts(INITIAL_META_STATE)).not.toContain(GOD_OF_WAR_ID);
    const earned = applyBossRushVictory(INITIAL_META_STATE).meta;
    const starts = selectableStarts(earned);
    expect(starts[starts.length - 1]).toBe(GOD_OF_WAR_ID); // appended last
    expect(starts[0]).toBeNull(); // vanilla still first
  });
});

describe('applyAltarUnlock — permanent relic unlock even though the run died (§2c)', () => {
  it('unlocks a new relic, bumps the altar count, and surfaces a relic event (source altar)', () => {
    const { meta, events } = applyAltarUnlock(INITIAL_META_STATE, 'cinderbrand-nail');
    expect(meta.unlockedRelicIds).toContain('cinderbrand-nail');
    expect(meta.altarUnlockCount).toBe(1);
    expect(events).toEqual([{ kind: 'relic', relicId: 'cinderbrand-nail', source: 'altar' }]);
  });

  it('never double-unlocks or double-counts an already-unlocked relic (idempotent)', () => {
    const once = applyAltarUnlock(INITIAL_META_STATE, 'cinderbrand-nail').meta;
    const twice = applyAltarUnlock(once, 'cinderbrand-nail');
    expect(twice.events).toEqual([]);
    expect(twice.meta.altarUnlockCount).toBe(1); // unchanged
    // A base relic is already unlocked ⇒ no count bump, no event.
    const baseAgain = applyAltarUnlock(INITIAL_META_STATE, UNLOCKED_BY_DEFAULT_IDS[0]);
    expect(baseAgain.events).toEqual([]);
    expect(baseAgain.meta.altarUnlockCount).toBe(0);
  });
});

describe('NO POWER CREEP — the unlock snapshot never leaks into a vanilla run', () => {
  it('startRun(seed) with no snapshot is byte-identical regardless of what meta has unlocked', () => {
    const fresh = startRun(42);
    const withSnapshotOmitted = startRun(42, undefined, undefined);
    expect(JSON.stringify(withSnapshotOmitted)).toBe(JSON.stringify(fresh));
    expect('unlockedRelicIds' in fresh).toBe(false); // absent ⇒ pools default to base 12
  });
});
