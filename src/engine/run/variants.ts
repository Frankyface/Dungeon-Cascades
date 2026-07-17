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
 * The six shipped variants. STAGE-6 RECALIBRATION (balance-tuning wave): after the win rate was
 * retuned into the spec §9 band (vanilla ≈38.8%) and the policy bot was upgraded to affinity-aware
 * combat, the Stage-4 maxHp offsets no longer held — the three large-pool-cost roles measured 13–16pp
 * BELOW vanilla (a −maxHP hurts more, and the relics return less, over the long two-act run). Each
 * role's maxHpDelta (its ONLY tuning knob — the relic identity is content-roles.md law) was re-solved
 * to the ±5pp band at seed 42 (win-rate slope ≈1.7–1.9pp per maxHP point at this balance, solved from
 * two measured points per role): Cartographer −6, Ember −12, Merchant −7 passed as-is (−1.3/−2.1/−2.7);
 * Vitality −20→−14, Ironhide −24→−16, Glass Cannon −18→−11. Verified at 1000 games (Verification Log).
 * Order is the canonical unlock order — meta tranches unlock them in this sequence.
 */
export const VARIANTS: readonly RunVariant[] = [
  {
    id: 'cartographer',
    name: 'Cartographer',
    flavor: 'Map-sight and a standing tithe — plan the whole route, arrive out-equipped.',
    // STAGE-6 REWORK (content-roles.md). The old Cartographer was sim-INERT: `revealMap` has ZERO
    // bot/sim effect (the policy already sees the map), so it played as vanilla −4 maxHP and "did
    // nothing you do". The rework bolts a real ECONOMY engine onto the sight — `misers-knuckle`
    // (+25% gold, onGoldEarned) turns route knowledge into compounding purchasing power over the
    // long 2-act run (distinct from Merchant's Purse's one-time burst). Now the −maxHP is offset by
    // a real relic contribution, so the role is band-tested like the others. Modifier-only (no
    // engine extension). maxHpDelta calibrated to the ±5pp band at the final balance (Verif. Log).
    modifiers: { revealMap: true, startRelicIds: ['misers-knuckle'], maxHpDelta: -6 },
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
    // STAGE-6 (content-roles.md): the two-act run doubled in length, so the opening burst was
    // bumped 55→70 to still buy a meaningful early relic in the longer run; maxHpDelta re-solved to
    // the ±5pp band at the final balance (Verification Log). Kept distinct from reworked
    // Cartographer: Purse = flat/immediate spike, Cartographer = percentage/sustained + sight.
    modifiers: { goldDelta: 70, maxHpDelta: -7 },
  },
  {
    id: 'vitality-pact',
    name: 'Vitality Pact',
    flavor: 'Bleed to mend: your heals run deeper, your pool runs shallower.',
    // STAGE-6 RECALIBRATION (2-point solve at 1000 games): the maxHP→win slope is ≈1.86pp/point at
    // this balance. Points (−20 ⇒ −13.0pp) & (−9 ⇒ +7.4pp) ⇒ Δ=0 at −13; −14 centers the band (≈−1.9pp).
    modifiers: { startRelicIds: ['rowan-chalice'], maxHpDelta: -14 },
  },
  {
    id: 'ironhide',
    name: 'Ironhide',
    flavor: 'Warded against every blow, but wearied by the weight.',
    // STAGE-6 RECALIBRATION (2-point solve at 1000 games): slope ≈1.9pp/point here. Points
    // (−24 ⇒ −16.4pp) & (−10 ⇒ +10.2pp) ⇒ Δ=0 at −15.4; −16 centers the band (≈−1.2pp).
    modifiers: { startRelicIds: ['bulwark-rune'], maxHpDelta: -16 },
  },
  {
    id: 'glass-cannon',
    name: 'Glass Cannon',
    flavor: 'All edge, no shield — cascades ruin, or you do.',
    // STAGE-6 RECALIBRATION (2-point solve at 1000 games): slope ≈1.72pp/point here. Points
    // (−18 ⇒ −13.6pp) & (−7 ⇒ +5.3pp) ⇒ Δ=0 at −10.1; −11 centers the band (≈−1.6pp), thinnest kept pool.
    modifiers: { startRelicIds: ['cascade-sigil'], maxHpDelta: -11 },
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
