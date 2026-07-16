/**
 * Scripted risk/reward events AS DATA. Each event is an id + name + placeholder flavor +
 * 2–3 choices; a choice is either a DETERMINISTIC outcome (flat gold/HP deltas and/or a
 * relic reward) or a GAMBLE (a seeded roll picks a win/lose outcome). Every event includes a
 * no-op "leave" choice, so an event node always offers a legal action (no wedge).
 *
 * Flavor text is placeholder-grade for this milestone — Cam supplies the writing pass in
 * Stage 5 (feature-economy-nodes.md Open Question). The ENGINE here is `resolveEventChoice`
 * (rolls gambles, draws relic rewards) + `applyEventEffect` (applies deltas with clamps);
 * adding an event is a new data entry, never engine code.
 *
 * PURE ENGINE: no React / React Native imports; deterministic (seeded); never mutates input.
 */
import { nextFloat, nextInt } from '../board';
import type { RngState } from '../board';
import { RELIC_IDS, RELIC_REGISTRY } from './relics';
import { applyDraft } from './draft';
import type { RelicRegistry } from './relicTypes';
import { EVENT_MIN_HP, EVENT_RELIC_FALLBACK_GOLD } from './economyConfig';

/** A flat, deterministic event outcome (any field omitted = no change on that axis). */
export interface EventOutcome {
  /** Gold delta (may be negative; the applier floors gold at 0). */
  readonly goldDelta?: number;
  /** HP delta (+ heal / − damage; the applier clamps into [EVENT_MIN_HP, maxHp]). */
  readonly hpDelta?: number;
  /** Grant one seeded unowned relic (falls back to gold when the pool is empty). */
  readonly grantRelic?: boolean;
}

/** A gamble: `chance` is P(win); the seeded roll picks `onWin` (roll < chance) or `onLose`. */
export interface EventGamble {
  readonly chance: number;
  readonly onWin: EventOutcome;
  readonly onLose: EventOutcome;
}

/** One event choice: EITHER a deterministic `outcome` OR a `gamble` (never both). */
export interface EventChoice {
  readonly id: string;
  readonly label: string;
  readonly outcome?: EventOutcome;
  readonly gamble?: EventGamble;
}

/** A scripted event as pure data. */
export interface GameEvent {
  readonly id: string;
  readonly name: string;
  readonly text: string;
  readonly choices: readonly EventChoice[];
}

/** A resolved event effect: the concrete deltas the run layer applies. */
export interface EventEffect {
  readonly goldDelta: number;
  readonly hpDelta: number;
  readonly grantedRelicId: string | null;
}

const LEAVE: EventChoice = { id: 'leave', label: 'Leave', outcome: {} };

/**
 * The six scripted events. Numbers are hand-picked, whole, and sim-tunable; flavor is
 * placeholder. Coverage: flat gains/losses, mixed gold↔HP trades, deterministic relic buys,
 * and gold/HP/relic gambles — every outcome kind the feature asks for.
 */
export const EVENTS: readonly GameEvent[] = [
  {
    id: 'cursed-altar',
    name: 'Cursed Altar',
    text: 'A altar slick with old offerings. It seems to want more.',
    choices: [
      { id: 'pray', label: 'Pray (+15 gold, −8 HP)', outcome: { goldDelta: 15, hpDelta: -8 } },
      { id: 'desecrate', label: 'Desecrate it', gamble: { chance: 0.5, onWin: { grantRelic: true }, onLose: { hpDelta: -12 } } },
      LEAVE,
    ],
  },
  {
    id: 'wandering-merchant',
    name: 'Wandering Merchant',
    text: 'A hooded trader spreads trinkets across a stained cloth.',
    choices: [
      { id: 'buy', label: 'Buy a trinket (−25 gold)', outcome: { goldDelta: -25, grantRelic: true } },
      { id: 'pickpocket', label: 'Pick his pocket', gamble: { chance: 0.4, onWin: { goldDelta: 40 }, onLose: { hpDelta: -15 } } },
      LEAVE,
    ],
  },
  {
    id: 'mysterious-fountain',
    name: 'Mysterious Fountain',
    text: 'Clear water glows faintly in the dark.',
    choices: [
      { id: 'drink', label: 'Drink deeply (+25 HP)', outcome: { hpDelta: 25 } },
      { id: 'bottle', label: 'Bottle and sell (−10 HP, +20 gold)', outcome: { hpDelta: -10, goldDelta: 20 } },
      LEAVE,
    ],
  },
  {
    id: 'golden-idol',
    name: 'Golden Idol',
    text: 'A fist-sized idol on a pressure plate. Obviously trapped.',
    choices: [
      { id: 'snatch', label: 'Snatch it (+50 gold, −15 HP)', outcome: { goldDelta: 50, hpDelta: -15 } },
      { id: 'pry', label: 'Pry it out carefully', gamble: { chance: 0.6, onWin: { goldDelta: 50 }, onLose: { hpDelta: -10 } } },
      LEAVE,
    ],
  },
  {
    id: 'forgotten-shrine',
    name: 'Forgotten Shrine',
    text: 'A shrine to a god no one remembers. It still listens.',
    choices: [
      { id: 'tithe', label: 'Offer gold (−20 gold, +20 HP)', outcome: { goldDelta: -20, hpDelta: 20 } },
      { id: 'pray', label: 'Pray for favor', gamble: { chance: 0.5, onWin: { grantRelic: true }, onLose: {} } },
      LEAVE,
    ],
  },
  {
    id: 'gamblers-wheel',
    name: "Gambler's Wheel",
    text: 'A skeletal croupier gestures at a spinning wheel.',
    choices: [
      { id: 'bet-gold', label: 'Bet gold', gamble: { chance: 0.5, onWin: { goldDelta: 30 }, onLose: { goldDelta: -20 } } },
      { id: 'bet-blood', label: 'Bet blood', gamble: { chance: 0.5, onWin: { grantRelic: true }, onLose: { hpDelta: -20 } } },
      { id: 'walk-away', label: 'Walk away', outcome: {} },
    ],
  },
];

/** All event ids in canonical order. */
export const EVENT_IDS: readonly string[] = EVENTS.map((e) => e.id);

const EVENT_BY_ID: Readonly<Record<string, GameEvent>> = EVENTS.reduce<Record<string, GameEvent>>((acc, ev) => {
  acc[ev.id] = ev;
  return acc;
}, {});

/** Fetch an event by id. Throws on unknown id (boundary validation). */
export function getEvent(id: string): GameEvent {
  const ev = EVENT_BY_ID[id];
  if (ev === undefined) throw new Error(`getEvent: unknown event id '${id}'`);
  return ev;
}

/** Pick a scripted event for a seeded RNG (uniform over the roster). Deterministic. */
export function eventForSeed(rngState: RngState): { eventId: string; rngState: RngState } {
  const pick = nextInt(rngState, EVENTS.length);
  return { eventId: EVENTS[pick.value].id, rngState: pick.state };
}

/** Draw one seeded unowned relic (uniform, canonical order). `null` if the pool is empty. */
function grantSeededRelic(
  rngState: RngState,
  ownedRelicIds: readonly string[],
  registry: RelicRegistry,
): { relicId: string | null; rngState: RngState } {
  const owned = new Set(ownedRelicIds);
  const pool = (registry === RELIC_REGISTRY ? RELIC_IDS : Object.keys(registry)).filter((id) => !owned.has(id));
  if (pool.length === 0) return { relicId: null, rngState };
  const draw = nextFloat(rngState);
  const idx = Math.min(pool.length - 1, Math.floor(draw.value * pool.length));
  return { relicId: pool[idx], rngState: draw.state };
}

/** Turn one deterministic outcome into an EventEffect (rolling a relic reward if asked). */
function effectFromOutcome(
  outcome: EventOutcome,
  rngState: RngState,
  ownedRelicIds: readonly string[],
  registry: RelicRegistry,
): { effect: EventEffect; rngState: RngState } {
  let goldDelta = outcome.goldDelta ?? 0;
  const hpDelta = outcome.hpDelta ?? 0;
  let grantedRelicId: string | null = null;
  let state = rngState;

  if (outcome.grantRelic) {
    const grant = grantSeededRelic(state, ownedRelicIds, registry);
    state = grant.rngState;
    grantedRelicId = grant.relicId;
    if (grantedRelicId === null) goldDelta += EVENT_RELIC_FALLBACK_GOLD; // pool empty ⇒ gold instead
  }

  return { effect: { goldDelta, hpDelta, grantedRelicId }, rngState: state };
}

/**
 * Resolve one event choice into its concrete effect. Deterministic outcomes map straight
 * through; gambles consume ONE roll (win when roll < chance) then resolve the chosen branch.
 * `rngState` is threaded and returned advanced. Throws on an unknown event / out-of-range
 * choice (boundary validation).
 */
export function resolveEventChoice(
  eventId: string,
  choiceIndex: number,
  rngState: RngState,
  ownedRelicIds: readonly string[],
  registry: RelicRegistry = RELIC_REGISTRY,
): { effect: EventEffect; rngState: RngState } {
  const event = getEvent(eventId);
  const choice = event.choices[choiceIndex];
  if (choice === undefined) {
    throw new Error(`resolveEventChoice: '${eventId}' has no choice ${choiceIndex}`);
  }

  if (choice.gamble) {
    const roll = nextFloat(rngState);
    const won = roll.value < choice.gamble.chance;
    const outcome = won ? choice.gamble.onWin : choice.gamble.onLose;
    return effectFromOutcome(outcome, roll.state, ownedRelicIds, registry);
  }

  return effectFromOutcome(choice.outcome ?? {}, rngState, ownedRelicIds, registry);
}

/** The mutable run-facing fields an event effect touches. */
export interface EventApplyState {
  readonly gold: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly relicIds: readonly string[];
}

/** The result of applying an event effect (a new run-facing slice). */
export interface EventApplyResult {
  readonly gold: number;
  readonly hp: number;
  readonly relicIds: readonly string[];
}

/**
 * Apply an EventEffect to a run-state slice: gold floored at 0, HP clamped into
 * [EVENT_MIN_HP, maxHp] (events never kill — combat does), and a granted relic added to the
 * owned set (skipped if somehow already owned — defensive). Pure; returns new data.
 */
export function applyEventEffect(effect: EventEffect, state: EventApplyState): EventApplyResult {
  const gold = Math.max(0, state.gold + effect.goldDelta);
  const hp = Math.max(EVENT_MIN_HP, Math.min(state.maxHp, state.hp + effect.hpDelta));
  const relicIds =
    effect.grantedRelicId !== null && !state.relicIds.includes(effect.grantedRelicId)
      ? applyDraft(state.relicIds, effect.grantedRelicId)
      : state.relicIds;
  return { gold, hp, relicIds };
}

/**
 * Whether an event offers at least one legal action. Always true — every event has a leave
 * choice — so an event node can never wedge a run.
 */
export function eventHasLegalAction(): boolean {
  return true;
}
