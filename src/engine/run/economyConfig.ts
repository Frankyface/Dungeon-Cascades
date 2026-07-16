/**
 * Economy configuration — ALL tunable constants of the Stage-3 non-combat nodes in one
 * module (gold rewards, shop prices, rest heal), so re-balancing the economy is a
 * single-file change (docs/decisions.md: "the interesting design surface … is data the
 * sims + Cam tune, not architecture").
 *
 * The gold formula deliberately uses whole, hand-computable numbers so the reward
 * fixtures (fast/slow/hurt/clean wins) can be checked by arithmetic. Every value here is
 * sim-tunable; the run/combat ENGINE reads these — it never hardcodes them.
 *
 * PURE ENGINE: no React / React Native imports; no wall-clock or ambient randomness.
 */

// ── Performance-scaled gold (feature-economy-nodes.md) ───────────────────────────────
//
// reward = (GOLD_BASE + speedBonus + hpBonus) × (elite ? ELITE_GOLD_MULT : 1)
//   speedBonus = GOLD_SPEED_BONUS_MAX × clamp((GOLD_MEDIAN_TURNS − turns)/(GOLD_MEDIAN_TURNS−1), 0, 1)
//   hpBonus    = GOLD_HP_BONUS_MAX    × clamp(hpRetained / maxHp, 0, 1)
// then the `onGoldEarned` relic hook is folded in and the total is rounded ONCE (≥0).

/** Flat gold every encounter win pays before performance bonuses. */
export const GOLD_BASE = 10;

/** Maximum speed bonus, earned by winning in 1 turn (or fewer than the fast floor). */
export const GOLD_SPEED_BONUS_MAX = 8;

/**
 * The "median" turns-to-win the speed bonus is measured against: winning at/after this
 * many turns earns 0 speed bonus, winning faster earns proportionally more (up to the max
 * at 1 turn). A config knob, NOT the observed sim median — the sim tunes it to taste.
 */
export const GOLD_MEDIAN_TURNS = 6;

/** Maximum HP-retained bonus, earned by finishing the fight at full HP. */
export const GOLD_HP_BONUS_MAX = 6;

/** Elite encounters multiply the whole (base + bonuses) reward. */
export const ELITE_GOLD_MULT = 2;

/** Gold the player starts a run with. */
export const STARTING_GOLD = 0;

// ── Shop (feature-economy-nodes.md) ──────────────────────────────────────────────────

/** Min / max number of unowned relics a shop stocks (plus one heal item). */
export const SHOP_RELIC_MIN = 2;
export const SHOP_RELIC_MAX = 3;

/** Relic price by tier. */
export const SHOP_PRICE_NORMAL = 45;
export const SHOP_PRICE_ELITE = 70;

/** The single instant-heal item a shop always stocks: amount healed + its price. */
export const SHOP_HEAL_AMOUNT = 30;
export const SHOP_HEAL_PRICE = 25;

// ── Rest (feature-economy-nodes.md) ──────────────────────────────────────────────────

/** Fraction of MAX HP a rest site heals (rounded); capped at max HP. */
export const REST_HEAL_FRACTION = 0.3;

// ── Events (feature-economy-nodes.md) ────────────────────────────────────────────────

/** Gold granted instead of a relic when a relic reward lands but the pool is exhausted. */
export const EVENT_RELIC_FALLBACK_GOLD = 30;

/** Floor an event's HP loss can never push the player below (events never kill — combat does). */
export const EVENT_MIN_HP = 1;

/** The full economy config bundled for threading a tuned variant without touching globals. */
export interface EconomyConfig {
  readonly goldBase: number;
  readonly goldSpeedBonusMax: number;
  readonly goldMedianTurns: number;
  readonly goldHpBonusMax: number;
  readonly eliteGoldMult: number;
  readonly restHealFraction: number;
}

/** The default economy config (values above). */
export const DEFAULT_ECONOMY_CONFIG: EconomyConfig = {
  goldBase: GOLD_BASE,
  goldSpeedBonusMax: GOLD_SPEED_BONUS_MAX,
  goldMedianTurns: GOLD_MEDIAN_TURNS,
  goldHpBonusMax: GOLD_HP_BONUS_MAX,
  eliteGoldMult: ELITE_GOLD_MULT,
  restHealFraction: REST_HEAL_FRACTION,
};
