/**
 * The v1 relic roster — twelve relics AS DATA (feature-relics-drafting.md). Every entry is
 * a pure `Relic`: an id, a name, a line of fantasy-lite flavor, a tier, and its per-hook
 * modifiers. There is NO engine logic here — behavior is computed from these modifiers by
 * relicHooks.ts. Adding a relic is a new object in ROSTER; nothing else changes.
 *
 * Coverage (the required categories):
 *  - 4 affinity-keyed damage relics, one per damage color (R/G/B/Y): emberfang, verdant-idol,
 *    tidecaller-pearl, sunspike-medallion.
 *  - heal-scaling: rowan-chalice.          - cascade-multiplier: cascade-sigil.
 *  - economy (gold %): misers-knuckle.     - flat damage reduction (defensive): bulwark-rune.
 *  - 2 combat-start effects: ambushers-cowl (enemy starts chipped), phoenix-feather (start heal).
 *  - plus: second-wind (per-turn regen) and whetstone-charm (flat damage) to exercise the
 *    turn-start hook and additive-before-multiplicative stacking on onDamageComputed.
 *
 * PURE ENGINE: no React / React Native imports; deterministic; immutable data.
 */
import { HOOK_NAMES } from './relicTypes';
import type { Relic, RelicRegistry } from './relicTypes';

/** The twelve relics, in canonical order (also the draft/stacking tiebreak order). */
export const ROSTER: readonly Relic[] = [
  // ── 4 affinity-keyed damage relics: +50% to one color (multiplicative) ──────────────
  {
    id: 'emberfang',
    name: 'Emberfang Charm',
    flavor: 'A fang that never cooled from the forge.',
    tier: 'normal',
    hooks: { onDamageComputed: { op: 'mul', amount: 0.5, color: 'R' } },
  },
  {
    id: 'verdant-idol',
    name: 'Verdant Idol',
    flavor: 'Moss-wrapped, it hungers for green light.',
    tier: 'normal',
    hooks: { onDamageComputed: { op: 'mul', amount: 0.5, color: 'G' } },
  },
  {
    id: 'tidecaller-pearl',
    name: 'Tidecaller Pearl',
    flavor: 'Storms sleep inside; blue wakes them.',
    tier: 'normal',
    hooks: { onDamageComputed: { op: 'mul', amount: 0.5, color: 'B' } },
  },
  {
    id: 'sunspike-medallion',
    name: 'Sunspike Medallion',
    flavor: 'Noon made solid; it burns the patient.',
    tier: 'normal',
    hooks: { onDamageComputed: { op: 'mul', amount: 0.5, color: 'Y' } },
  },

  // ── heal scaling ────────────────────────────────────────────────────────────────────
  {
    id: 'rowan-chalice',
    name: 'Chalice of Rowan',
    flavor: 'Every drop counts twice.',
    tier: 'normal',
    hooks: { onHealComputed: { op: 'mul', amount: 0.5 } },
  },

  // ── cascade-multiplier modifier: +6% damage per EXTRA combo in the move ──────────────
  {
    id: 'cascade-sigil',
    name: 'Cascade Sigil',
    flavor: 'The longer the fall, the deeper the ruin.',
    tier: 'elite',
    hooks: { onDamageComputed: { op: 'mul', amount: 0.06, perCombo: true } },
  },

  // ── economy: +25% gold ────────────────────────────────────────────────────────────────
  {
    id: 'misers-knuckle',
    name: "Miser's Knuckle",
    flavor: 'Coins cling to the greedy.',
    tier: 'normal',
    hooks: { onGoldEarned: { op: 'mul', amount: 0.25 } },
  },

  // ── defensive: −2 to every incoming attack (NOT a block tile) ─────────────────────────
  {
    id: 'bulwark-rune',
    name: 'Bulwark Rune',
    flavor: 'The blow lands softer on the warded.',
    tier: 'normal',
    hooks: { onIncomingDamage: { op: 'add', amount: -2 } },
  },

  // ── 2 combat-start effects ────────────────────────────────────────────────────────────
  {
    id: 'ambushers-cowl',
    name: "Ambusher's Cowl",
    flavor: 'Strike before they ever see you.',
    tier: 'elite',
    hooks: { onCombatStart: { op: 'add', amount: 10, kind: 'enemyChip' } },
  },
  {
    id: 'phoenix-feather',
    name: 'Phoenix Feather',
    flavor: 'A little warmth, banked against the storm.',
    tier: 'elite',
    hooks: { onCombatStart: { op: 'add', amount: 8, kind: 'playerHeal' } },
  },

  // ── per-turn regen ────────────────────────────────────────────────────────────────────
  {
    id: 'second-wind',
    name: 'Second Wind Charm',
    flavor: 'A second breath, taken every turn.',
    tier: 'normal',
    hooks: { onTurnStart: { op: 'add', amount: 1, kind: 'regen' } },
  },

  // ── flat outgoing damage (additive; stacks before multipliers) ───────────────────────
  {
    id: 'whetstone-charm',
    name: 'Whetstone Charm',
    flavor: 'A keener edge on every strike.',
    tier: 'normal',
    hooks: { onDamageComputed: { op: 'add', amount: 2 } },
  },
];

/** The canonical registry (id → relic), built from the roster order. */
export const RELIC_REGISTRY: RelicRegistry = Object.freeze(
  ROSTER.reduce<Record<string, Relic>>((acc, relic) => {
    if (acc[relic.id]) throw new Error(`RELIC_REGISTRY: duplicate relic id '${relic.id}'`);
    acc[relic.id] = relic;
    return acc;
  }, {}),
);

/** All relic ids in canonical order. */
export const RELIC_IDS: readonly string[] = ROSTER.map((r) => r.id);

/** Fetch a relic by id. Throws on unknown id (boundary validation). */
export function getRelic(id: string, registry: RelicRegistry = RELIC_REGISTRY): Relic {
  const relic = registry[id];
  if (relic === undefined) {
    throw new Error(`getRelic: unknown relic id '${id}'`);
  }
  return relic;
}

/** Assert that every relic's hooks reference known hook names (registry integrity). */
export function assertRosterWellFormed(roster: readonly Relic[] = ROSTER): void {
  const known = new Set<string>(HOOK_NAMES);
  for (const relic of roster) {
    for (const hook of Object.keys(relic.hooks)) {
      if (!known.has(hook)) throw new Error(`relic '${relic.id}' references unknown hook '${hook}'`);
    }
  }
}
