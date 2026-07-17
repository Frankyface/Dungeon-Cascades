# Dungeon Cascades — Stage 6 Expansion: Roles (Revised)

Starting roles are power-neutral ways to begin a run — a starting relic (or map foresight,
or gold) traded against a smaller HP pool, tuned to sit inside a **±5 percentage-point**
greedy-bot win-rate band vs vanilla. They change *how* you start, never how strong you are.
The sole deliberate exception is the God of War prestige class (below).

All roles are **modifier-only** — none requires an engine extension.

## Summary

| Role | Verdict | Key modifiers | One-line identity |
|---|---|---|---|
| Cartographer | **rework** | revealMap, `misers-knuckle`, maxHp −6 | Map-sight + standing +25% gold → route deliberately toward shops/elites/altars and arrive at Act 2 out-equipped. |
| Ember Start | keep | `emberfang`, maxHp −12 | Hunt Red every run; in Act 2 route around whatever new biome resists it. |
| Merchant's Purse | keep (small strengthen) | gold +70, maxHp −7 | Start solvent; B-line the first shop for a relic the draft never offered. |
| Vitality Pact | keep | `rowan-chalice`, maxHp −20 | Shallow pool mended by doubled heals; every cascade is part-strike, part-transfusion. |
| Ironhide | keep | `bulwark-rune`, maxHp −24 | Shrug off every small blow (−2/hit) and win the long attrition fight. |
| Glass Cannon | keep | `cascade-sigil`, maxHp −18 | Live or die on chain length; build the longest cascades in the game. |
| God of War | prestige (band-exempt) | `whetstone-charm` + `cascade-sigil` + `ambushers-cowl`, maxHp +12, gold +50 | Stacked total-war offense with no defense; crush fast or fall. |

---

## Cartographer — `cartographer` — REWORK

**Modifiers:** `revealMap: true`, `startRelicIds: ["misers-knuckle"]`, `maxHpDelta: −6`.

**Identity.** Full map-sight paired with a standing +25% gold turns knowledge into economy:
you plan the whole route, aim at every shop/elite/altar on purpose, and reach Act 2
out-equipped — paid for with a thinner hide.

**Rework rationale.** Cam is right that old Cartographer "doesn't do much": `revealMap` is
**sim-inert** (the doc itself says the bot already sees the map), so its ONLY real effect was
−4 maxHP — it played as vanilla-minus-a-little and changed nothing you *do*. Fix: bolt a real
economy engine onto the sight via `misers-knuckle` (+25% gold, `onGoldEarned`). Now the
map-reveal DRIVES behavior — you route deliberately toward shops/elites/altars because you
can see them AND every win compounds your purchasing power, arriving at the Act 2 break
better-armed. This is a genuine MAP+ECONOMY identity, and it stays distinct from Merchant's
Purse: Purse is a one-time BURST (spend now); Cartographer is SUSTAINED % + planning
(compound over the long 2-act run). `misers-knuckle` is the only economy relic in the base 12
and is otherwise unused by any role, so it is the natural pick. Stays fully modifier-only (no
engine extension). `maxHpDelta` is a design estimate; sim-calibrate to hold ±5pp.

**Optional future sharpen.** Swap `misers-knuckle` for a new `onActStart` economy relic that
pays out at the Act 2 transition.

---

## Ember Start — `ember-start` — KEEP

**Modifiers:** `startRelicIds: ["emberfang"]`, `maxHpDelta: −12`.

**Identity.** You hunt Red every run — building and firing Red groups first to melt the many
Red-weak foes, and in Act 2 actively routing around whichever new biome resists it.

**Rationale.** Already a crisp board-changing identity (+50% one color makes you prioritize
that color's groups), calibrated in-band (emberfang +10.0pp ↔ hpCurve(−12) = −10.0pp). No
modifier change. Stage 6 STRENGTHENS it for free: with two acts and different Act-2
affinities, the FIXED Red tilt becomes a real planning tension, so it passes "would you feel
it" more strongly than before.

---

## Merchant's Purse — `merchants-purse` — KEEP (small strengthen)

**Modifiers:** `goldDelta: 70`, `maxHpDelta: −7`.

**Identity.** You start the run already solvent — B-line the first shop and walk into your
opening fights carrying a relic the draft never offered.

**Rationale.** Identity (burst economy / rush the shop) is a real "do differently on the map"
answer, but it is the weakest-FELT of the kept five because Stage 6 doubles run length to two
acts. Small strengthen: bump the burst 55 → 70 so it still buys a meaningful early relic in
the longer run; re-solve the maxHP offset to hold the band. Kept deliberately distinct from
reworked Cartographer: Purse = flat/immediate spike, Cartographer = percentage/sustained +
sight. No engine work.

---

## Vitality Pact — `vitality-pact` — KEEP

**Modifiers:** `startRelicIds: ["rowan-chalice"]`, `maxHpDelta: −20`.

**Identity.** You run a deliberately shallow pool and mend it with doubled heals — treating
every cascade as part-strike, part-transfusion and building Purple groups the moment the pool
dips.

**Rationale.** Strong board+risk identity: the −20 maxHP makes the +50% heal matter
turn-to-turn. In-band (rowan-chalice +18.5pp ↔ hpCurve(−20) ≈ −18.8pp). No change.

---

## Ironhide — `ironhide` — KEEP

**Modifiers:** `startRelicIds: ["bulwark-rune"]`, `maxHpDelta: −24`.

**Identity.** You shrug off every small blow (−2 per incoming hit) and win the attrition game
— taking chip other roles can't afford and grinding out long fights that would bleed them
dry.

**Rationale.** Distinct defensive identity: the flat −2 per hit rewards long, many-hit
fights. Calibrated in-band (bulwark-rune +25.5pp offset by −24 maxHP). No change.

---

## Glass Cannon — `glass-cannon` — KEEP

**Modifiers:** `startRelicIds: ["cascade-sigil"]`, `maxHpDelta: −18`.

**Identity.** You live or die on the length of the chain — a razor pool means every extra
combo's escalating bonus is your only defense, so you build the longest cascades in the game
or you lose the turn.

**Rationale.** The most on-north-star role (skill = engineering cascades): +6%/extra combo
with a thin pool forces maximal cascade play. In-band (cascade-sigil +16.3pp ↔ hpCurve(−18) =
−16.5pp). No change. Deliberate contrast with God of War, which also carries `cascade-sigil`
but INVERTS the risk profile.

---

## God of War — `god-of-war` — PRESTIGE CLASS (purity-band EXEMPT)

**Modifiers:** `startRelicIds: ["whetstone-charm", "cascade-sigil", "ambushers-cowl"]`,
`maxHpDelta: +12`, `goldDelta: 50`.

**Identity.** The war-god takes the field armed for total war — a stacked offense (a keener
edge on every strike, escalating cascade fury, and an opening ambush blow) that turns skilled
cascade-engineering into overkill, kept honest by a still-mortal pool with no defense: crush
fast or fall.

### Purity-band exemption note

God of War is **DELIBERATELY above the ±5pp band** — a prestige class, exempt by Cam's
directive. **Log the exemption in `decisions.md`.** Still sim-MEASURE and REPORT its win rate
honestly. It must be **UNSELECTABLE until Boss Rush is first won**.

Kept fully modifier-only so it ships with ZERO engine extension. Power is stacked but
concentrated in SKILL: `whetstone` is a modest floor, but `cascade-sigil` and
`ambushers-cowl` both reward fast, well-engineered cascades. Carries NO defense; the +12
maxHP (75 total) is a veteran's buffer, not armor, so a 20–26 boss burst still kills a
careless run.

**Rough power estimate.** Greedy-bot win rate lands well outside the band (cascade-sigil
~+16pp, +12 HP ~+9pp, +50 gold ~+3pp, plus whetstone/ambushers unmeasured — likely +25..+40pp
over vanilla), with a markedly larger LIFT for a skilled/greedy bot. **If the greedy bot
approaches a near-100% faceroll in sim, pull the +12 maxHP toward 0 first — never add
defense.**

---

## Audit note

Roles, God of War, and the (absent) tutorial were left **unchanged** by the Stage-6 audits —
no audit touched them. This file records the reworked Cartographer and the God of War
exemption as design decisions; the enemy/relic distinctiveness and feasibility revisions are
in `content-biomes.md`, `content-relics.md`, and `content-audit-log.md`.
