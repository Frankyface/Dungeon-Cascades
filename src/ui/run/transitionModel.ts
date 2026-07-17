/**
 * Pure view-model for the ACT TRANSITION screen (spec §1): the "Act 1 cleared" beat between the
 * Bone Colossus and the Act-2 map. It reports the transition HEAL (the same fraction the engine's
 * `advanceAct` applies), the Act-2 biome REVEAL (name + theme), and a PREVIEW of the content unlocks
 * reaching Act 2 will earn — the first-reach biome ceremony (§2a).
 *
 * The preview derives unlocks against a hypothetical `act: 2` state (deriveUnlocks only reports the
 * biome once `act === 2`); the screen's Continue then calls `advanceAct` + persists the SAME unlocks,
 * so what the ceremony shows is exactly what gets banked (deriveUnlocks is idempotent + pure).
 *
 * No React imports; deterministic; fully Jest-testable.
 */
import { ACT_TRANSITION_HEAL_FRACTION, actStartPlayerHeal, deriveUnlocks, getBiome } from '../../engine/run';
import type { MetaState, RunState, UnlockEvent } from '../../engine/run';
import type { BiomeId } from '../../engine/combat';
import { biomeTheme, type BiomeTheme } from './biomeTheme';
import { discoveryCounts, headlineCeremonies, type CeremonyCard, type DiscoveryCounts } from './unlockCeremony';

/** Everything the act-transition screen renders. */
export interface ActTransitionView {
  /** The biome just cleared (always the Act-1 dungeon at the transition). */
  readonly fromBiomeName: string;
  readonly toBiomeId: BiomeId;
  readonly toBiomeName: string;
  /** The Act-2 biome's one-line theme statement (for the reveal). */
  readonly toBiomeTheme: string;
  /** The Act-2 biome's UI tint set (the reveal tints by this). */
  readonly theme: BiomeTheme;
  /**
   * TOTAL HP the transition restores: the base transition heal PLUS any `onActStart` relic bonus heal
   * `advanceAct` actually applies (content-relics.md: second-dawn / wayfarers-draught). Shown as the
   * heal number so the displayed heal equals what the engine grants.
   */
  readonly healAmount: number;
  /** HP after the full transition heal (base + onActStart bonus, capped at max). */
  readonly healedHp: number;
  readonly maxHp: number;
  /** The full preview of unlock events reaching Act 2 earns (empty on a re-visited biome). */
  readonly events: readonly UnlockEvent[];
  /** The headline ceremonies (biome + legendary relic) to show as cards. */
  readonly headlines: readonly CeremonyCard[];
  /** The quiet discovery tally (compendium entries revealed) for a compact summary line. */
  readonly discoveries: DiscoveryCounts;
  /** True the FIRST time Act 2 lands on this biome (there is a biome-unlock ceremony to play). */
  readonly firstReach: boolean;
}

/** Build the act-transition view from a run in the `act_transition` phase and the live meta profile. */
export function computeActTransition(state: RunState, meta: MetaState): ActTransitionView {
  const maxHp = state.playerMaxHp;
  // The base transition heal PLUS the onActStart relic bonus heal `advanceAct` layers on top, so the
  // shown total matches the HP the engine actually restores (FIX: was base-only, under-reporting a
  // player who owns an onActStart heal relic). Both cap at max HP, so summing before the cap is exact.
  const transitionHeal = Math.round(maxHp * ACT_TRANSITION_HEAL_FRACTION);
  const healAmount = transitionHeal + actStartPlayerHeal(state.relicIds);
  const healedHp = Math.min(maxHp, state.playerHp + healAmount);

  // Preview the unlocks reaching Act 2 will earn (deriveUnlocks reports the biome only at act === 2).
  const preview = deriveUnlocks({ ...state, act: 2 }, meta);
  const firstReach = preview.events.some((e) => e.kind === 'biome');

  const toBiome = getBiome(state.act2BiomeId);
  return {
    fromBiomeName: getBiome('dungeon').name,
    toBiomeId: state.act2BiomeId,
    toBiomeName: toBiome.name,
    toBiomeTheme: toBiome.theme,
    theme: biomeTheme(state.act2BiomeId),
    healAmount,
    healedHp,
    maxHp,
    events: preview.events,
    headlines: headlineCeremonies(preview.events),
    discoveries: discoveryCounts(preview.events),
    firstReach,
  };
}
