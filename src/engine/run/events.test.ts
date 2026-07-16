/**
 * Event fixtures: the ~6 scripted events are data; every choice is a fixture (known state +
 * choice ⇒ exact outcome). Deterministic outcomes assert exact gold/HP deltas; gambles are
 * resolved by a seeded roll (both branches exercised by classifying the roll); relic rewards
 * come from the unowned pool (deterministic) and fall back to gold when the pool is empty.
 * Placeholder-grade flavor text is acceptable for the milestone (a writing pass is Stage 5).
 */
import { createRng, nextFloat } from '../board';
import { RELIC_IDS } from './relics';
import { EVENT_RELIC_FALLBACK_GOLD, EVENT_MIN_HP } from './economyConfig';
import {
  EVENTS,
  EVENT_IDS,
  applyEventEffect,
  eventForSeed,
  eventHasLegalAction,
  getEvent,
  resolveEventChoice,
} from './events';

describe('event roster shape', () => {
  it('has ~6 events, each with 2–3 choices and a no-op leave choice (no wedge)', () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(6);
    for (const ev of EVENTS) {
      expect(ev.choices.length).toBeGreaterThanOrEqual(2);
      expect(ev.choices.length).toBeLessThanOrEqual(3);
      // Every event offers a leave: a choice whose deterministic outcome changes nothing.
      const hasLeave = ev.choices.some(
        (c) => c.outcome !== undefined && !c.outcome.goldDelta && !c.outcome.hpDelta && !c.outcome.grantRelic,
      );
      expect(hasLeave).toBe(true);
      expect(eventHasLegalAction()).toBe(true);
    }
  });

  it('every event id is unique and resolvable', () => {
    expect(new Set(EVENT_IDS).size).toBe(EVENT_IDS.length);
    for (const id of EVENT_IDS) expect(getEvent(id).id).toBe(id);
  });
});

describe('eventForSeed — deterministic scripted-event draw', () => {
  it('picks a valid event id and is reproducible for a seed', () => {
    const a = eventForSeed(createRng(42));
    const b = eventForSeed(createRng(42));
    expect(EVENT_IDS).toContain(a.eventId);
    expect(a.eventId).toBe(b.eventId);
  });
});

describe('deterministic choice outcomes (exact deltas)', () => {
  it('Cursed Altar / Pray: +15 gold, −8 HP', () => {
    const { effect } = resolveEventChoice('cursed-altar', 0, createRng(1), []);
    expect(effect.goldDelta).toBe(15);
    expect(effect.hpDelta).toBe(-8);
    expect(effect.grantedRelicId).toBeNull();
  });

  it('Mysterious Fountain / Drink: +25 HP, no gold', () => {
    const { effect } = resolveEventChoice('mysterious-fountain', 0, createRng(1), []);
    expect(effect.goldDelta).toBe(0);
    expect(effect.hpDelta).toBe(25);
  });

  it('Golden Idol / Snatch: +50 gold, −15 HP (trap)', () => {
    const { effect } = resolveEventChoice('golden-idol', 0, createRng(1), []);
    expect(effect.goldDelta).toBe(50);
    expect(effect.hpDelta).toBe(-15);
  });

  it('every event’s leave choice is a pure no-op', () => {
    for (const ev of EVENTS) {
      const leaveIdx = ev.choices.findIndex(
        (c) => c.outcome !== undefined && !c.outcome.goldDelta && !c.outcome.hpDelta && !c.outcome.grantRelic,
      );
      const { effect } = resolveEventChoice(ev.id, leaveIdx, createRng(5), []);
      expect(effect).toEqual({ goldDelta: 0, hpDelta: 0, grantedRelicId: null });
    }
  });
});

describe('gambles resolved by a seeded roll (both branches)', () => {
  // Classify seeds by the roll the gamble consumes, then assert the branch that must fire.
  function rollFor(seed: number): number {
    return nextFloat(createRng(seed)).value;
  }

  it("Gambler's Wheel / Bet gold (0.5): win → +30 gold, lose → −20 gold", () => {
    let sawWin = false;
    let sawLose = false;
    for (let seed = 0; seed < 40 && !(sawWin && sawLose); seed++) {
      const roll = rollFor(seed);
      const { effect } = resolveEventChoice('gamblers-wheel', 0, createRng(seed), []);
      if (roll < 0.5) {
        expect(effect.goldDelta).toBe(30);
        sawWin = true;
      } else {
        expect(effect.goldDelta).toBe(-20);
        sawLose = true;
      }
    }
    expect(sawWin && sawLose).toBe(true); // both branches are reachable
  });

  it('Golden Idol / Pry (0.6): win → +50 gold, lose → −10 HP', () => {
    let sawWin = false;
    let sawLose = false;
    for (let seed = 0; seed < 40 && !(sawWin && sawLose); seed++) {
      const roll = rollFor(seed);
      const { effect } = resolveEventChoice('golden-idol', 1, createRng(seed), []);
      if (roll < 0.6) {
        expect(effect.goldDelta).toBe(50);
        expect(effect.hpDelta).toBe(0);
        sawWin = true;
      } else {
        expect(effect.hpDelta).toBe(-10);
        sawLose = true;
      }
    }
    expect(sawWin && sawLose).toBe(true);
  });
});

describe('relic-reward outcomes', () => {
  it('grants a deterministic unowned relic from the pool', () => {
    const a = resolveEventChoice('wandering-merchant', 0, createRng(11), []);
    const b = resolveEventChoice('wandering-merchant', 0, createRng(11), []);
    expect(a.effect.grantedRelicId).not.toBeNull();
    expect(RELIC_IDS).toContain(a.effect.grantedRelicId);
    expect(a.effect.grantedRelicId).toBe(b.effect.grantedRelicId);
    expect(a.effect.goldDelta).toBe(-25); // the merchant's price
  });

  it('falls back to gold when the relic pool is exhausted', () => {
    const owned = [...RELIC_IDS];
    const { effect } = resolveEventChoice('wandering-merchant', 0, createRng(11), owned);
    expect(effect.grantedRelicId).toBeNull();
    expect(effect.goldDelta).toBe(-25 + EVENT_RELIC_FALLBACK_GOLD);
  });
});

describe('applyEventEffect — deltas applied to run state with clamps', () => {
  it('clamps gold at 0 and HP into [EVENT_MIN_HP, maxHp]', () => {
    const out = applyEventEffect({ goldDelta: -100, hpDelta: -1000, grantedRelicId: null }, { gold: 10, hp: 40, maxHp: 60, relicIds: [] });
    expect(out.gold).toBe(0);
    expect(out.hp).toBe(EVENT_MIN_HP); // events never kill
    expect(out.relicIds).toEqual([]);
  });

  it('caps healing at maxHp and grants the relic', () => {
    const out = applyEventEffect({ goldDelta: 20, hpDelta: 40, grantedRelicId: 'emberfang' }, { gold: 5, hp: 55, maxHp: 60, relicIds: [] });
    expect(out.gold).toBe(25);
    expect(out.hp).toBe(60);
    expect(out.relicIds).toEqual(['emberfang']);
  });

  it('does not double-grant an already-owned relic (defensive)', () => {
    const out = applyEventEffect({ goldDelta: 0, hpDelta: 0, grantedRelicId: 'emberfang' }, { gold: 0, hp: 60, maxHp: 60, relicIds: ['emberfang'] });
    expect(out.relicIds).toEqual(['emberfang']);
  });
});
