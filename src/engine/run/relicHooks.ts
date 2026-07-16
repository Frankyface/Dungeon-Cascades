/**
 * The relic-hook ENGINE: pure functions that fold a player's owned relics over a value at
 * a hook, plus the adapters that inject those folds into combat.
 *
 * COMPOSITION ORDER (documented, deterministic — the law fixtures pin):
 *   For a given hook and value, collect every owned relic's modifier for that hook whose
 *   conditions match the context (`color` and `kind` gates; `perCombo` scales `amount` by
 *   `max(0, totalCombos − 1)`). Then:
 *        value' = (value + Σ add_i) × Π (1 + mul_j)
 *   i.e. ALL additive modifiers apply first (summed), THEN all multiplicative modifiers
 *   (as a product of factors). Within each class the operation is commutative, so the only
 *   order that matters is additive-strictly-before-multiplicative; relics are folded in
 *   the given owned-list order (canonical roster order in practice). No rounding happens
 *   here — rounding stays at the aggregate call sites (combat's single-rounding-site rule).
 *
 * PURE ENGINE: no React / React Native imports; deterministic; never mutates input.
 */
import type { Path, TileSource } from '../board';
import type { CombatConfig, CombatModifiers, CombatState, Enemy, EnemyId, TurnResolution } from '../combat';
import { playTurn, startEncounter } from '../combat';
import { RELIC_REGISTRY } from './relics';
import type { HookName, RelicContext, RelicModifier, RelicRegistry } from './relicTypes';

/** Does a modifier's conditions match this context? (Absent conditions always match.) */
function matches(mod: RelicModifier, context: RelicContext): boolean {
  if (mod.color !== undefined && mod.color !== context.color) return false;
  if (mod.kind !== undefined && mod.kind !== context.kind) return false;
  return true;
}

/** A modifier's effective amount for this context (applies `perCombo` scaling). */
function effectiveAmount(mod: RelicModifier, context: RelicContext): number {
  if (mod.perCombo) {
    return mod.amount * Math.max(0, (context.totalCombos ?? 1) - 1);
  }
  return mod.amount;
}

/**
 * Fold every owned relic's `hook` modifier over `value` in the documented order and return
 * the transformed value. Pure. `registry` defaults to the canonical roster; tests may pass
 * a custom registry to exercise the composition law with synthetic relics.
 */
export function applyRelicHooks(
  hook: HookName,
  value: number,
  context: RelicContext,
  relicIds: readonly string[],
  registry: RelicRegistry = RELIC_REGISTRY,
): number {
  let sumAdd = 0;
  let prodMul = 1;

  for (const id of relicIds) {
    const relic = registry[id];
    if (relic === undefined) continue; // unknown ids are inert (defensive; drafts never add them)
    const mod = relic.hooks[hook];
    if (mod === undefined || !matches(mod, context)) continue;

    const eff = effectiveAmount(mod, context);
    if (mod.op === 'add') sumAdd += eff;
    else prodMul *= 1 + eff;
  }

  return (value + sumAdd) * prodMul;
}

/** Whether any owned relic declares a modifier for `hook`. */
function anyRelicHasHook(hook: HookName, relicIds: readonly string[], registry: RelicRegistry): boolean {
  return relicIds.some((id) => registry[id]?.hooks[hook] !== undefined);
}

/**
 * Build the combat `CombatModifiers` seam from a player's owned relics. Each transform is
 * included ONLY if some owned relic touches its hook, so a player with no relevant relic
 * leaves the combat path byte-identical (an empty object ⇒ Stage-2 behavior).
 */
export function buildCombatModifiers(
  relicIds: readonly string[],
  registry: RelicRegistry = RELIC_REGISTRY,
): CombatModifiers {
  const mods: {
    damageGroup?: CombatModifiers['damageGroup'];
    healGroup?: CombatModifiers['healGroup'];
    incomingAttack?: CombatModifiers['incomingAttack'];
  } = {};

  if (anyRelicHasHook('onDamageComputed', relicIds, registry)) {
    mods.damageGroup = (baseAmount, color, _size, totalCombos) =>
      applyRelicHooks('onDamageComputed', baseAmount, { color, totalCombos }, relicIds, registry);
  }
  if (anyRelicHasHook('onHealComputed', relicIds, registry)) {
    mods.healGroup = (baseAmount, _size, totalCombos) =>
      applyRelicHooks('onHealComputed', baseAmount, { totalCombos }, relicIds, registry);
  }
  if (anyRelicHasHook('onIncomingDamage', relicIds, registry)) {
    mods.incomingAttack = (value) => applyRelicHooks('onIncomingDamage', value, {}, relicIds, registry);
  }

  return mods;
}

/** Enemy HP removed up front at combat start (onCombatStart 'enemyChip'), rounded, ≥0. */
export function combatStartEnemyChip(relicIds: readonly string[], registry: RelicRegistry = RELIC_REGISTRY): number {
  return Math.max(0, Math.round(applyRelicHooks('onCombatStart', 0, { kind: 'enemyChip' }, relicIds, registry)));
}

/** Player heal/shield granted at combat start (onCombatStart 'playerHeal'), rounded, ≥0. */
export function combatStartPlayerHeal(relicIds: readonly string[], registry: RelicRegistry = RELIC_REGISTRY): number {
  return Math.max(0, Math.round(applyRelicHooks('onCombatStart', 0, { kind: 'playerHeal' }, relicIds, registry)));
}

/** HP healed at the start of each player turn (onTurnStart 'regen'), rounded, ≥0. */
export function turnStartRegen(relicIds: readonly string[], registry: RelicRegistry = RELIC_REGISTRY): number {
  return Math.max(0, Math.round(applyRelicHooks('onTurnStart', 0, { kind: 'regen' }, relicIds, registry)));
}

/** A gold reward after economy relics (onGoldEarned), rounded, ≥0. */
export function applyGoldRelics(
  baseGold: number,
  relicIds: readonly string[],
  registry: RelicRegistry = RELIC_REGISTRY,
): number {
  return Math.max(0, Math.round(applyRelicHooks('onGoldEarned', baseGold, {}, relicIds, registry)));
}

/** Options for the relic-aware encounter wrappers (all optional). */
export interface RelicEncounterOptions {
  readonly source?: TileSource;
  readonly config?: CombatConfig;
  readonly registry?: RelicRegistry;
  /** Player HP when the fight begins (HP persists across nodes); defaults to max HP. */
  readonly startingPlayerHp?: number;
  /**
   * Run-layer enemy override (difficulty-scaled fight / elite / boss). Passed straight to
   * combat's `startEncounter`; when omitted the base registry enemy is used. See the combat
   * `CombatState.enemy` seam.
   */
  readonly enemy?: Enemy;
}

/**
 * Start an encounter with combat-start relics applied — WITHOUT editing combat: it calls
 * combat's `startEncounter`, then chips the enemy (never below 1 HP) and applies the
 * start-heal on top of the player's carried-over HP (capped at max). Convenience for the
 * later run-lifecycle agent; with no combat-start relics it equals a plain start (aside
 * from any `startingPlayerHp`).
 */
export function startEncounterWithRelics(
  enemyId: EnemyId,
  seed: number,
  relicIds: readonly string[],
  options: RelicEncounterOptions = {},
): CombatState {
  const registry = options.registry ?? RELIC_REGISTRY;
  const base = startEncounter(enemyId, seed, options.source, options.config, options.enemy);
  const chip = combatStartEnemyChip(relicIds, registry);
  const heal = combatStartPlayerHeal(relicIds, registry);
  const startHp = options.startingPlayerHp ?? base.playerMaxHp;

  return {
    ...base,
    enemyHp: Math.max(1, base.enemyMaxHp - chip),
    playerHp: Math.min(base.playerMaxHp, startHp + heal),
  };
}

/**
 * Play one turn with relics applied: turn-start regen heals the player first, then the
 * move resolves through the relic combat seam (damage/heal/defense). Delegates to combat's
 * `playTurn` — the turn-order state machine is NOT duplicated. With no relics this equals a
 * plain `playTurn`.
 */
export function playTurnWithRelics(
  state: CombatState,
  path: Path,
  relicIds: readonly string[],
  options: RelicEncounterOptions = {},
): TurnResolution {
  const registry = options.registry ?? RELIC_REGISTRY;
  const regen = turnStartRegen(relicIds, registry);
  const healed: CombatState =
    regen > 0 ? { ...state, playerHp: Math.min(state.playerMaxHp, state.playerHp + regen) } : state;
  const modifiers = buildCombatModifiers(relicIds, registry);
  return playTurn(healed, path, options.source, options.config, modifiers);
}
