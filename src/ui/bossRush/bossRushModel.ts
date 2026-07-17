/**
 * Pure view-model for the BOSS RUSH menu gate (spec §6): whether the mode is unlocked (all five
 * bosses discovered) and, until then, the progress ("Bosses discovered 3/5") plus the per-boss
 * discovery list (discovered bosses named, the rest hidden). The engine owns the unlock flag
 * (`meta.bossRushUnlocked`, flipped by `deriveUnlocks` on the fifth boss); this only phrases it.
 *
 * No React imports; deterministic; fully Jest-testable.
 */
import { BOSS_RUSH_ORDER, normalizeMeta } from '../../engine/run';
import type { MetaState } from '../../engine/run';
import type { BossId } from '../../engine/combat';
import { bossGlyph, bossName } from '../compendium/entityPresentation';

/** The hidden glyph/name for an undiscovered boss in the progress list. */
const HIDDEN_GLYPH = '❓';
const HIDDEN_NAME = '???';

/** One boss in the Boss-Rush order, with its discovery-gated display. */
export interface BossRushOrderEntry {
  readonly bossId: BossId;
  readonly discovered: boolean;
  /** Real name when discovered, hidden otherwise. */
  readonly name: string;
  /** Real glyph when discovered, a silhouette otherwise. */
  readonly glyph: string;
}

/** The Boss-Rush gate state for the menu / mode entry. */
export interface BossRushGate {
  readonly unlocked: boolean;
  readonly discoveredCount: number;
  readonly total: number;
  /** `Bosses discovered 3/5`. */
  readonly label: string;
  /** The five bosses in fight order, discovery-gated. */
  readonly order: readonly BossRushOrderEntry[];
}

/** Build the Boss-Rush gate view from the meta profile. */
export function bossRushGate(meta: MetaState): BossRushGate {
  const norm = normalizeMeta(meta);
  const discovered = new Set(norm.discoveredBossIds ?? []);
  const order = BOSS_RUSH_ORDER.map((id): BossRushOrderEntry => {
    const isFound = discovered.has(id);
    return {
      bossId: id,
      discovered: isFound,
      name: isFound ? bossName(id) : HIDDEN_NAME,
      glyph: isFound ? bossGlyph(id) : HIDDEN_GLYPH,
    };
  });
  const discoveredCount = order.filter((o) => o.discovered).length;
  const total = BOSS_RUSH_ORDER.length;
  return {
    unlocked: norm.bossRushUnlocked ?? false,
    discoveredCount,
    total,
    label: `Bosses discovered ${discoveredCount}/${total}`,
    order,
  };
}
