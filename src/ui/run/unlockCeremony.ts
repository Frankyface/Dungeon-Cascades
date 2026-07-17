/**
 * Pure presentation for the UNLOCK CEREMONY (Stage-6 wave 2): fold the engine's `UnlockEvent[]`
 * (biome reached, legendary relic unlocked, enemy/boss discovered, Boss Rush opened, God of War
 * earned) into the celebratory cards the act-transition and outcome screens render. Every string is
 * DERIVED from the same registries the engine plays with (biome names, boss names/glyphs, relic
 * cards), so a data-only content addition celebrates correctly for free.
 *
 * The event list is the engine's single source of truth for "what is new" (idempotent
 * `deriveUnlocks` / altar / boss-rush appliers), so these helpers never decide unlock LOGIC — they
 * only phrase it. No React imports; deterministic; fully Jest-testable.
 */
import type { UnlockEvent } from '../../engine/run';
import { getBiome } from '../../engine/run';
import { relicCard, type RelicCard } from './relicPresentation';
import { bossGlyph, bossName, enemyDisplayName, enemyGlyph } from '../compendium/entityPresentation';

/** Visual family of a ceremony card — drives its accent in the view. */
export type CeremonyTone = 'biome' | 'legendary' | 'discovery' | 'mode' | 'prestige';

/** One celebratory card: an icon, a headline, a sub-line, its tone, and (for relics) the relic card. */
export interface CeremonyCard {
  readonly key: string;
  readonly icon: string;
  readonly title: string;
  readonly subtitle: string;
  readonly tone: CeremonyTone;
  /** Present only for a relic-unlock event — the full relic card to render inline. */
  readonly relic: RelicCard | null;
}

/** Human title for a relic unlock by its source + rarity (legendary biome/boss vs an altar find). */
function relicTitle(card: RelicCard, source: 'biome' | 'boss' | 'altar'): string {
  const tierWord = card.tier === 'legendary' ? 'Legendary' : card.tier === 'epic' ? 'Epic' : 'Common';
  if (source === 'biome') return `${tierWord} Biome Relic Unlocked`;
  if (source === 'boss') return `${tierWord} Boss Relic Unlocked`;
  return `${tierWord} Relic Unlocked`; // altar
}

/** Map ONE unlock event to its ceremony card. */
function toCard(event: UnlockEvent, index: number): CeremonyCard {
  switch (event.kind) {
    case 'biome': {
      const biome = getBiome(event.biomeId);
      return {
        key: `biome-${event.biomeId}-${index}`,
        icon: '🗺️',
        title: 'Biome Unlocked',
        subtitle: `${biome.name} — its compendium entries and legendary biome relic are now yours.`,
        tone: 'biome',
        relic: null,
      };
    }
    case 'relic': {
      const card = relicCard(event.relicId);
      return {
        key: `relic-${event.relicId}-${index}`,
        icon: '💎',
        title: relicTitle(card, event.source),
        subtitle: card.name,
        tone: 'legendary',
        relic: card,
      };
    }
    case 'enemyDiscovered':
      return {
        key: `enemy-${event.enemyId}-${index}`,
        icon: enemyGlyph(event.enemyId),
        title: 'Enemy Discovered',
        subtitle: enemyDisplayName(event.enemyId),
        tone: 'discovery',
        relic: null,
      };
    case 'bossDiscovered':
      return {
        key: `boss-${event.bossId}-${index}`,
        icon: bossGlyph(event.bossId),
        title: 'Boss Discovered',
        subtitle: bossName(event.bossId),
        tone: 'discovery',
        relic: null,
      };
    case 'bossRushUnlocked':
      return {
        key: `boss-rush-${index}`,
        icon: '⚔️',
        title: 'Boss Rush Unlocked!',
        subtitle: 'All five bosses discovered — face them back-to-back with no map.',
        tone: 'mode',
        relic: null,
      };
    case 'godOfWarUnlocked':
      return {
        key: `god-of-war-${index}`,
        icon: '👑',
        title: 'God of War Earned!',
        subtitle: 'The prestige class is now selectable at the start screen.',
        tone: 'prestige',
        relic: null,
      };
  }
}

/** Every unlock event as a ceremony card, in event order (the outcome screen shows the full list). */
export function ceremonyCards(events: readonly UnlockEvent[]): readonly CeremonyCard[] {
  return events.map(toCard);
}

/**
 * The HEADLINE ceremonies only — biome unlocks, relic unlocks, and the Boss-Rush / God-of-War
 * milestones — leaving the individual enemy/boss discoveries to a compact count summary. The act
 * transition uses this so the reveal celebrates the biome + its legendary without a long roll-call.
 */
export function headlineCeremonies(events: readonly UnlockEvent[]): readonly CeremonyCard[] {
  return ceremonyCards(events).filter((c) => c.tone !== 'discovery');
}

/** Count of the quiet discovery events (enemies + bosses newly added to the compendium). */
export interface DiscoveryCounts {
  readonly enemies: number;
  readonly bosses: number;
  readonly total: number;
}

/** Tally the enemy/boss discovery events for a compact "N new compendium entries" summary line. */
export function discoveryCounts(events: readonly UnlockEvent[]): DiscoveryCounts {
  let enemies = 0;
  let bosses = 0;
  for (const e of events) {
    if (e.kind === 'enemyDiscovered') enemies++;
    else if (e.kind === 'bossDiscovered') bosses++;
  }
  return { enemies, bosses, total: enemies + bosses };
}
