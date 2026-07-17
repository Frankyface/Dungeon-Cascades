/**
 * The combat relic-hook SEAM (Stage 3 integration point).
 *
 * `CombatModifiers` is a small bundle of OPTIONAL pure transforms that `computeEffects`
 * and `playTurn` consult when — and ONLY when — it is supplied. Combat declares the
 * interface; the run layer (src/engine/run/relicHooks.ts) implements it from a player's
 * owned relic ids and injects it. Combat therefore stays free of any dependency on the
 * relic domain (no import cycle: run → combat, never the reverse).
 *
 * BACKWARD-COMPATIBILITY CONTRACT (the reason every field is optional):
 * with `modifiers` omitted — or any individual transform omitted — the combat math is
 * BYTE-IDENTICAL to the Stage-2 engine. Every existing combat call site (tests, the
 * combat sim) passes no modifiers and is provably unchanged. See docs: Stage-2 combat
 * without relics must stay bit-identical.
 *
 * PURE ENGINE: no React / React Native imports; deterministic; never mutates input.
 */
import type { TileColor } from './types';

/**
 * Optional per-outcome transforms applied during a turn. All are pure number→number
 * (or group→number) functions; the run layer builds them by folding relic hooks.
 *
 * - `damageGroup`: transform ONE cleared damage group's pre-cascade amount. Receives
 *   the group's post-affinity base amount plus its color, size, and the move's total
 *   combo count (so color-keyed and cascade-scaled relics can decide). Returns the new
 *   pre-cascade amount. The cascade multiplier is applied AFTER, at the aggregate, by
 *   `computeEffects` (unchanged single-rounding-site rule).
 * - `healGroup`: same, for one cleared heal group (no color — heal is colorless).
 * - `incomingAttack`: transform an enemy ATTACK action's damage value before it hits the
 *   player (defensive relics). Applied only to `type: 'attack'` actions in `playTurn`.
 * - `cascadeWave` (Stage-6, wave 1b): given a move's cascade-wave COUNT, return the per-wave
 *   relic effects — direct enemy HP loss (`enemyDamage`, affinity-ignoring) and player heal
 *   (`playerHeal`, capped at max HP by `playTurn`). Both are pre-rounded, ≥0 totals summed over
 *   waves 2..N by the run layer. The gold channel of `onCascadeWave` is a run-layer concern
 *   (banked at combat resolution) and is intentionally NOT part of this combat seam. Applied only
 *   when supplied — omitted ⇒ byte-identical Stage-2 combat (mirrors the other transforms).
 * - `rotImmune` (Stage-6, Rotwood): when `true`, the player-turn-start rot DoT tick is SUPPRESSED
 *   (dealt 0) — the Heartrot Seed legendary's "immune to spore/rot damage" clause (content-relics.md
 *   #5). Rot STACKS still accumulate and decay exactly as before, so the Sporecrown per-rot-stack
 *   damage synergy is preserved; only the self-damage tick is zeroed. Absent/false ⇒ rot ticks as
 *   normal ⇒ byte-identical to the pre-Heartrot engine (a capability flag, not a value transform —
 *   there is no hook that expresses "suppress a channel tick").
 */
export interface CombatModifiers {
  readonly damageGroup?: (baseAmount: number, color: TileColor, size: number, totalCombos: number) => number;
  readonly healGroup?: (baseAmount: number, size: number, totalCombos: number) => number;
  readonly incomingAttack?: (value: number) => number;
  readonly cascadeWave?: (waveCount: number) => { readonly enemyDamage: number; readonly playerHeal: number };
  readonly rotImmune?: boolean;
}
