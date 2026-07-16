/**
 * Serializable data model for the relic system (Stage 3).
 *
 * The relic ENGINE (typed hooks applied in a defined order) is the real feature; an
 * individual relic is DATA — a name, flavor, tier, and a map of hook → modifier. Adding a
 * relic is a data entry, never engine code (feature-relics-drafting.md). RunState carries
 * only relic IDs; all behavior derives from these declarative modifiers, so relics stay
 * pure and serializable-friendly.
 *
 * PURE ENGINE: no React / React Native imports; deterministic; never mutates input.
 */
import type { TileColor } from '../board';

/**
 * The relic trigger hooks. The first five are the feature's required minimum; the sixth,
 * `onIncomingDamage`, is an intentional extension so a defensive relic can soften an
 * incoming enemy attack without being a Block tile (allowed — the feature asks for these
 * as a MINIMUM). Each hook is a pure value-transform site (see applyRelicHooks).
 * - `onDamageComputed`: a cleared DAMAGE group's pre-cascade amount (per group).
 * - `onHealComputed`  : a cleared HEAL group's pre-cascade amount (per group).
 * - `onCombatStart`   : a combat-start quantity, disambiguated by `context.kind`
 *                       ('enemyChip' = enemy HP removed up front; 'playerHeal' = heal/shield).
 * - `onTurnStart`     : a per-turn quantity (`context.kind` 'regen' = HP healed each turn).
 * - `onGoldEarned`    : a gold reward before it is banked (economy).
 * - `onIncomingDamage`: an incoming enemy attack value before it hits the player (defense).
 */
export type HookName =
  | 'onDamageComputed'
  | 'onHealComputed'
  | 'onCombatStart'
  | 'onTurnStart'
  | 'onGoldEarned'
  | 'onIncomingDamage';

/** The full set of hooks, in canonical order (for iteration / registry validation). */
export const HOOK_NAMES: readonly HookName[] = [
  'onDamageComputed',
  'onHealComputed',
  'onCombatStart',
  'onTurnStart',
  'onGoldEarned',
  'onIncomingDamage',
];

/** Rarity tiers (v1 keeps two per decisions.md: common `normal` and `elite`-weighted). */
export type RelicTier = 'normal' | 'elite';

/**
 * One declarative modifier a relic applies at a hook.
 * - `op`: `add` contributes to the additive sum; `mul` contributes a factor (see below).
 * - `amount`: for `add`, the flat delta; for `mul`, the fractional delta (0.5 ⇒ ×1.5).
 * - `color`  (condition): apply only when `context.color` matches (per-color damage relics).
 * - `kind`   (condition): apply only when `context.kind` matches (combat-start / turn-start channels).
 * - `perCombo`: scale `amount` by `(context.totalCombos − 1)` — the cascade-scaling relic.
 */
export interface RelicModifier {
  readonly op: 'add' | 'mul';
  readonly amount: number;
  readonly color?: TileColor;
  readonly kind?: string;
  readonly perCombo?: boolean;
}

/** A relic as pure data: identity, flavor, tier, and its per-hook modifiers. */
export interface Relic {
  readonly id: string;
  readonly name: string;
  readonly flavor: string;
  readonly tier: RelicTier;
  readonly hooks: Partial<Record<HookName, RelicModifier>>;
}

/**
 * The context a hook application sees, for evaluating a modifier's conditions and scaling.
 * All fields optional — a call site supplies what its hook needs.
 */
export interface RelicContext {
  /** The damage group's color (onDamageComputed) — matched against a modifier's `color`. */
  readonly color?: TileColor;
  /** The move's total combo count (onDamageComputed) — drives `perCombo` scaling. */
  readonly totalCombos?: number;
  /** The sub-channel (onCombatStart / onTurnStart) — matched against a modifier's `kind`. */
  readonly kind?: string;
}

/** A registry mapping relic id → relic. The canonical roster is one such registry. */
export type RelicRegistry = Readonly<Record<string, Relic>>;
