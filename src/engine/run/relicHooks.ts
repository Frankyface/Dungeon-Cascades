/**
 * The relic-hook ENGINE: pure functions that fold a player's owned relics over a value at
 * a hook, plus the adapters that inject those folds into combat and the run layer.
 *
 * COMPOSITION ORDER (documented, deterministic — the law fixtures pin):
 *   For a given hook and value, collect every owned relic's modifier(s) for that hook whose
 *   conditions match the context (`color`, `kind`, `comboThreshold`, `playerHpBelow` gates;
 *   `perCombo` / `perRotStack` / `maxHpFraction` scale `amount`). Multiple modifiers on one
 *   hook are expressed as an `also` chain and folded together. Then:
 *        value' = (value + Σ add_i) × Π (1 + mul_j)
 *   i.e. ALL additive modifiers apply first (summed), THEN all multiplicative modifiers
 *   (as a product of factors). Within each class the operation is commutative, so the only
 *   order that matters is additive-strictly-before-multiplicative; relics are folded in
 *   the given owned-list order (canonical roster order in practice). No rounding happens
 *   here — rounding stays at the aggregate call sites (combat's single-rounding-site rule).
 *
 * `onCascadeWave` is folded SEPARATELY (`applyCascadeWaveHooks`): it sums a per-wave additive
 * effect over waves 2..N of a resolution, honoring the `perWaveIndex` snowball.
 *
 * PURE ENGINE: no React / React Native imports; deterministic; never mutates input.
 */
import type { Path, TileSource } from '../board';
import type { CombatConfig, CombatModifiers, CombatState, Enemy, EnemyId, TurnResolution } from '../combat';
import { playTurn, startEncounter } from '../combat';
import { RELIC_REGISTRY } from './relics';
import type { HookName, ModifierKind, RelicContext, RelicModifier, RelicRegistry } from './relicTypes';

/** Does a modifier's conditions match this context? (Absent conditions always match.) */
function matches(mod: RelicModifier, context: RelicContext): boolean {
  if (mod.color !== undefined && mod.color !== context.color) return false;
  if (mod.kind !== undefined && mod.kind !== context.kind) return false;
  if (mod.comboThreshold !== undefined && (context.totalCombos ?? 0) < mod.comboThreshold) return false;
  if (mod.playerHpBelow !== undefined && !((context.playerHpFraction ?? 1) < mod.playerHpBelow)) return false;
  return true;
}

/** A modifier's effective amount for this context (applies at most one scaling mode). */
function effectiveAmount(mod: RelicModifier, context: RelicContext): number {
  if (mod.perCombo) {
    return mod.amount * Math.max(0, (context.totalCombos ?? 1) - 1);
  }
  if (mod.perRotStack) {
    const stacks = Math.max(0, context.rotStacks ?? 0);
    return mod.amount * Math.min(mod.rotStackCap ?? Number.POSITIVE_INFINITY, stacks);
  }
  if (mod.maxHpFraction !== undefined) {
    return mod.maxHpFraction * Math.max(0, context.enemyMaxHp ?? 0);
  }
  return mod.amount;
}

/**
 * Fold every owned relic's `hook` modifier(s) over `value` in the documented order and return
 * the transformed value. Pure. `registry` defaults to the canonical roster; tests may pass a
 * custom registry to exercise the composition law with synthetic relics. Multi-channel relics
 * (an `also` chain) contribute every matching link.
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
    let mod: RelicModifier | undefined = relic.hooks[hook];
    while (mod !== undefined) {
      if (matches(mod, context)) {
        const eff = effectiveAmount(mod, context);
        if (mod.op === 'add') sumAdd += eff;
        else prodMul *= 1 + eff;
      }
      mod = mod.also;
    }
  }

  return (value + sumAdd) * prodMul;
}

/**
 * Fold the `onCascadeWave` hook over an N-wave resolution for one `kind`, returning the rounded
 * (≥0) additive total. Every cascade-wave effect is "each wave AFTER the first", so the sum runs
 * over waves 2..waveCount: a flat modifier contributes `amount` per such wave (× (waveCount−1));
 * a `perWaveIndex` modifier contributes `amount × (i−1)` on wave i (the chain snowball). All
 * cascade-wave modifiers are additive.
 */
export function applyCascadeWaveHooks(
  kind: ModifierKind,
  waveCount: number,
  relicIds: readonly string[],
  registry: RelicRegistry = RELIC_REGISTRY,
): number {
  const extraWaves = Math.max(0, Math.floor(waveCount) - 1);
  const perWaveIndexSum = (extraWaves * (extraWaves + 1)) / 2; // Σ_{j=1}^{extraWaves} j
  let total = 0;

  for (const id of relicIds) {
    const relic = registry[id];
    if (relic === undefined) continue;
    let mod: RelicModifier | undefined = relic.hooks.onCascadeWave;
    while (mod !== undefined) {
      if (mod.op === 'add' && mod.kind === kind) {
        total += mod.perWaveIndex ? mod.amount * perWaveIndexSum : mod.amount * extraWaves;
      }
      mod = mod.also;
    }
  }

  return Math.max(0, Math.round(total));
}

// APPLY-SITE CLAMPS — now LIVE in the combat engine (decisions.md 2026-07-17 R3). Both were once
// deferred to the combat-relic-integration wave; that wave landed, so the guards below are enforced:
//   • tremor-stone "enemy HP floored at 1" (content-relics.md #20): the onCascadeWave enemyDamage is
//     combined with the move damage in encounter.ts and the CASCADE portion floors the enemy at 1 —
//     `enemyHpAfterMatch <= 0 ? 0 : Math.max(1, enemyHpAfterMatch - cascadeEnemyDamage)` — so only the
//     player's own match damage can land the kill (the passive chip never does).
//   • per-group ≥0 clamp (ironroot-aegis, counterweight-sigil, tidal-coffers, zenith-chalice): a
//     negative additive/mul fold on a single damageGroup is clamped at 0 in effects.ts
//     (`Math.max(0, modifiers.damageGroup(...))`), so a group can never HEAL the enemy or eat another
//     group's damage in the sum.
/** onCascadeWave — direct enemy HP loss summed over waves 2..N (rounded ≥0). */
export function cascadeWaveEnemyDamage(
  waveCount: number,
  relicIds: readonly string[],
  registry: RelicRegistry = RELIC_REGISTRY,
): number {
  return applyCascadeWaveHooks('enemyDamage', waveCount, relicIds, registry);
}

/** onCascadeWave — player heal summed over waves 2..N (rounded ≥0; capped at max HP by the caller). */
export function cascadeWavePlayerHeal(
  waveCount: number,
  relicIds: readonly string[],
  registry: RelicRegistry = RELIC_REGISTRY,
): number {
  return applyCascadeWaveHooks('playerHeal', waveCount, relicIds, registry);
}

/** onCascadeWave — gold summed over waves 2..N (rounded ≥0; banked at combat resolution by the caller). */
export function cascadeWaveGold(
  waveCount: number,
  relicIds: readonly string[],
  registry: RelicRegistry = RELIC_REGISTRY,
): number {
  return applyCascadeWaveHooks('gold', waveCount, relicIds, registry);
}

/** Whether any owned relic declares a modifier for `hook`. */
function anyRelicHasHook(hook: HookName, relicIds: readonly string[], registry: RelicRegistry): boolean {
  return relicIds.some((id) => registry[id]?.hooks[hook] !== undefined);
}

/**
 * Relic ids that grant ROT IMMUNITY — suppressing the Rotwood rot DoT tick in combat. This is a
 * combat CHANNEL-SUPPRESSION capability, not a value-transform hook (there is no `onRotTick` hook to
 * express it declaratively), so it is keyed by relic id here rather than by a hook. The Heartrot Seed
 * legendary is the only holder today (content-relics.md #5: "immune to spore/rot damage"); a future
 * rot-immunity relic joins this set. Kept as a set so `buildCombatModifiers` scans owned ids uniformly.
 */
const ROT_IMMUNITY_RELIC_IDS: ReadonlySet<string> = new Set<string>(['heartrot-seed']);

/** Whether any owned relic grants rot immunity (the Heartrot Seed's rot-tick suppression). */
function anyRelicGrantsRotImmunity(relicIds: readonly string[]): boolean {
  return relicIds.some((id) => ROT_IMMUNITY_RELIC_IDS.has(id));
}

/**
 * Build the combat `CombatModifiers` seam from a player's owned relics. Each transform is
 * included ONLY if some owned relic touches its hook, so a player with no relevant relic
 * leaves the combat path byte-identical (an empty object ⇒ Stage-2 behavior). The Stage-6
 * `cascadeWave` transform (per-wave enemy damage + player heal) mirrors the same discipline.
 */
export function buildCombatModifiers(
  relicIds: readonly string[],
  registry: RelicRegistry = RELIC_REGISTRY,
  context: Pick<RelicContext, 'rotStacks'> = {},
): CombatModifiers {
  const mods: {
    damageGroup?: CombatModifiers['damageGroup'];
    healGroup?: CombatModifiers['healGroup'];
    incomingAttack?: CombatModifiers['incomingAttack'];
    cascadeWave?: CombatModifiers['cascadeWave'];
    rotImmune?: CombatModifiers['rotImmune'];
  } = {};

  if (anyRelicHasHook('onDamageComputed', relicIds, registry)) {
    // The current player rot stacks are baked into the damage context (wave 1c) so the Rotwood
    // `perRotStack` damage relics (Sporecrown) actually scale in live combat. Absent (non-Rotwood
    // fights, base-12 runs) it is `undefined` ⇒ 0 ⇒ byte-identical to the pre-threading behavior.
    mods.damageGroup = (baseAmount, color, _size, totalCombos) =>
      applyRelicHooks('onDamageComputed', baseAmount, { color, totalCombos, rotStacks: context.rotStacks }, relicIds, registry);
  }
  if (anyRelicHasHook('onHealComputed', relicIds, registry)) {
    mods.healGroup = (baseAmount, _size, totalCombos) =>
      applyRelicHooks('onHealComputed', baseAmount, { totalCombos }, relicIds, registry);
  }
  if (anyRelicHasHook('onIncomingDamage', relicIds, registry)) {
    mods.incomingAttack = (value) => applyRelicHooks('onIncomingDamage', value, {}, relicIds, registry);
  }
  if (anyRelicHasHook('onCascadeWave', relicIds, registry)) {
    mods.cascadeWave = (waveCount) => ({
      enemyDamage: cascadeWaveEnemyDamage(waveCount, relicIds, registry),
      playerHeal: cascadeWavePlayerHeal(waveCount, relicIds, registry),
    });
  }
  // Heartrot Seed (content-relics.md #5): suppress the rot DoT tick in combat. Additive — a player
  // without a rot-immunity relic leaves this undefined ⇒ rot ticks as normal ⇒ byte-identical.
  if (anyRelicGrantsRotImmunity(relicIds)) mods.rotImmune = true;

  return mods;
}

/**
 * Enemy HP removed up front at combat start (onCombatStart 'enemyChip'), rounded, ≥0. `enemyMaxHp`
 * feeds percent-of-max chips (the `maxHpFraction` mode); flat chips ignore it, so omitting it stays
 * byte-identical for every flat-chip relic.
 */
export function combatStartEnemyChip(
  relicIds: readonly string[],
  registry: RelicRegistry = RELIC_REGISTRY,
  enemyMaxHp?: number,
): number {
  return Math.max(0, Math.round(applyRelicHooks('onCombatStart', 0, { kind: 'enemyChip', enemyMaxHp }, relicIds, registry)));
}

/** Player heal/shield granted at combat start (onCombatStart 'playerHeal'), rounded, ≥0. */
export function combatStartPlayerHeal(relicIds: readonly string[], registry: RelicRegistry = RELIC_REGISTRY): number {
  return Math.max(0, Math.round(applyRelicHooks('onCombatStart', 0, { kind: 'playerHeal' }, relicIds, registry)));
}

/**
 * HP healed at the start of each player turn (onTurnStart 'regen'), rounded, ≥0. `context` lets
 * the caller thread the comeback / Rotwood signals (player HP fraction, rot stacks) the newer
 * conditional-regen relics read; omitting them keeps the flat-regen relics byte-identical.
 */
export function turnStartRegen(
  relicIds: readonly string[],
  registry: RelicRegistry = RELIC_REGISTRY,
  context: Pick<RelicContext, 'playerHpFraction' | 'rotStacks'> = {},
): number {
  return Math.max(
    0,
    Math.round(applyRelicHooks('onTurnStart', 0, { kind: 'regen', ...context }, relicIds, registry)),
  );
}

/** A gold reward after economy relics (onGoldEarned), rounded, ≥0. */
export function applyGoldRelics(
  baseGold: number,
  relicIds: readonly string[],
  registry: RelicRegistry = RELIC_REGISTRY,
): number {
  return Math.max(0, Math.round(applyRelicHooks('onGoldEarned', baseGold, {}, relicIds, registry)));
}

// ── Stage-6 run-layer event helpers (pure folds; wave 1c/2 invokes them at the right moments) ──
//
// These mirror the combat-start / gold helpers: a thin round-≥0 wrapper over `applyRelicHooks`
// on the relevant hook + kind. They are unit-tested directly; runFlow is NOT rewired this wave.

/** Bonus gold granted each time an enemy is defeated (onEnemyDefeated 'gold'), rounded ≥0. */
export function enemyDefeatedGold(relicIds: readonly string[], registry: RelicRegistry = RELIC_REGISTRY): number {
  return Math.max(0, Math.round(applyRelicHooks('onEnemyDefeated', 0, { kind: 'gold' }, relicIds, registry)));
}

/** HP healed each time an enemy is defeated (onEnemyDefeated 'playerHeal'), rounded ≥0 (cap at apply site). */
export function enemyDefeatedPlayerHeal(relicIds: readonly string[], registry: RelicRegistry = RELIC_REGISTRY): number {
  return Math.max(0, Math.round(applyRelicHooks('onEnemyDefeated', 0, { kind: 'playerHeal' }, relicIds, registry)));
}

/** Bonus gold granted at the start of each act (onActStart 'gold'), rounded ≥0. */
export function actStartGold(relicIds: readonly string[], registry: RelicRegistry = RELIC_REGISTRY): number {
  return Math.max(0, Math.round(applyRelicHooks('onActStart', 0, { kind: 'gold' }, relicIds, registry)));
}

/** HP healed at the start of each act (onActStart 'playerHeal'), rounded ≥0 (cap at apply site). */
export function actStartPlayerHeal(relicIds: readonly string[], registry: RelicRegistry = RELIC_REGISTRY): number {
  return Math.max(0, Math.round(applyRelicHooks('onActStart', 0, { kind: 'playerHeal' }, relicIds, registry)));
}

/** Bonus gold granted when a Rest node is used (onRestUsed 'gold'), rounded ≥0. */
export function restUsedGold(relicIds: readonly string[], registry: RelicRegistry = RELIC_REGISTRY): number {
  return Math.max(0, Math.round(applyRelicHooks('onRestUsed', 0, { kind: 'gold' }, relicIds, registry)));
}

/** Bonus HP healed (beyond the node's base rest) when a Rest node is used (onRestUsed 'playerHeal'), rounded ≥0. */
export function restUsedPlayerHeal(relicIds: readonly string[], registry: RelicRegistry = RELIC_REGISTRY): number {
  return Math.max(0, Math.round(applyRelicHooks('onRestUsed', 0, { kind: 'playerHeal' }, relicIds, registry)));
}

/**
 * Transform a Rest node's base heal by the rest-heal VALUE-TRANSFORM relics (onRestUsed 'restHeal'),
 * rounded ≥0. Distinct from the additive `restUsedPlayerHeal` side-channel: this scales the node's
 * own heal (Wanderer's Hearth ×2, Ascetic's Vow ×0).
 */
export function restHealAmount(
  baseRestHeal: number,
  relicIds: readonly string[],
  registry: RelicRegistry = RELIC_REGISTRY,
): number {
  return Math.max(0, Math.round(applyRelicHooks('onRestUsed', baseRestHeal, { kind: 'restHeal' }, relicIds, registry)));
}

/** Bonus gold refunded per shop purchase (onShopPurchase 'gold' rebate), rounded ≥0. */
export function shopPurchaseGold(relicIds: readonly string[], registry: RelicRegistry = RELIC_REGISTRY): number {
  return Math.max(0, Math.round(applyRelicHooks('onShopPurchase', 0, { kind: 'gold' }, relicIds, registry)));
}

/** HP healed per shop purchase (onShopPurchase 'playerHeal'), rounded ≥0 (cap at apply site). */
export function shopPurchasePlayerHeal(relicIds: readonly string[], registry: RelicRegistry = RELIC_REGISTRY): number {
  return Math.max(0, Math.round(applyRelicHooks('onShopPurchase', 0, { kind: 'playerHeal' }, relicIds, registry)));
}

/**
 * Transform a shop price by the price VALUE-TRANSFORM relics (onShopPurchase 'price'), rounded ≥0.
 * Distinct from the additive `shopPurchaseGold` rebate: this scales the sticker price (Haggler's
 * Charm ×0.60).
 */
export function shopPrice(
  basePrice: number,
  relicIds: readonly string[],
  registry: RelicRegistry = RELIC_REGISTRY,
): number {
  return Math.max(0, Math.round(applyRelicHooks('onShopPurchase', basePrice, { kind: 'price' }, relicIds, registry)));
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
  const chip = combatStartEnemyChip(relicIds, registry, base.enemyMaxHp);
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
 * move resolves through the relic combat seam (damage/heal/defense/cascade-wave). Delegates to
 * combat's `playTurn` — the turn-order state machine is NOT duplicated. With no relics this
 * equals a plain `playTurn`. The regen context threads the player's current HP fraction so the
 * comeback-regen relics evaluate correctly.
 */
export function playTurnWithRelics(
  state: CombatState,
  path: Path,
  relicIds: readonly string[],
  options: RelicEncounterOptions = {},
): TurnResolution {
  const registry = options.registry ?? RELIC_REGISTRY;
  const regen = turnStartRegen(relicIds, registry, {
    playerHpFraction: state.playerMaxHp > 0 ? state.playerHp / state.playerMaxHp : 0,
    rotStacks: state.rotStacks,
  });
  const healed: CombatState =
    regen > 0 ? { ...state, playerHp: Math.min(state.playerMaxHp, state.playerHp + regen) } : state;
  // Thread the player's current rot stacks into the damage context so Rotwood `perRotStack` damage
  // relics evaluate in live combat; non-Rotwood fights carry no rot ⇒ byte-identical to before.
  const modifiers = buildCombatModifiers(relicIds, registry, { rotStacks: state.rotStacks });
  return playTurn(healed, path, options.source, options.config, modifiers);
}
