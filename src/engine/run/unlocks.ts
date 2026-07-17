/**
 * Content unlock & discovery derivation (Stage-6 wave 2, spec-systems.md §2).
 *
 * PURE: from a terminal-or-checkpoint `RunState` + a prior `MetaState`, `deriveUnlocks` returns the
 * NEW `MetaState` and the `UnlockEvent[]` the UI ceremony surfaces. Three meta-persistent paths:
 *   (a) an ACT-2 biome REACHED for the first time (§2a) → the biome unlocks: its compendium reveals
 *       (all four enemies + its boss) AND its legendary biome relic enters the pool;
 *   (b) a BOSS KILLED for the first time (§2b) → discovery + its legendary boss relic;
 *   (c) enemies FOUGHT → discovered (from `RunState.foughtEnemyIds`, which accumulates across acts).
 * Reaching all five bosses' discovery flips `bossRushUnlocked` (§6). God of War is NOT awarded here
 * — it rides Boss-Rush VICTORY (`applyBossRushVictory`).
 *
 * EXACTLY-ONCE / IDEMPOTENT (the tranche discipline): every add is guarded against the prior set, so
 * re-running `deriveUnlocks` on an already-applied state yields the SAME MetaState and an EMPTY event
 * list — safe under re-bank, reload, and being called at both a checkpoint and the terminal.
 *
 * PURE ENGINE: no React / React Native imports; deterministic; never mutates input.
 */
import type { BiomeId, BossId } from '../combat';
import type { RunState } from './runTypes';
import type { MetaState } from './meta';
import { normalizeMeta } from './meta';
import { getBiome } from './biomes';
import { BONE_COLOSSUS, BOSSES, getBossForBiome } from './biomeBosses';

/** The four Act-2 biomes' legendary BIOME relics (content-relics.md; unlocked on reaching the biome). */
export const BIOME_LEGENDARY_RELIC: Partial<Record<BiomeId, string>> = {
  'glacial-crypt': 'rimebound-sigil',
  emberworks: 'bellows-heart',
  rotwood: 'heartrot-seed',
  'sunken-catacombs': 'maelstrom-pearl',
};

/** The four Act-2 bosses' legendary BOSS relics (content-relics.md; unlocked on killing the boss). */
export const BOSS_LEGENDARY_RELIC: Partial<Record<BossId, string>> = {
  rimeheart: 'rimeheart-shard',
  forgeheart: 'forgeheart-ember',
  'the-rotmother': 'sporecrown',
  'drowned-sovereign': 'crown-of-the-drowned-sovereign',
};

/** All five boss ids (Bone Colossus + the four Act-2 bosses) — the Boss-Rush discovery gate. */
export const ALL_BOSS_IDS: readonly BossId[] = BOSSES.map((b) => b.id);

/** The source that surfaced a relic unlock, for the UI ceremony / compendium provenance. */
export type UnlockSource = 'biome' | 'boss' | 'altar';

/** One thing that just unlocked/was-discovered — the UI renders a ceremony per event. */
export type UnlockEvent =
  | { readonly kind: 'biome'; readonly biomeId: BiomeId }
  | { readonly kind: 'relic'; readonly relicId: string; readonly source: UnlockSource }
  | { readonly kind: 'enemyDiscovered'; readonly enemyId: string }
  | { readonly kind: 'bossDiscovered'; readonly bossId: BossId }
  | { readonly kind: 'bossRushUnlocked' }
  | { readonly kind: 'godOfWarUnlocked' };

/** The output of a derivation: the new profile plus the events to celebrate (empty ⇒ nothing new). */
export interface UnlockResult {
  readonly meta: MetaState;
  readonly events: readonly UnlockEvent[];
}

/** A tiny mutable accumulator so a derivation can build the new sets + events in one pass. Pure use. */
interface Acc {
  unlockedRelicIds: string[];
  discoveredEnemyIds: string[];
  discoveredBossIds: string[];
  unlockedBiomeIds: string[];
  bossRushUnlocked: boolean;
  godOfWarUnlocked: boolean;
  altarUnlockCount: number;
  events: UnlockEvent[];
}

/** Seed a working accumulator from a (normalized) MetaState — fresh copies of every set. */
function accFrom(meta: MetaState): Acc {
  return {
    unlockedRelicIds: [...(meta.unlockedRelicIds ?? [])],
    discoveredEnemyIds: [...(meta.discoveredEnemyIds ?? [])],
    discoveredBossIds: [...(meta.discoveredBossIds ?? [])],
    unlockedBiomeIds: [...(meta.unlockedBiomeIds ?? [])],
    bossRushUnlocked: meta.bossRushUnlocked ?? false,
    godOfWarUnlocked: meta.godOfWarUnlocked ?? false,
    altarUnlockCount: meta.altarUnlockCount ?? 0,
    events: [],
  };
}

/** Fold the accumulator back into a MetaState, preserving score + variants. */
function metaFrom(base: MetaState, acc: Acc): MetaState {
  return {
    ...base,
    unlockedRelicIds: acc.unlockedRelicIds,
    discoveredEnemyIds: acc.discoveredEnemyIds,
    discoveredBossIds: acc.discoveredBossIds,
    unlockedBiomeIds: acc.unlockedBiomeIds,
    bossRushUnlocked: acc.bossRushUnlocked,
    godOfWarUnlocked: acc.godOfWarUnlocked,
    altarUnlockCount: acc.altarUnlockCount,
  };
}

// ── Single-fact appliers (each fires its event EXACTLY ONCE) ─────────────────────────────

function discoverEnemy(acc: Acc, enemyId: string): void {
  if (acc.discoveredEnemyIds.includes(enemyId)) return;
  acc.discoveredEnemyIds.push(enemyId);
  acc.events.push({ kind: 'enemyDiscovered', enemyId });
}

function discoverBoss(acc: Acc, bossId: BossId): void {
  if (acc.discoveredBossIds.includes(bossId)) return;
  acc.discoveredBossIds.push(bossId);
  acc.events.push({ kind: 'bossDiscovered', bossId });
  // Discovering the fifth distinct boss flips the Boss-Rush gate (§6).
  if (!acc.bossRushUnlocked && ALL_BOSS_IDS.every((id) => acc.discoveredBossIds.includes(id))) {
    acc.bossRushUnlocked = true;
    acc.events.push({ kind: 'bossRushUnlocked' });
  }
}

function unlockRelic(acc: Acc, relicId: string, source: UnlockSource): void {
  if (acc.unlockedRelicIds.includes(relicId)) return; // idempotent — never re-unlock / double-count
  acc.unlockedRelicIds.push(relicId);
  acc.events.push({ kind: 'relic', relicId, source });
  if (source === 'altar') acc.altarUnlockCount += 1; // altar bookkeeping (§2c): only real unlocks count
}

/** Unlock a whole Act-2 biome on first reach (§2a): reveal its enemies + boss, unlock its legendary. */
function unlockBiome(acc: Acc, biomeId: BiomeId): void {
  if (acc.unlockedBiomeIds.includes(biomeId)) return;
  acc.unlockedBiomeIds.push(biomeId);
  acc.events.push({ kind: 'biome', biomeId });

  const biome = getBiome(biomeId);
  for (const enemyId of biome.enemyIds) discoverEnemy(acc, String(enemyId)); // reveal the four enemies
  discoverBoss(acc, biome.bossId); // reveal the boss compendium entry (its legendary waits for a kill)

  const legendary = BIOME_LEGENDARY_RELIC[biomeId];
  if (legendary !== undefined) unlockRelic(acc, legendary, 'biome');
}

// ── The run-derived derivation ───────────────────────────────────────────────────────────

/**
 * Derive the meta unlocks/discoveries a run has EARNED, from its (terminal or checkpoint) state.
 * Idempotent. Order: fought enemies → Act-2 biome reached → boss kills. A run that never left Act 1
 * only ever discovers the enemies it fought (and, on beating the Act-1 boss to REACH Act 2, the Bone
 * Colossus). Returns the new profile + the fired events (empty when nothing is new).
 */
export function deriveUnlocks(state: RunState, meta: MetaState): UnlockResult {
  const base = normalizeMeta(meta);
  const acc = accFrom(base);

  // (c) Every non-boss enemy fought this run is discovered (accumulated across acts on RunState).
  for (const enemyId of state.foughtEnemyIds ?? []) discoverEnemy(acc, enemyId);

  // (a) Reaching Act 2 unlocks the run's Act-2 biome (its enemies + boss + legendary biome relic).
  //     `act === 2` ⟺ the run advanced past the Act-1 boss, so it truly LANDED on the biome.
  if (state.act === 2) unlockBiome(acc, state.act2BiomeId);

  // (b) Boss kills:
  //   • Reaching Act 2 means the Act-1 dungeon boss (Bone Colossus) was killed — discover it (it has
  //     no biome/boss legendary of its own, so no relic unlocks).
  if (state.act === 2) discoverBoss(acc, BONE_COLOSSUS.id);
  //   • A VICTORY means the Act-2 boss was killed — discover it (idempotent after the reach reveal)
  //     and unlock its legendary boss relic.
  if (state.status === 'victory') {
    const act2Boss = getBossForBiome(state.act2BiomeId);
    discoverBoss(acc, act2Boss.id);
    const legendary = BOSS_LEGENDARY_RELIC[act2Boss.id];
    if (legendary !== undefined) unlockRelic(acc, legendary, 'boss');
  }

  return { meta: metaFrom(base, acc), events: acc.events };
}

// ── Altar & Boss-Rush appliers (invoked by their own flows; reuse the same event model) ──

/**
 * Apply an Altar sacrifice's relic unlock (§2c) as a META event — permanent even though the run died.
 * Idempotent: a relic already unlocked is a no-op (no event, no count bump). The Altar's seeded pick
 * (altar.ts) chooses only from the LOCKED pool, so in practice `relicId` is always new.
 */
export function applyAltarUnlock(meta: MetaState, relicId: string): UnlockResult {
  const base = normalizeMeta(meta);
  const acc = accFrom(base);
  unlockRelic(acc, relicId, 'altar');
  return { meta: metaFrom(base, acc), events: acc.events };
}

/** Award God of War on a Boss-Rush VICTORY (§6). Idempotent — a second win fires no event. */
export function applyBossRushVictory(meta: MetaState): UnlockResult {
  const base = normalizeMeta(meta);
  const acc = accFrom(base);
  if (!acc.godOfWarUnlocked) {
    acc.godOfWarUnlocked = true;
    acc.events.push({ kind: 'godOfWarUnlocked' });
  }
  return { meta: metaFrom(base, acc), events: acc.events };
}
