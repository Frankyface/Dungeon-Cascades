/**
 * Pure relic → display-card helpers: turn a relic's declarative hook modifiers into the
 * human-readable "effect" line the draft / shop / owned-relic UI shows. Because the effect
 * text is DERIVED from the same modifiers the engine applies, a new relic (data-only) gets a
 * correct description for free. No React imports; deterministic.
 */
import { HOOK_NAMES, getRelic } from '../../engine/run';
import type { HookName, Relic, RelicModifier, RelicTier } from '../../engine/run';

/** A relic ready to render as a card: identity, flavor, tier, and a derived effect line. */
export interface RelicCard {
  readonly id: string;
  readonly name: string;
  readonly flavor: string;
  readonly tier: RelicTier;
  readonly effect: string;
}

/** Human color name for a modifier's color gate (engine codes → words). */
const COLOR_NAME: Readonly<Record<string, string>> = {
  R: 'Red',
  G: 'Green',
  B: 'Blue',
  Y: 'Yellow',
  P: 'Purple',
};

/** Render a percentage from a `mul` modifier's fractional amount (0.5 → "50%"). */
function pct(amount: number): string {
  return `${Math.round(amount * 100)}%`;
}

/** One clause describing a single hook's modifier (the granular effect phrasing). */
function describeHook(hook: HookName, mod: RelicModifier): string {
  switch (hook) {
    case 'onDamageComputed':
      if (mod.op === 'mul' && mod.color !== undefined) {
        return `+${pct(mod.amount)} ${COLOR_NAME[mod.color] ?? mod.color} damage`;
      }
      if (mod.op === 'mul' && mod.perCombo) {
        return `+${pct(mod.amount)} damage per extra combo`;
      }
      if (mod.op === 'mul') {
        return `+${pct(mod.amount)} damage`;
      }
      return `+${mod.amount} flat damage`;
    case 'onHealComputed':
      return mod.op === 'mul' ? `+${pct(mod.amount)} healing` : `+${mod.amount} flat healing`;
    case 'onCombatStart':
      if (mod.kind === 'enemyChip') {
        return `Enemies start with ${mod.amount} less HP`;
      }
      return `Start each fight +${mod.amount} HP`;
    case 'onTurnStart':
      return `Heal ${mod.amount} HP each turn`;
    case 'onGoldEarned':
      return mod.op === 'mul' ? `+${pct(mod.amount)} gold` : `+${mod.amount} gold`;
    case 'onIncomingDamage':
      return mod.op === 'mul'
        ? `Reduce incoming damage by ${pct(Math.abs(mod.amount))}`
        : `Reduce incoming damage by ${Math.abs(mod.amount)}`;
    // ── Stage-6 hooks ──
    case 'onCascadeWave': {
      const per = mod.kind === 'enemyDamage' ? 'enemy damage' : mod.kind === 'playerHeal' ? 'HP' : 'gold';
      return `+${mod.amount} ${per} per cascade wave`;
    }
    case 'onEnemyDefeated':
      return mod.kind === 'gold' ? `+${mod.amount} gold per kill` : `+${mod.amount} HP per kill`;
    case 'onActStart':
      return mod.kind === 'gold' ? `+${mod.amount} gold each act` : `+${mod.amount} HP each act`;
    case 'onRestUsed':
      if (mod.kind === 'restHeal') {
        return mod.amount >= 0 ? `Rest heals +${pct(mod.amount)}` : `Rest heals nothing`;
      }
      return mod.kind === 'gold' ? `+${mod.amount} gold on rest` : `+${mod.amount} HP on rest`;
    case 'onShopPurchase':
      if (mod.kind === 'price') {
        return `${pct(mod.amount)} shop prices`;
      }
      return mod.kind === 'gold' ? `+${mod.amount} gold per purchase` : `+${mod.amount} HP per purchase`;
  }
}

/** The full effect line for a relic: every hook clause joined, in canonical hook order. */
export function describeRelic(relic: Relic): string {
  const clauses: string[] = [];
  for (const hook of HOOK_NAMES) {
    const mod = relic.hooks[hook];
    if (mod !== undefined) {
      clauses.push(describeHook(hook, mod));
    }
  }
  return clauses.join(' · ');
}

/** Build a display card for a relic id (throws on an unknown id — boundary validation). */
export function relicCard(id: string): RelicCard {
  const relic = getRelic(id);
  return {
    id: relic.id,
    name: relic.name,
    flavor: relic.flavor,
    tier: relic.tier,
    effect: describeRelic(relic),
  };
}

/** Build display cards for a list of relic ids (owned list / draft options / shop stock). */
export function relicCards(ids: readonly string[]): readonly RelicCard[] {
  return ids.map(relicCard);
}
