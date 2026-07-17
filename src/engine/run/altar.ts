/**
 * The Altar node's pure mechanics (Stage-6 wave 2, spec-systems.md §2c).
 *
 * Two things live here, both pure & seeded:
 *   • the DEPTH-SCALED rarity ODDS TABLE (deeper = higher epic/legendary chance), and
 *   • the seeded PICK of one not-yet-unlocked relic from the LOCKED pool at those odds, degrading
 *     gracefully when the rolled rarity's locked pool is empty.
 * The run→terminal transition and the META unlock application live in the run flow (`sacrificeAtAltar`)
 * and `unlocks.applyAltarUnlock`; this module is just the odds + the deterministic draw.
 *
 * PURE ENGINE: no React / React Native imports; deterministic; never mutates input.
 */
import { nextFloat } from '../board';
import type { RngState } from '../board';
import { RELIC_IDS, RELIC_REGISTRY, getRelic } from './relics';
import type { RelicRegistry, RelicTier } from './relicTypes';
import { ACT_FLOOR_SPAN, actFloorOffset } from './runConfig';

/** A rarity odds row: the probabilities of unlocking a common / epic / legendary. Sums to 1. */
export interface AltarOdds {
  readonly common: number;
  readonly epic: number;
  readonly legendary: number;
}

/**
 * The two ANCHORS of the depth-scaled odds table (spec §2c: "act1-early 90/10/0 → act2-late
 * 30/45/25"). `altarOdds` linearly interpolates between them by GLOBAL depth, so every intermediate
 * row also sums to 1. Sim-tunable constants — retune the two anchors to reshape the whole ramp.
 */
export const ALTAR_ODDS_SHALLOW: AltarOdds = { common: 0.9, epic: 0.1, legendary: 0.0 };
export const ALTAR_ODDS_DEEP: AltarOdds = { common: 0.3, epic: 0.45, legendary: 0.25 };

/** The deepest reachable GLOBAL floor (Act-2 boss floor: local 12 + one Act span = 25). */
const MAX_GLOBAL_FLOOR = ACT_FLOOR_SPAN * 2 - 1;

/**
 * The rarity odds at (act, floor), interpolated by GLOBAL depth `floor + actFloorOffset(act)`:
 * shallow anchor at depth 0, deep anchor at the Act-2 boss floor. Because both anchors sum to 1, the
 * returned row sums to 1 for every depth. Depth is clamped into range (an Act-3 would just cap deep).
 */
export function altarOdds(act: number, floor: number): AltarOdds {
  const depth = Math.max(0, floor) + actFloorOffset(act);
  const t = Math.min(1, Math.max(0, depth / MAX_GLOBAL_FLOOR));
  const lerp = (a: number, b: number): number => a + (b - a) * t;
  return {
    common: lerp(ALTAR_ODDS_SHALLOW.common, ALTAR_ODDS_DEEP.common),
    epic: lerp(ALTAR_ODDS_SHALLOW.epic, ALTAR_ODDS_DEEP.epic),
    legendary: lerp(ALTAR_ODDS_SHALLOW.legendary, ALTAR_ODDS_DEEP.legendary),
  };
}

/** Map a [0,1) roll to a rarity by cumulative odds (common → epic → legendary). */
function rollRarity(roll: number, odds: AltarOdds): RelicTier {
  if (roll < odds.common) return 'common';
  if (roll < odds.common + odds.epic) return 'epic';
  return 'legendary';
}

/** The outcome of an altar sacrifice's seeded draw. `relicId === null` ⇒ nothing left to unlock. */
export interface AltarPick {
  readonly relicId: string | null;
  /** The rarity actually unlocked (may differ from the rolled rarity after graceful degradation). */
  readonly rarity: RelicTier | null;
  readonly rngState: RngState;
}

/**
 * Seeded pick of ONE relic to unlock at an altar at (act, floor). Draws only from the LOCKED pool
 * (relics NOT in `unlockedRelicIds`): roll a rarity by `altarOdds`, then pick uniformly from that
 * rarity's locked relics in canonical order. GRACEFUL DEGRADATION: if the rolled rarity has no
 * locked relics left, the pick falls back to the WHOLE locked pool (any rarity); if EVERYTHING is
 * already unlocked, returns `{ relicId: null }`. Deterministic; threads `rngState`.
 */
export function pickAltarUnlock(
  rngState: RngState,
  unlockedRelicIds: readonly string[],
  act: number,
  floor: number,
  registry: RelicRegistry = RELIC_REGISTRY,
): AltarPick {
  const unlocked = new Set(unlockedRelicIds);
  const lockedIds = (registry === RELIC_REGISTRY ? RELIC_IDS : Object.keys(registry)).filter(
    (id) => !unlocked.has(id),
  );
  if (lockedIds.length === 0) return { relicId: null, rarity: null, rngState };

  const odds = altarOdds(act, floor);
  const rarityRoll = nextFloat(rngState);
  let state = rarityRoll.state;
  const rolledRarity = rollRarity(rarityRoll.value, odds);

  // The rolled rarity's locked pool, or — if it is empty — the whole locked pool (graceful degrade).
  const byRarity = lockedIds.filter((id) => getRelic(id, registry).tier === rolledRarity);
  const pool = byRarity.length > 0 ? byRarity : lockedIds;

  const pickRoll = nextFloat(state);
  state = pickRoll.state;
  const idx = Math.min(pool.length - 1, Math.floor(pickRoll.value * pool.length));
  const relicId = pool[idx];
  return { relicId, rarity: getRelic(relicId, registry).tier, rngState: state };
}

/**
 * The TRUE (post-degradation) rarity distribution a sacrifice will actually unlock at (act, floor),
 * given the locked pool implied by `unlockedRelicIds`. The raw `altarOdds` ramp is the roll table, but
 * `pickAltarUnlock` GRACEFULLY DEGRADES: a rolled rarity whose locked pool is empty falls back to a
 * uniform draw over the WHOLE locked pool. So a rarity with zero locked relics can never be unlocked,
 * and its raw probability mass is redistributed over the rarities that DO have locked relics, in
 * proportion to their share of the locked pool. This function computes that effective distribution so
 * the UI shows the odds a player will actually experience — not the raw ramp (review M2 / manager
 * ruling: "25% legendary" must not display when zero legendaries remain to unlock).
 *
 * Derivation: with raw odds `p_R` and locked counts `n_X` (total `N`), the effective chance of
 * unlocking rarity X is `(n_X > 0 ? p_X : 0) + (Σ_{R: n_R = 0} p_R) · (n_X / N)`. Empty rarities get 0;
 * the total always sums to 1 (or all-zero when nothing is left to unlock). Pure; never mutates input.
 */
export function effectiveAltarOdds(
  unlockedRelicIds: readonly string[],
  act: number,
  floor: number,
  registry: RelicRegistry = RELIC_REGISTRY,
): AltarOdds {
  const unlocked = new Set(unlockedRelicIds);
  const lockedIds = (registry === RELIC_REGISTRY ? RELIC_IDS : Object.keys(registry)).filter(
    (id) => !unlocked.has(id),
  );
  const total = lockedIds.length;
  if (total === 0) return { common: 0, epic: 0, legendary: 0 }; // nothing left to unlock

  const counts: Record<RelicTier, number> = { common: 0, epic: 0, legendary: 0 };
  for (const id of lockedIds) counts[getRelic(id, registry).tier] += 1;

  const raw = altarOdds(act, floor);
  // The probability mass of every EMPTY rarity pool is redistributed over the locked composition.
  const degraded =
    (counts.common === 0 ? raw.common : 0) +
    (counts.epic === 0 ? raw.epic : 0) +
    (counts.legendary === 0 ? raw.legendary : 0);
  const effective = (tier: RelicTier, p: number): number =>
    counts[tier] > 0 ? p + degraded * (counts[tier] / total) : 0;
  return {
    common: effective('common', raw.common),
    epic: effective('epic', raw.epic),
    legendary: effective('legendary', raw.legendary),
  };
}
