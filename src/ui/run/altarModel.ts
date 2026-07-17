/**
 * Pure view-model for the ALTAR screen (spec §2c): the dark ceremony's numbers. It reports the exact
 * trade (the run ENDS, counts as a defeat, one permanent relic unlocks at DEPTH-SCALED odds) and the
 * CURRENT odds row read straight from the engine's `altarOdds` table — so the percentages shown are
 * exactly the ones the seeded sacrifice draw will roll against. It never performs the draw; that is
 * the engine's `sacrificeAtAltar` (which the screen calls on confirm).
 *
 * No React imports; deterministic; fully Jest-testable.
 */
import { RELIC_IDS, actFloorOffset, currentRunNode, effectiveAltarOdds, normalizeMeta } from '../../engine/run';
import type { AltarOdds, MetaState, RunState } from '../../engine/run';

/** The odds row as ready-to-render percentage strings (e.g. `90%` / `10%` / `0%`). */
export interface AltarOddsDisplay {
  readonly common: string;
  readonly epic: string;
  readonly legendary: string;
}

/** Everything the altar screen renders. */
export interface AltarView {
  readonly act: number;
  /** Local (in-act) floor. */
  readonly floor: number;
  /** Global depth (`floor + actFloorOffset(act)`) — what the odds ramp actually keys off. */
  readonly globalFloor: number;
  /**
   * The EFFECTIVE odds (fractions summing to 1, or all-zero when nothing is left) — the TRUE
   * post-degradation rarity distribution the seeded draw rolls against, NOT the raw depth ramp. So a
   * rarity with no locked relics reads its real ~0 share (review M2): the UI never promises a
   * legendary when none remain to unlock.
   */
  readonly odds: AltarOdds;
  /** The effective odds as percentage strings for the UI row. */
  readonly oddsPct: AltarOddsDisplay;
  /** How many relics are still LOCKED (the pool a sacrifice could unlock from). */
  readonly lockedCount: number;
  /** True when EVERY relic is already unlocked — a sacrifice would gain nothing. */
  readonly nothingLeft: boolean;
}

/** Format a [0,1] odds fraction as a rounded percentage string. */
function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/** Build the altar view from a run in the `altar` phase and the live meta profile. */
export function computeAltarView(state: RunState, meta: MetaState): AltarView {
  const floor = currentRunNode(state).floor;
  const unlockedIds = normalizeMeta(meta).unlockedRelicIds ?? [];
  const unlocked = new Set(unlockedIds);
  const lockedCount = RELIC_IDS.filter((id) => !unlocked.has(id)).length;
  // EFFECTIVE odds (post graceful-degradation) — exactly what the seeded sacrifice draw rolls against.
  const odds = effectiveAltarOdds(unlockedIds, state.act, floor);
  return {
    act: state.act,
    floor,
    globalFloor: floor + actFloorOffset(state.act),
    odds,
    oddsPct: { common: pct(odds.common), epic: pct(odds.epic), legendary: pct(odds.legendary) },
    lockedCount,
    nothingLeft: lockedCount === 0,
  };
}
