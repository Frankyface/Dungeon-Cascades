/**
 * Pure start-selection view-model: fold the meta profile + the variant roster into the cards the
 * "Start a run" screen renders. Vanilla is always the first card and always available; each variant
 * is either selectable (its tranche earned) or LOCKED with unlock progress ("Score 74/100").
 *
 * A variant's modifier summary is DERIVED from the same `VariantModifiers` the engine applies at
 * start, reusing `relicPresentation`'s effect text for granted relics — so a data-only variant tweak
 * shows correct copy for free. No React imports; deterministic; never mutates. See relicPresentation.
 */
import { UNLOCK_TRANCHES, VARIANTS, getRelic, selectableStarts } from '../../engine/run';
import type { MetaState, VariantModifiers } from '../../engine/run';
import { describeRelic } from './relicPresentation';

/** Whether a modifier line helps (boon), hurts (bane), or is neutral — drives its color. */
export type ModifierTone = 'boon' | 'bane' | 'neutral';

/** Which lever a modifier line describes — drives its glyph in the card view. */
export type ModifierKind = 'relic' | 'gold' | 'maxHp' | 'map';

/** One human-readable clause of a variant's start modifiers. */
export interface VariantModifierLine {
  readonly kind: ModifierKind;
  readonly label: string;
  /** Extra detail (e.g. a granted relic's effect line); `null` when the label says it all. */
  readonly detail: string | null;
  readonly tone: ModifierTone;
}

/** How close a locked variant is to its unlock tranche. */
export interface UnlockProgress {
  /** The profile's current cumulative score. */
  readonly current: number;
  /** The cumulative score this variant's tranche requires. */
  readonly required: number;
  /** Score still to earn (never negative). */
  readonly remaining: number;
  /** Ready-to-render progress label, e.g. "Score 74/100". */
  readonly label: string;
}

/** A single start-selection card: vanilla or one variant, available or locked. */
export interface StartCard {
  /** The variant id to start, or `null` for a vanilla start. */
  readonly variantId: string | null;
  readonly name: string;
  readonly flavor: string;
  /** The start-modifier summary (empty for vanilla). */
  readonly modifiers: readonly VariantModifierLine[];
  /** Locked variants are shown (with progress) but are not selectable. */
  readonly locked: boolean;
  /** Vanilla is the always-present default choice. */
  readonly isDefault: boolean;
  /** Present only for a locked card. */
  readonly progress: UnlockProgress | null;
}

/** Display name + flavor for the always-available vanilla start. */
export const VANILLA_START_NAME = 'Standard Run';
const VANILLA_START_FLAVOR = 'The honest climb — no modifiers, the dungeon as designed.';

/** variantId → cumulative score its tranche requires (built from the canonical tranche table). */
const REQUIRED_SCORE = new Map<string, number>(
  UNLOCK_TRANCHES.map((t) => [t.variantId, t.score] as const),
);

/** Format a signed integer for display: `+55`, `-12` (ASCII sign, hand-checkable). */
function signed(n: number): string {
  return n >= 0 ? `+${n}` : `-${Math.abs(n)}`;
}

/**
 * Describe a variant's run-start modifiers as ordered display lines (granted relics first, then
 * gold, max HP, and the map-reveal aid). Empty for a variant (or vanilla) with no modifiers. Pure.
 */
export function describeVariantModifiers(mods: VariantModifiers): readonly VariantModifierLine[] {
  const lines: VariantModifierLine[] = [];

  for (const id of mods.startRelicIds ?? []) {
    const relic = getRelic(id); // validates the id (throws on a typo) — boundary check
    lines.push({ kind: 'relic', label: relic.name, detail: describeRelic(relic), tone: 'boon' });
  }
  if (mods.goldDelta !== undefined && mods.goldDelta !== 0) {
    lines.push({
      kind: 'gold',
      label: `${signed(mods.goldDelta)} starting gold`,
      detail: null,
      tone: mods.goldDelta > 0 ? 'boon' : 'bane',
    });
  }
  if (mods.maxHpDelta !== undefined && mods.maxHpDelta !== 0) {
    lines.push({
      kind: 'maxHp',
      label: `${signed(mods.maxHpDelta)} max HP`,
      detail: null,
      tone: mods.maxHpDelta > 0 ? 'boon' : 'bane',
    });
  }
  if (mods.revealMap === true) {
    lines.push({ kind: 'map', label: 'Full map revealed', detail: null, tone: 'boon' });
  }

  return lines;
}

/** The vanilla card (always first, always available, the default choice). */
function vanillaCard(): StartCard {
  return {
    variantId: null,
    name: VANILLA_START_NAME,
    flavor: VANILLA_START_FLAVOR,
    modifiers: [],
    locked: false,
    isDefault: true,
    progress: null,
  };
}

/** The unlock progress for a locked variant (or `null` if it has no tranche — never for shipped ones). */
function progressFor(variantId: string, score: number): UnlockProgress | null {
  const required = REQUIRED_SCORE.get(variantId);
  if (required === undefined) return null;
  return {
    current: score,
    required,
    remaining: Math.max(0, required - score),
    label: `Score ${score}/${required}`,
  };
}

/**
 * Every start-selection card for the current profile: vanilla first, then all variants in canonical
 * (unlock) order. A variant is selectable iff it is in `selectableStarts(meta)`; the rest are shown
 * LOCKED with their unlock progress. The set of non-locked ids therefore always equals
 * `selectableStarts(meta)` (vanilla + earned variants) — the engine stays the single source of truth
 * for what may be started.
 */
export function startCards(meta: MetaState): readonly StartCard[] {
  const available = new Set<string | null>(selectableStarts(meta));
  const variantCards = VARIANTS.map((variant): StartCard => {
    const locked = !available.has(variant.id);
    return {
      variantId: variant.id,
      name: variant.name,
      flavor: variant.flavor,
      modifiers: describeVariantModifiers(variant.modifiers),
      locked,
      isDefault: false,
      progress: locked ? progressFor(variant.id, meta.score) : null,
    };
  });
  return [vanillaCard(), ...variantCards];
}
