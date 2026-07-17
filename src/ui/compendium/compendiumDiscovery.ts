/**
 * DISCOVERY-DRIVEN compendium sections (Stage-6 §4): fold the meta profile's discovered/unlocked sets
 * over the full registries so the compendium shows LOCKED silhouettes for what the player hasn't met
 * yet, full entries for what they have, and a per-section "N/M discovered" count. Enemies and bosses
 * are grouped by biome. Relics are "discovered" when UNLOCKED (spec §2: relics on first unlock/draft);
 * enemies/bosses when first fought/killed (or revealed by reaching their biome).
 *
 * Every full entry reuses the pure `compendiumModel` builders, so a discovered entry is byte-identical
 * to the always-visible base compendium. No React imports; deterministic; fully Jest-testable.
 */
import {
  ACT_FLOOR_SPAN,
  BIOME_IDS,
  RELIC_IDS,
  getBiome,
  getBossForBiome,
  normalizeMeta,
} from '../../engine/run';
import type { BiomeId, BossId } from '../../engine/combat';
import type { MetaState } from '../../engine/run';
import { relicCard, type RelicCard } from '../run/relicPresentation';
import {
  compendiumBossFor,
  compendiumEnemyDetail,
  type CompendiumBossEntry,
  type CompendiumEnemyEntry,
} from './compendiumModel';
import { bossGlyph, bossName, enemyDisplayName, enemyGlyph } from './entityPresentation';

/** The hidden glyph + label for a not-yet-discovered entry (a silhouette). */
export const LOCKED_GLYPH = '❓';
export const LOCKED_NAME = 'Undiscovered';

/** A per-section discovery tally + a ready-to-render `N/M` label. */
export interface SectionCount {
  readonly discovered: number;
  readonly total: number;
  /** `12/88`. */
  readonly label: string;
}

function sectionCount(discovered: number, total: number): SectionCount {
  return { discovered, total, label: `${discovered}/${total}` };
}

// ── Relics ───────────────────────────────────────────────────────────────────

/** One relic slot: unlocked (full card) or locked (silhouette). */
export interface RelicSlot {
  readonly id: string;
  readonly locked: boolean;
  /** The full relic card when unlocked; `null` when locked. */
  readonly card: RelicCard | null;
}

/** The relic section: every relic in canonical order, locked-aware, plus the unlocked count. */
export function compendiumRelicSection(meta: MetaState): { readonly slots: readonly RelicSlot[]; readonly count: SectionCount } {
  const unlocked = new Set(normalizeMeta(meta).unlockedRelicIds ?? []);
  const slots = RELIC_IDS.map((id): RelicSlot => {
    const isUnlocked = unlocked.has(id);
    return { id, locked: !isUnlocked, card: isUnlocked ? relicCard(id) : null };
  });
  return { slots, count: sectionCount(unlocked.size, RELIC_IDS.length) };
}

// ── Enemies (biome-grouped) ──────────────────────────────────────────────────

/** One enemy slot: discovered (full detail) or locked (silhouette). */
export interface EnemySlot {
  readonly id: string;
  readonly discovered: boolean;
  /** Real glyph when discovered, the locked silhouette otherwise. */
  readonly glyph: string;
  /** Real name when discovered, "Undiscovered" otherwise. */
  readonly name: string;
  /** The full stat detail when discovered; `null` when locked. */
  readonly detail: CompendiumEnemyEntry | null;
}

/** A biome's enemy group: its enemies (locked-aware) + that biome's discovery count. */
export interface EnemyBiomeGroup {
  readonly biomeId: BiomeId;
  readonly biomeName: string;
  readonly slots: readonly EnemySlot[];
  readonly count: SectionCount;
}

/** The enemy section: enemies grouped by biome (dungeon first), locked-aware, with counts. */
export function compendiumEnemySection(meta: MetaState): {
  readonly groups: readonly EnemyBiomeGroup[];
  readonly count: SectionCount;
} {
  const discovered = new Set(normalizeMeta(meta).discoveredEnemyIds ?? []);
  let totalDiscovered = 0;
  let total = 0;

  const groups = BIOME_IDS.map((biomeId): EnemyBiomeGroup => {
    const biome = getBiome(biomeId);
    let groupDiscovered = 0;
    const slots = biome.enemyIds.map((rawId): EnemySlot => {
      const id = String(rawId);
      const isFound = discovered.has(id);
      if (isFound) groupDiscovered++;
      return {
        id,
        discovered: isFound,
        glyph: isFound ? enemyGlyph(id) : LOCKED_GLYPH,
        name: isFound ? enemyDisplayName(id) : LOCKED_NAME,
        detail: isFound ? compendiumEnemyDetail(id) : null,
      };
    });
    totalDiscovered += groupDiscovered;
    total += slots.length;
    return { biomeId, biomeName: biome.name, slots, count: sectionCount(groupDiscovered, slots.length) };
  });

  return { groups, count: sectionCount(totalDiscovered, total) };
}

// ── Bosses (one per biome) ────────────────────────────────────────────────────

/** The floor a biome's boss is fought at: Act-1 boss floor for the dungeon, Act-2 boss floor otherwise. */
export function bossFloorFor(biomeId: BiomeId): number {
  const actOffset = biomeId === 'dungeon' ? 0 : ACT_FLOOR_SPAN;
  return actOffset + (ACT_FLOOR_SPAN - 1);
}

/** One boss slot: discovered (full phased detail) or locked (silhouette). */
export interface BossSlot {
  readonly bossId: BossId;
  readonly biomeId: BiomeId;
  readonly biomeName: string;
  readonly discovered: boolean;
  readonly glyph: string;
  readonly name: string;
  /** The full boss entry (phases, scaled scripts) when discovered; `null` when locked. */
  readonly detail: CompendiumBossEntry | null;
}

/** The boss section: every biome's boss (dungeon first), locked-aware, with the discovery count. */
export function compendiumBossSection(meta: MetaState): { readonly slots: readonly BossSlot[]; readonly count: SectionCount } {
  const discovered = new Set(normalizeMeta(meta).discoveredBossIds ?? []);
  let found = 0;

  const slots = BIOME_IDS.map((biomeId): BossSlot => {
    const boss = getBossForBiome(biomeId);
    const isFound = discovered.has(boss.id);
    if (isFound) found++;
    return {
      bossId: boss.id,
      biomeId,
      biomeName: getBiome(biomeId).name,
      discovered: isFound,
      glyph: isFound ? bossGlyph(boss.id) : LOCKED_GLYPH,
      name: isFound ? bossName(boss.id) : LOCKED_NAME,
      detail: isFound ? compendiumBossFor(boss, bossFloorFor(biomeId)) : null,
    };
  });

  return { slots, count: sectionCount(found, slots.length) };
}
