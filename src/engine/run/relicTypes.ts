/**
 * Serializable data model for the relic system (Stage 3, extended by Stage-6 wave 1b).
 *
 * The relic ENGINE (typed hooks applied in a defined order) is the real feature; an
 * individual relic is DATA — a name, flavor, tier, and a map of hook → modifier. Adding a
 * relic is a data entry, never engine code (feature-relics-drafting.md). RunState carries
 * only relic IDs; all behavior derives from these declarative modifiers, so relics stay
 * pure and serializable-friendly.
 *
 * CANONICAL SCHEMA (Stage-6 canonicalization reference, content-relics.md): there is ONE
 * authoritative spelling per hook name (`HOOK_NAMES`), per modifier kind (`MODIFIER_KINDS`),
 * and per condition key (the optional fields of `RelicModifier`). `assertRelicWellFormed`
 * (relics.ts) rejects any other spelling at load time so a typo'd relic is a TEST FAILURE,
 * never a silent no-op.
 *
 * PURE ENGINE: no React / React Native imports; deterministic; never mutates input.
 */
import type { TileColor } from '../board';

/**
 * The relic trigger hooks (canonical spellings; iteration order below).
 * Stage-3 base hooks:
 * - `onDamageComputed`: a cleared DAMAGE group's pre-cascade amount (per group).
 * - `onHealComputed`  : a cleared HEAL group's pre-cascade amount (per group).
 * - `onCombatStart`   : a combat-start quantity, disambiguated by `kind`
 *                       ('enemyChip' = enemy HP removed up front; 'playerHeal' = heal/shield).
 * - `onTurnStart`     : a per-turn quantity (`kind` 'regen' = HP healed each turn).
 * - `onGoldEarned`    : a gold reward before it is banked (economy).
 * - `onIncomingDamage`: an incoming enemy attack value before it hits the player (defense).
 * Stage-6 (wave 1b) approved hooks (spec-systems.md §7):
 * - `onCascadeWave`   : per resolution WAVE after the first — direct enemy damage / player
 *                       heal / gold (`kind` 'enemyDamage' | 'playerHeal' | 'gold').
 * - `onEnemyDefeated` : fires once per enemy death (`kind` 'gold' | 'playerHeal').
 * - `onActStart`      : fires at the start of each act (`kind` 'gold' | 'playerHeal').
 * - `onRestUsed`      : fires when a Rest node is used (`kind` 'restHeal' value-transform,
 *                       or 'gold' | 'playerHeal' additive side-channels).
 * - `onShopPurchase`  : fires per shop purchase (`kind` 'price' value-transform, or
 *                       'gold' rebate | 'playerHeal' additive side-channels).
 * Each hook is a pure value-transform / fold site (see relicHooks.applyRelicHooks).
 */
export type HookName =
  | 'onDamageComputed'
  | 'onHealComputed'
  | 'onCombatStart'
  | 'onTurnStart'
  | 'onGoldEarned'
  | 'onIncomingDamage'
  | 'onCascadeWave'
  | 'onEnemyDefeated'
  | 'onActStart'
  | 'onRestUsed'
  | 'onShopPurchase';

/** The full set of hooks, in canonical order (for iteration / registry validation). */
export const HOOK_NAMES: readonly HookName[] = [
  'onDamageComputed',
  'onHealComputed',
  'onCombatStart',
  'onTurnStart',
  'onGoldEarned',
  'onIncomingDamage',
  'onCascadeWave',
  'onEnemyDefeated',
  'onActStart',
  'onRestUsed',
  'onShopPurchase',
];

/**
 * The canonical modifier KINDS (sub-channel selectors, matched against a `RelicContext.kind`).
 * The canonicalization reference collapsed several audit-era spellings onto these:
 * `waveHeal`/`heal` → `playerHeal`, `waveGold` → `gold`. `restHeal` and `price` stay distinct
 * as the two VALUE-TRANSFORM channels (they transform a supplied base value), separate from the
 * additive side-effect channels (`gold`, `playerHeal`).
 * - `enemyChip`  : onCombatStart — enemy HP removed up front (direct, floored at 1 at apply site).
 * - `playerHeal` : additive player-heal side-channel (capped at max HP at apply site).
 * - `regen`      : onTurnStart — HP healed at each player-turn start.
 * - `gold`       : additive gold side-channel (banked at the apply site).
 * - `restHeal`   : onRestUsed — value-transform of the Rest node's base heal.
 * - `price`      : onShopPurchase — value-transform of a shop price.
 * - `enemyDamage`: onCascadeWave — direct, affinity-ignoring enemy HP loss.
 */
export type ModifierKind =
  | 'enemyChip'
  | 'playerHeal'
  | 'regen'
  | 'gold'
  | 'restHeal'
  | 'price'
  | 'enemyDamage';

/** The full set of canonical kinds (for registry validation). */
export const MODIFIER_KINDS: readonly ModifierKind[] = [
  'enemyChip',
  'playerHeal',
  'regen',
  'gold',
  'restHeal',
  'price',
  'enemyDamage',
];

/** Rarity tiers (Stage-6 three-tier scale; existing `normal`→`common`, `elite`→`epic`). */
export type RelicTier = 'common' | 'epic' | 'legendary';

/**
 * One declarative modifier a relic applies at a hook.
 * - `op`: `add` contributes to the additive sum; `mul` contributes a factor (see fold law).
 * - `amount`: for `add`, the flat delta; for `mul`, the fractional delta (0.5 ⇒ ×1.5).
 * CONDITIONS (all optional; an absent condition always matches):
 * - `color`         : apply only when `context.color` matches (per-color damage relics).
 * - `kind`          : apply only when `context.kind` matches (channel selector).
 * - `comboThreshold`: apply only when `context.totalCombos >= comboThreshold` (cascade cliff).
 * - `playerHpBelow` : apply only when `context.playerHpFraction < playerHpBelow` (comeback gate).
 * SCALING (mutually exclusive; an absent scaler leaves `amount` flat):
 * - `perCombo`     : scale `amount` by `max(0, totalCombos − 1)` (cascade-scaling relic).
 * - `perWaveIndex` : onCascadeWave — the amount on wave i is `amount × (i − 1)` (chain snowball).
 * - `perRotStack`  : scale `amount` by `min(rotStackCap ?? ∞, context.rotStacks)` (Rotwood relics).
 * - `maxHpFraction`: the amount is `maxHpFraction × context.enemyMaxHp` (percent-of-max chip).
 * CHAINING:
 * - `also`         : a SECOND modifier on the SAME hook (the array-of-modifiers generalization,
 *                    expressed as a backward-compatible chain so single-modifier relics — and the
 *                    tests that read `relic.hooks[hook]!.field` — keep the plain object shape).
 *                    `applyRelicHooks` folds the whole `also` chain.
 */
export interface RelicModifier {
  readonly op: 'add' | 'mul';
  readonly amount: number;
  readonly color?: TileColor;
  readonly kind?: ModifierKind;
  readonly comboThreshold?: number;
  readonly playerHpBelow?: number;
  readonly perCombo?: boolean;
  readonly perWaveIndex?: boolean;
  readonly perRotStack?: boolean;
  readonly rotStackCap?: number;
  readonly maxHpFraction?: number;
  readonly also?: RelicModifier;
}

/** A relic as pure data: identity, flavor, tier, unlock gate, and its per-hook modifiers. */
export interface Relic {
  readonly id: string;
  readonly name: string;
  readonly flavor: string;
  readonly tier: RelicTier;
  /**
   * Whether this relic is in the pool from the start. The base 12 are `true`; every Stage-6
   * expansion relic is `false` (unlocked later via biome/boss/altar meta paths — wave 2). Draft
   * and shop pools filter to the unlocked-by-default set unless an explicit `unlockedIds` filter
   * is supplied. Optional so synthetic test relics (never in the real roster) need not set it.
   */
  readonly unlockedByDefault?: boolean;
  readonly hooks: Partial<Record<HookName, RelicModifier>>;
}

/**
 * The context a hook application sees, for evaluating a modifier's conditions and scaling.
 * All fields optional — a call site supplies what its hook needs; an absent field means the
 * dependent condition/scaler is inert (0 / no-match).
 */
export interface RelicContext {
  /** The damage group's color (onDamageComputed) — matched against a modifier's `color`. */
  readonly color?: TileColor;
  /** The move's total combo count (onDamageComputed) — drives `perCombo` / `comboThreshold`. */
  readonly totalCombos?: number;
  /** The sub-channel — matched against a modifier's `kind`. */
  readonly kind?: ModifierKind;
  /** Player HP as a fraction of max (onTurnStart) — drives the `playerHpBelow` gate. */
  readonly playerHpFraction?: number;
  /** Rot stacks currently on the player (Rotwood) — drives `perRotStack` scaling. */
  readonly rotStacks?: number;
  /** The enemy's max HP (onCombatStart) — drives the `maxHpFraction` chip. */
  readonly enemyMaxHp?: number;
}

/** A registry mapping relic id → relic. The canonical roster is one such registry. */
export type RelicRegistry = Readonly<Record<string, Relic>>;
