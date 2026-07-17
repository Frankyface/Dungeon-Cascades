/**
 * Starting VARIANTS — power-neutral sidegrades chosen at run start (Stage 4, decisions.md
 * 2026-07-15 "Meta-progression shape"). Every variant is PURE DATA: a set of typed run-start
 * modifiers that reshape ONLY the initial RunState (starting relics, starting gold, max HP, and
 * a UI-only revealed-map flag). No variant introduces a new engine mechanic — each is expressed
 * entirely through modifiers the vanilla `startRun` already understands, so `startRun` is the
 * ONLY flow function that variants touch. Vanilla (no variant) is byte-identical to today.
 *
 * PURITY IS MACHINE-ENFORCED: each shipped variant's policy-bot win rate over ≥2000 seeded runs
 * must sit within ±5 percentage points of vanilla's (feature-meta-variants.md). The only tuning
 * knob is a variant's OWN numbers (its maxHpDelta / goldDelta / relic choice) — never a global
 * constant. The `--mode report` sim prints the per-variant purity verdict.
 *
 * DEBATE-SLATE SWAPS (variants that needed a new mechanic were replaced with a modifier-only
 * sidegrade; the map-reveal flag has ZERO sim effect — it is a human-only planning aid, so a
 * variant carrying it pairs it with a real, bot-detectable stat trade to stay a genuine sidegrade):
 *   • Blood Pact (heal-as-damage — NEW MECHANIC) → "Vitality Pact": a sustain relic + −max HP.
 *   • Merchant's Debt (removed rest site — needs map-config threading) → "Merchant's Purse":
 *     starting gold (the loan) + −max HP (the debt's leverage).
 *   • Monochrome (affinity skew — needs board/combat-config threading) → "Ironhide": a defensive
 *     relic (−2 every incoming hit) + −max HP.
 *   • Cartographer (revealed map + BUFFED elites — the buff needs enemy-scaling threading) → kept
 *     the map reveal, replaced the buffed-elite downside with −max HP (max HP traded for map sight).
 *
 * PURE ENGINE: no React / React Native imports; deterministic; immutable data. See CLAUDE.md.
 */
import { getRelic } from './relics';

/**
 * The typed run-start modifiers a variant applies. Every field is OPTIONAL and additive over the
 * vanilla start; an omitted field is a no-op. This is the whole vocabulary — a variant that would
 * need anything beyond these levers is not modifier-expressible and must be redesigned or dropped.
 * - `startRelicIds`: relics granted at run start (added to the owned set; removed from the draft pool).
 * - `goldDelta`   : added to the vanilla starting gold (result floored at 0).
 * - `maxHpDelta`  : added to the vanilla max HP (result floored at `MIN_VARIANT_MAX_HP`); the run
 *                   starts at full (modified) HP.
 * - `revealMap`   : UI-only planning aid — the whole map is shown up front. ZERO engine/sim effect
 *                   (the policy bot already sees the map), so it never moves the purity number.
 */
export interface VariantModifiers {
  readonly startRelicIds?: readonly string[];
  readonly goldDelta?: number;
  readonly maxHpDelta?: number;
  readonly revealMap?: boolean;
}

/** A starting variant as pure data: identity, flavor, and its run-start modifiers. */
export interface RunVariant {
  readonly id: string;
  readonly name: string;
  readonly flavor: string;
  readonly modifiers: VariantModifiers;
}

/**
 * Floor a variant's max HP can never fall below, so a −maxHP downside can never produce a
 * non-positive HP pool (a dead-on-arrival run). Well below any shipped variant's actual value.
 */
export const MIN_VARIANT_MAX_HP = 20;

/**
 * The six shipped variants. Numbers were CALIBRATED against the policy-bot sim (seed 42): a
 * modifier sweep measured the raw win-rate contribution of each lever in isolation —
 *   maxHP −6/−12/−18/−24/−30 ⇒ −4.5/−10.0/−16.5/−23.3/−30.8pp ·  emberfang +10.0pp ·
 *   rowan-chalice +18.5pp · bulwark-rune +25.5pp · cascade-sigil +16.3pp · gold+55 +3.5pp
 * — and each variant's maxHpDelta was solved so relicRaw + hpCurve(delta) ≈ 0, then verified
 * against the ±5pp purity band at ≥2000 runs (feature-meta-variants.md Verification Log).
 * Order is the canonical unlock order — meta tranches unlock them in this sequence.
 */
export const VARIANTS: readonly RunVariant[] = [
  {
    id: 'cartographer',
    name: 'Cartographer',
    flavor: 'Travel light and know the road — less armor, a full map.',
    // Map sight (human-only aid) paid for with max HP. The reveal is sim-inert, so the bot only
    // ever sees the −maxHP; −4 measures ≈ −3pp, inside the band with margin.
    modifiers: { revealMap: true, maxHpDelta: -4 },
  },
  {
    id: 'ember-start',
    name: 'Ember Start',
    flavor: 'Forge-born: a Red fang in hand, a thinner hide.',
    // emberfang +10.0pp ↔ hpCurve(−12) = −10.0pp.
    modifiers: { startRelicIds: ['emberfang'], maxHpDelta: -12 },
  },
  {
    id: 'merchants-purse',
    name: "Merchant's Purse",
    flavor: 'A loan up front — collected against your health.',
    // gold+55 +3.5pp ↔ hpCurve(−5) ≈ −3.8pp.
    modifiers: { goldDelta: 55, maxHpDelta: -5 },
  },
  {
    id: 'vitality-pact',
    name: 'Vitality Pact',
    flavor: 'Bleed to mend: your heals run deeper, your pool runs shallower.',
    // rowan-chalice +18.5pp ↔ hpCurve(−20) ≈ −18.8pp.
    modifiers: { startRelicIds: ['rowan-chalice'], maxHpDelta: -20 },
  },
  {
    id: 'ironhide',
    name: 'Ironhide',
    flavor: 'Warded against every blow, but wearied by the weight.',
    // bulwark-rune +25.5pp ↔ hpCurve(−24) = −23.3pp. −26 measured −3.4pp at 1000 runs (the
    // relic×lowHP interaction runs ~3pp below additive), so −24 centers the band (≈ −1pp).
    modifiers: { startRelicIds: ['bulwark-rune'], maxHpDelta: -24 },
  },
  {
    id: 'glass-cannon',
    name: 'Glass Cannon',
    flavor: 'All edge, no shield — cascades ruin, or you do.',
    // cascade-sigil +16.3pp ↔ hpCurve(−18) = −16.5pp.
    modifiers: { startRelicIds: ['cascade-sigil'], maxHpDelta: -18 },
  },
];

/** The God of War prestige class id — a selectable start, but NEVER a tranche variant (see below). */
export const GOD_OF_WAR_ID = 'god-of-war';

/**
 * God of War — the PRESTIGE class (content-roles.md; spec-systems.md §3). Deliberately ABOVE the
 * ±5pp purity band by Cam's directive (decisions.md 2026-07-17), so it is kept OUT of `VARIANTS`
 * (the six band-tested, tranche-unlocked sidegrades) and out of `VARIANT_IDS`/`UNLOCK_TRANCHES`
 * entirely: it is unlockable ONLY by winning Boss Rush (`meta.godOfWarUnlocked`) and appended to
 * `selectableStarts` there — never via a score tranche, never band-tested. It IS in
 * `VARIANT_REGISTRY` so `getVariant('god-of-war')` / `startRun(seed, 'god-of-war')` resolve.
 *
 * Modifiers (content-roles.md): a stacked total-war offense (whetstone + cascade-sigil + an opening
 * ambush) on a still-mortal, defense-less pool — all base-12 relics, so it ships modifier-only with
 * ZERO engine extension. `maxHpDelta: +12` is the veteran's buffer to pull toward 0 first if sim
 * shows a near-faceroll; power is concentrated in cascade SKILL, never in defense.
 */
export const GOD_OF_WAR: RunVariant = {
  id: GOD_OF_WAR_ID,
  name: 'God of War',
  flavor: 'Armed for total war — a keener edge, escalating fury, an opening ambush, and no shield.',
  modifiers: {
    startRelicIds: ['whetstone-charm', 'cascade-sigil', 'ambushers-cowl'],
    maxHpDelta: 12,
    goldDelta: 50,
  },
};

/**
 * id → variant. Built from the six tranche variants PLUS the God of War prestige class, so
 * `getVariant` resolves an earned God of War while `VARIANTS`/`VARIANT_IDS` stay the band-tested six.
 * Frozen.
 */
export const VARIANT_REGISTRY: Readonly<Record<string, RunVariant>> = Object.freeze(
  [...VARIANTS, GOD_OF_WAR].reduce<Record<string, RunVariant>>((acc, v) => {
    if (acc[v.id]) throw new Error(`VARIANT_REGISTRY: duplicate variant id '${v.id}'`);
    acc[v.id] = v;
    return acc;
  }, {}),
);

/** All TRANCHE variant ids in canonical (unlock) order — the band-tested six (God of War excluded). */
export const VARIANT_IDS: readonly string[] = VARIANTS.map((v) => v.id);

/** Fetch a variant by id. Throws on an unknown id (boundary validation). */
export function getVariant(id: string): RunVariant {
  const variant = VARIANT_REGISTRY[id];
  if (variant === undefined) {
    throw new Error(`getVariant: unknown variant id '${id}'`);
  }
  return variant;
}

/** The resolved initial values a variant's modifiers produce from a vanilla start. */
export interface ResolvedVariantStart {
  readonly maxHp: number;
  readonly gold: number;
  readonly relicIds: readonly string[];
}

/**
 * Fold variant `modifiers` into a vanilla start's max HP / gold / relics — the pure heart of
 * variant application (runFlow's `startRun` wraps this into a RunState). Max HP is floored at
 * `MIN_VARIANT_MAX_HP` and gold at 0 so an aggressive downside can never produce an invalid start;
 * each start relic is validated (`getRelic` throws on a typo) and added once (duplicates skipped).
 * Never mutates its inputs.
 */
export function resolveVariantStart(
  baseMaxHp: number,
  baseGold: number,
  baseRelicIds: readonly string[],
  modifiers: VariantModifiers,
): ResolvedVariantStart {
  const maxHp = Math.max(MIN_VARIANT_MAX_HP, baseMaxHp + (modifiers.maxHpDelta ?? 0));
  const gold = Math.max(0, baseGold + (modifiers.goldDelta ?? 0));

  const relicIds: string[] = [...baseRelicIds];
  for (const id of modifiers.startRelicIds ?? []) {
    getRelic(id); // validates the relic id (throws on unknown)
    if (!relicIds.includes(id)) relicIds.push(id);
  }

  return { maxHp, gold, relicIds };
}

/**
 * Assert every variant is well-formed: unique id, every start-relic is a real roster relic (so a
 * typo fails fast rather than silently granting nothing), and no duplicate start relics within a
 * variant. Called by tests / the roster-integrity guard.
 */
export function assertVariantsWellFormed(variants: readonly RunVariant[] = [...VARIANTS, GOD_OF_WAR]): void {
  const seenIds = new Set<string>();
  for (const v of variants) {
    if (seenIds.has(v.id)) throw new Error(`assertVariantsWellFormed: duplicate variant id '${v.id}'`);
    seenIds.add(v.id);
    const relicIds = v.modifiers.startRelicIds ?? [];
    const seenRelics = new Set<string>();
    for (const id of relicIds) {
      getRelic(id); // throws on unknown relic id
      if (seenRelics.has(id)) throw new Error(`variant '${v.id}' repeats start relic '${id}'`);
      seenRelics.add(id);
    }
  }
}
