# Dungeon Cascades — Stage 6 Expansion: Biomes (Revised)

The four Act-2 biomes, post-audit. Each biome ships exactly **one** new enemy verb
(`frostArmor`, `armor`, `spore`, `curse`) and its own 4-enemy kit + 3-phase boss. All
affinity tiers are drawn from `{0, 0.5, 1, 2}` over the four damage colors R/G/B/Y;
any color not listed in a table is **normal (×1.0)**. Purple (heal) always ignores
affinity. Boss `baseHp` is 150 in every case; run-layer floor scaling (`scaleBossAction`)
ramps live values in Act 2.

This pass was the **distinctiveness + feasibility** revision (audit verdicts in
`content-audit-log.md`). It re-founded the Glacial Crypt away from the Sunken Catacombs'
"Blue-trap" identity, broke the Emberworks Blue monoculture, and split the twin
tanks/healers/chippers. Rotwood was left as the template.

## Palette note

Exact palette **hex values were not part of this Stage-6 revision content** (this pass
covered mechanics, distinctiveness, relics, and engine feasibility — not art direction).
The color *direction* below is taken verbatim from each biome's revised theme text and
should drive the final swatch selection; carry hexes forward from existing biome art
direction / set them at art time.

| Biome | Palette direction (from theme) |
|---|---|
| The Glacial Crypt | Blue ice / brittle rime; a dead kingdom entombed in blue. Guardians answer in four colors (Blue shatter, Yellow light, Red warmth, Green thaw). |
| The Emberworks | Never-cooling foundry — living slag, molten red/orange, ash-grey wraps. |
| The Rotwood | Rot green + waterlogged deadwood; DoT/regen biome, Green is the trap color. |
| The Sunken Catacombs | Black tidewater / drowned crypt; Blue is the trap color, lantern-pale light. |

## New-verb budget (one per biome)

| Biome | New verb | What it does (one line) |
|---|---|---|
| Glacial Crypt | `frostArmor` | Enemy raises a shield that absorbs before HP; does NOT regenerate. |
| Emberworks | `armor` | Enemy plates itself; dampens the player's NEXT strike, then clears. |
| Rotwood | `spore` | Enemy adds rot stacks; player takes rot on its own channel, decays 1/turn. |
| Sunken Catacombs | `curse` | Enemy forgoes its attack to halve the player's heals for N turns. |

---

# 1. The Glacial Crypt (`glacial-crypt`)

**Theme.** A dead kingdom entombed in blue ice. Its guardians hide behind FROST
BARRIERS (`frostArmor`, the biome's one new verb) that you must shatter to even reach
them — the whole biome is a shield-break timing/targeting puzzle. Unlike the drowned
Catacombs, cold does **not** save the dead here: the brittle ice SHATTERS to Blue, so
Blue cracks the frozen warden while each of the other guardians yields to a different
warmth or light. Four guardians, four different answer colors (Blue tank, Yellow chipper,
Red healer, Green glass), so no single build coasts.

## Enemies

| Enemy | Glyph | Role | HP | R | G | B | Y | Script |
|---|---|---|---|---|---|---|---|---|
| Permafrost Warden | 🗿 | tank / barrier-grind | 220 | 0.5 | 1 | **2** | 1 | attack 10 → attack 10 → frostArmor 14 |
| Frostbite Wisp | ❄️ | fast chipper | 45 | 1 | 1 | 0.5 | **2** | frostArmor 5 → attack 6 → attack 8 |
| Hoarfrost Cantor | 🕯️ | healer / burst-window | 140 | **2** | 1 | 1 | 0.5 | attack 6 → attack 6 → heal 12 |
| Icebound Revenant | 🧊 | glass-cannon / gimmick (carries frostArmor) | 80 | 1 | **2** | 0.5 | 1 | frostArmor 14 → charge → attack 18 |

**Permafrost Warden** — *"A tomb-guard frozen mid-oath, re-icing its own body faster than
you can chip it."* Shield-break grind (NOT a charge-nuke soak — deliberately split from
Rotwood's Mirebark Hulk). Re-entombs behind a 14-pt frost barrier every third turn: you
must shatter the barrier AND the body in the same window. Weak Blue (brittle ice cracks
to cold — inverts the "ice resists cold" instinct in the OPPOSITE direction from the
Catacombs' Drowned Warden); resists Red (fire only glazes the surface).

**Frostbite Wisp** — *"A breath of killing cold that flickers a thin rime-shell, then
bites."* Chips relentlessly but flickers a 5-pt frost shell first (a telegraphed tell that
varies its rhythm — not a flat slime reskin). Low HP: Yellow (2.0) scatters the cold
instantly; resists its own element (Blue). Distinct from Emberworks' Cinder Imp by the
frostArmor tell and the inverted weakness.

**Hoarfrost Cantor** — *"It hums the crypt's lullaby once, and the rime knits back all at
once."* Single LUMPED burst-heal every third turn (12 in one beat) — a timing puzzle: dump
your damage the turn AFTER it heals, or watch it snap back. Deliberately shaped opposite to
Rotwood's Mendcap Colony (steady dribble). Warmth (Red 2.0) melts it; resists the pale
crypt-light (Yellow).

**Icebound Revenant** — *"Sealed in its own glacier, it hoards one last avalanche behind
the glass."* Gimmick glass-cannon carrying the biome's verb. Cycle: entomb (14-pt frost
barrier) → wind up → 18 nuke, then re-freezes. Race it with Green (2.0 — nature/thaw cracks
the glacier), rounding out the biome's fourth answer color; resists Blue.

## Boss — Rimeheart, the Entombed Sovereign (`rimeheart`) 💠 — baseHp 150

*"The sovereign who froze the deep around itself rather than die — and is still deciding
whether to."*

**Fight fantasy.** A SHIELD-BREAK survival boss, deliberately re-tooled away from Vael's
color-walk. Rimeheart carries no curse and no self-heal — it survives by re-entombing
itself behind ever-present frost barriers (its own biome verb), and the puzzle is never
"which color" but "can you shatter the barrier AND the bared heart inside the same window
before it re-freezes." The through-line answer is Blue (the brittle sovereign shatters to
cold, the biome's whole inversion), with the barrier as the escalating wall; only at the
very end, when the heart is bared, does Yellow light finally reach it too. Where the Bone
Colossus HARDENS against your last color, Rimeheart grows BRITTLER as its tomb cracks —
survive to the finale, then shatter the heart.

| Phase | Name | Trigger (HP frac >) | Weak | Script | Note |
|---|---|---|---|---|---|
| 0 | Entombed | 0.66 | B ×2 (R ×0.5) | frostArmor 18 → attack 9 → attack 12 | Thick, slow, low-pressure. Crack the ice with cold; fire only glazes it. You are prying the lid, not the heart. |
| 1 | Thinning Ice | 0.33 | B ×2 (Y ×0.5) | frostArmor 12 → attack 15 → charge → attack 22 | Barrier THINS (12) but the sovereign rages — rising tempo into a telegraphed 22. Cold still cracks it; crypt-dark turns the light aside (resist Yellow). A race between your shatter and its wind-up. |
| 2 | Rimeheart Exposed | 0 | B ×2, Y ×2 | charge → attack 28 → attack 18 | No barrier — the bare heart takes cold AND light. The inevitable finale, a telegraphed 28 leading its loop. Shatter the heart now or be buried. |

## Engine extensions

- **New verb `frostArmor`** *(the biome's single new verb; reused by Permafrost Warden,
  Frostbite Wisp, Icebound Revenant and Rimeheart P0/P1 — one verb, not several)*.
  Add `frostArmor` to `EnemyActionType` and an optional `readonly enemyShield?: number` to
  `CombatState`. `applyEnemyAction` sets `enemyShield = max(enemyShield ?? 0, value)`
  (absorbs before HP, does **NOT** regenerate). The damage step subtracts player damage
  from `enemyShield` first, remainder carries to `enemyHp` so a big shatter one-shots
  barrier + more. Telegraph renders a shield icon. Fully serializable; an ABSENT field ⇒
  byte-identical to today. **Status: ENGINE-EXTENSION — the biome's one sanctioned verb.**
- **Hook-condition `comboThreshold`** *(consumed by Rimebound Fang, `rimebound-sigil`)*.
  Approved parameterized condition (spec §7). `matches()` returns false when
  `comboThreshold !== undefined && (context.totalCombos ?? 1) < comboThreshold`.
  `onDamageComputed` already threads `totalCombos`. **Status: APPROVED — usable.**

---

# 2. The Emberworks (`emberworks`)

**Theme.** A never-cooling foundry of living slag where every fight runs hotter than the
last. Blue quench answers the molten tank and the runaway furnace-wisp, but it is NOT the
whole story any more: a stray Yellow spark scatters loose coal, choking Green smothers the
ash-wrapped mender, and Red — useless against the slag itself — finally bites when the
Forgeheart's shell cracks open. No single color runs the biome on autopilot.

## Enemies

| Enemy | Glyph | Role | HP | R | G | B | Y | Script |
|---|---|---|---|---|---|---|---|---|
| Slagback Brute | 🗿 | tank / armor-plater | 140 | 0.5 | 1 | **2** | 0.5 | attack 8 → armor 8 → attack 8 |
| Cinder Imp | 👺 | fast chipper | 55 | 0.5 | 1 | 1 | **2** | attack 5 → attack 8 |
| Forge-Tender | ⚒️ | healer / attrition support | 90 | 0.5 | **2** | 1 | 1 | attack 6 → heal 6 → attack 10 |
| Furnace Wisp | 🔥 | glass-cannon / escalation gimmick (biome signature) | 70 | 0.5 | 1 | **2** | 0.5 | attack 4 → attack 8 → attack 12 |

> **Amended 2026-07-17 (fairness ruling — decisions.md).** Emberworks was the low-win biome
> (30.4%); the sim wave proved the ±10pp band unreachable at its first-draft numbers. Per the
> authorized nerf scope (smallest-change-first, favor lifting ember over nerfing others):
> **Slagback Brute** R `0 (IMMUNE)→0.5 (RESIST)` (removes the fire-build 0-damage wall), HP `260→140`,
> armor `12→8`; **Furnace Wisp** escalation capped `4→8→12→16→20` ⇒ `4→8→12` (venting sooner, max
> 20→12); **Forge-Tender** HP `130→90`, self-heal `12→6`. The four authorized levers alone left ember
> at 33.6% (spread 17.6pp), so these documented further per-biome cuts were applied; see the Forgeheart
> amendment for the boss (the measured wall). Final: ember 47.0% at 1000 games (spread 3.5pp).

**Slagback Brute** — *"A furnace given legs; fire is its blood, so bring water."* RESIST
Red 0.5 (molten slag — *amended from IMMUNE; a fire build now chips, no longer a 0-damage
wall*), WEAK Blue (quench), RESIST Yellow (plating); Green normal. Steady pressure that
periodically plates itself (`armor 8` dampens your NEXT strike). Blue quench is still the
clean answer; Red now bites at half rather than not at all.

**Cinder Imp** — *"A skittering coal that bites low, then high, and never tires."* WEAK
Yellow (a spark scatters loose coal), RESIST Red; Blue/Green normal. A low-high 5/8 flicker
every cycle (not a flat slime reskin, and answered by Yellow not Blue — breaks the biome's
old monoculture). Frail at 55 HP: a focused Yellow move ends it, ignored it out-attritions
you.

**Forge-Tender** — *"It mends itself at the anvil faster than you can break it."* WEAK
Green (smother/choke the ash-wraps), RESIST Red; Blue/Yellow normal. Re-tempers itself for
6 every third turn (*amended from 12*). Only Green bursts through the mend — you out-pace it,
not grind it. Answered by Green (not Blue), spreading the biome's answers.

**Furnace Wisp** — *"Ignore it and it swells to a white-hot roar."* WEAK Blue (quench the
runaway heat), RESIST Red and Yellow (living heat); Green normal. The escalation enemy: a
fully-telegraphed climb (4→8→12, then vents to 4 — *amended from 4→8→12→16→20; the cap is
lower and it vents a turn sooner*). Low HP and Blue-weak so a clean quench is easy — flounder
past turn 3 and it still cooks you, just less. A pure tempo/skill check.

## Boss — The Forgeheart (`forgeheart`) 🌋 — baseHp 150

**Fantasy.** A living furnace-core whose answer color WALKS as the shell cracks and
re-seals, so a Blue build can't spam through it. It plates itself and demands quench while
sealed (Blue), blows open into a fire-and-choke window as the core cracks (Red + Green —
Red's one real payoff in the biome), then superheats into a white core only true light
pierces (Yellow). Opposite trajectory to the Bone Colossus (which ADDS resistance when
hardening): the Forgeheart LOSES resistance in the middle, trading exposure for its
heaviest nuke.

| Phase | Name | Trigger (HP frac) | Weak | Script | Note |
|---|---|---|---|---|---|
| 0 | Sealed Furnace | frac > 0.66 | B ×2 (R ×0.5) | attack 12 → armor 10 → attack 16 | Plated: uses the `armor` verb (10) to force you to time your Blue burst through the plating. |
| 1 | Cracked Core | 0.33 < frac ≤ 0.66 | R ×2 AND G ×2 (Blue merely normal) | attack 12 → attack 14 → charge → attack 20 | AFFINITY SHIFT — the shell splits. Its most vulnerable window; trades exposure for its heaviest telegraphed nuke (20). Switch off Blue and burn/choke it. Red finally matters here. |
| 2 | Meltdown | frac ≤ 0.33 | Y ×2 only (R/B/G normal) | attack 16 → attack 18 → attack 22 | AFFINITY SHIFT — the white core; third answer color in three phases. Escalation climax: an ever-climbing 16/18/22 with no rest. Pierce the white core with light before it burns you to ash. |

> **Amended 2026-07-17 (fairness ruling — decisions.md).** Death-cause instrumentation proved the
> **Forgeheart itself** was Emberworks' wall: a policy bot builds toward the biome answer color (Blue),
> which the boss's color-WALK rewards ONLY in phase 0 (P1 wants R/G, P2 wants Y), so phases 1–2 are
> fought unboosted. At 1000 games the Forgeheart killed ~2× the runs of the other biome bosses. Its
> raw damage is eased to compensate for that build-punishing mechanic (it remains the highest-damage
> final phase of the four bosses): P0 armor `14→10`; P1 `14/18/26 → 12/14/20`; P2 `20/24/28 → 16/18/22`.
> baseHp stays 150 (uniform across all biome bosses); the color-walk identity is unchanged. The nuke
> exemption (>20) is still exercised — the P2 closer is 22. This lifted ember 42.3%→47.0% (spread 8.3→3.5pp).

## Engine extensions

- **Enemy verb `armor`** *(used by Slagback Brute, Forgeheart phase 0)*. Telegraph shown as
  "Armor N"; the plating action fires this turn, its dampening effect lands on the player's
  next strike (fully learnable). Add optional `enemyArmor?: number` to `CombatState`; on
  `armor` set `enemyArmor = value`. On the NEXT `playTurn` subtract `enemyArmor` from
  post-affinity move damage (floored at 0), then clear it. Deterministic, serializable,
  survives save/load — one field.

---

# 3. The Rotwood (`rotwood`)

**Theme.** DoT + regeneration biome; Green is a trap color (resisted broadly, good only vs
the glass cannon); one new verb (`spore`/rot) powers the whole biome. The most distinctive
of the four kits — used as the template for the others.

## Enemies

| Enemy | Glyph | Role | HP | R | G | B | Y | Script |
|---|---|---|---|---|---|---|---|---|
| Mirebark Hulk | 🪵 | tank (HP soak + self-regen) | 160 | **2** | 0.5 | 1 | 1 | attack 12 → attack 12 → heal 5 |
| Rotgrub Swarm | 🐛 | fast chipper (relentless + rot) | 55 | 1 | 1 | 0.5 | **2** | attack 5 → attack 5 → spore 2 |
| Mendcap Colony | 🍄 | healer / sustain wall (burst check) | 120 | 1 | 0.5 | **2** | 1 | heal 6 → attack 6 → heal 6 → attack 6 |
| Deathcap Herald | 💀 | glass cannon / gimmick (the one Green-weak enemy) | 45 | 1 | **2** | 1 | 0.5 | charge → attack 20 → spore 3 |

> **Amended 2026-07-17 (fairness ruling — decisions.md).** Rotwood was the lowest-win biome (26.6%):
> its two regen/sustain walls made every fight a long grind that bled a 60-HP player out. Per the
> authorized nerf scope (mendcap heal ↓, mirebark HP/self-heal ↓): **Mirebark Hulk** HP `260→160`,
> self-heal `8→5`; **Mendcap Colony** self-heal cycle `heal 12 + heal 10 (22/cycle) → heal 6 + heal 6
> (12/cycle)`, HP `140→120` (the HP cut is a documented further change beyond the two authorized heal
> levers). Both stay their archetype (tank-with-regen / sustain wall), just out-burstable now. This
> lifted rotwood to 50.6% at 1000 games — the biome responded strongly because its answer color (Red)
> is the policy bot's drafted relic, so shortening the tank fights directly shortens its strong-color grind.

**Mirebark Hulk** — *"A waterlogged deadwood giant that knits its own rot back shut as fast
as you carve it."* weak R (fire the deadwood), resist G (overgrowth feeds it). REGEN tank
(deliberately split from Glacial's Permafrost Warden shield-grind and from a plain
charge-nuke soak): grinds two hits then mends 5, so out-DPSing its slow regrowth IS the
puzzle. Bring Red; do NOT dump Green. Opposite of the base skeleton (120HP resist-R/weak-B,
charge-16): more HP, weak-not-resist Red, a self-healing attrition wall. Its self-heal
(5/cycle) is below Mendcap's 12/cycle, so it reads as tank-with-regen, not a healer. *(HP and
self-heal amended 2026-07-17 — see the Rotwood fairness note above.)*

**Rotgrub Swarm** — *"A boiling carpet of pale grubs that eats the wounded from the ankles
up."* weak Y (sun scorches the swarm), resist B (thrives damp). Never stops chipping and
seeds rot every 3rd action — punishes slow clears. Low HP: Yellow ends it fast. No Dungeon
enemy applies a lingering DoT; the swarm makes tempo/kill-speed the skill test.

**Mendcap Colony** — *"A cluster of knitting-caps that stitches its own flesh faster than
blades can part it."* weak B (rot-water drowns the colony), resist G (green light feeds it).
Out-heals chip damage (12 self-heal per cycle — *amended from 22*) in a STEADY dribble. You
must OUT-BURST its regen — a stall loses. Blue is the melt. Its steady dribble is shaped
opposite to Glacial's Hoarfrost Cantor lumped burst-heal.

**Deathcap Herald** — *"A gaunt violet cap that inhales, then exhales a killing bloom."*
weak G (over-lush growth overloads it), resist Y — the ONLY place Green shines in the
Rotwood. Fair telegraphed rhythm: wind-up → 20 NUKE → heavy spore, repeat. 45 HP: a saved
Green burst kills it before the nuke lands. Rewards HOLDING Green in a biome that punishes
Green everywhere else — the biome's signature "save it for the Deathcap" lesson.

## Boss — The Rotmother (`the-rotmother`) 🌸 — baseHp 150

*"The forest's dead heart, blooming without end — kill her fast, or her rot outlasts you."*

**Fight fantasy.** A regenerating spore-flooding overmind. Where the Bone Colossus is an
escalating burst-nuke, the Rotmother is a REGEN + DoT WALL that becomes a burst-RACE: she
self-heals and drips rot while hardening her bark, until — mortally wounded — she stops
mending and floods the arena with spores in a desperate collapse. The affinity arc R→Y→B
plus heal+spore verbs the Colossus never uses make it a wholly different puzzle: you can't
just out-nuke, you must out-pace her regrowth and survive the rot. Phase model: 3 phases by
HP fraction (>66% / >33% / else), engine's standard thresholds; the run layer swaps the
phase Enemy + resets telegraph on crossing, scaling base values by the floor ramp.

| Phase | Name | Trigger | Weak | Script | Note |
|---|---|---|---|---|---|
| 0 | Bloomveil | HP > 66% | R ×2 | spore 3 → attack 10 → heal 8 → attack 12 | Establishes the identity from turn 1: rot pressure + a self-heal so you feel the regen wall. Bring Red. |
| 1 | Barkhardened | 33% < HP ≤ 66% | Y ×2 (R ×0.5) | attack 16 → charge → attack 24 → heal 6 | AFFINITY SHIFT: bark hardens (now resists Red), sun cracks it. Hits harder with a telegraphed 24, still regenerates — your Red build bounces off. Switch to Yellow and out-race the heal. |
| 2 | Sporeburst Collapse | HP ≤ 33% | B ×2 | spore 4 → attack 18 → attack 20 → spore 4 | ENRAGED, weak B — drown the collapsing mass. No more self-heal — a dying flood of rot and wild swings. Blue melts her, but the doubled spore + big hits make it a true race; carried rot can finish you here. |

## Engine extensions

- **New enemy verb `spore(value)`** *(1 of 1 — the only new verb for The Rotwood; used by
  Rotgrub Swarm, Deathcap Herald, Rotmother phases 0 & 2)*. Add `rotStacks: number`
  (default 0) to `CombatState`; `applyEnemyAction` case `spore` ⇒ `rotStacks += value`; at
  player-turn-start deal `rotStacks` damage to the player on its OWN channel (NOT reduced by
  `onIncomingDamage`), then `rotStacks = max(0, rotStacks - 1)`; expose `rotTick` on
  `TurnResolution`. Gated behind the `enemy?` override seam so all non-Rotwood combat stays
  byte-identical. **Balance:** spore values small (2–4), decay 1/turn (`spore 3` = 3+2+1 = 6
  then clears); stacking from multiple sources is the intended pressure that rewards fast
  kills.
- **Relic-context field `rotStacks` in `RelicContext`** *(for Sporecrown, Heartrot Seed)*.
  Add optional `rotStacks?: number` to `RelicContext` (parallel to `totalCombos`) so
  `onDamageComputed` (Sporecrown) and the turn-start regen fold (Heartrot Seed) can read
  current rot. Parameterized-condition class per spec §7. This plus the spore verb is the
  biome's ENTIRE engine ask — sanctioned as the Rotwood's one extension.

---

# 4. The Sunken Catacombs (`sunken-catacombs`)

**Theme.** A drowned crypt of black tidewater where the patient dead wait — the drowned OWN
the water, so Blue is the trap color here (resisted or immune, never a payoff); light, fire
and rot cut the murk instead, and the dead drown your healing with curses. Kept intact by
audit as the distinct "Blue-trap" biome (the Glacial Crypt was re-founded away from this
identity).

## Enemies

| Enemy | Glyph | Role | HP | R | G | B | Y | Script |
|---|---|---|---|---|---|---|---|---|
| Drowned Warden | 🧟 | tank (durable attrition + self-mend) | 260 | 1 | 1 | 0.5 | **2** | attack 7 → attack 7 → heal 8 |
| Grasping Drowned | 🦑 | fast chipper (kill-it-first threat) | 65 | **2** | 1 | 1 | 1 | attack 6 → attack 11 |
| Lantern Medusa | 🪼 | healer / support (carries the CURSE verb) | 120 | 1 | **2** | 0.5 | 1 | attack 6 → heal 10 → curse 2 |
| Corpsefire Wisp | 🕯️ | glass cannon / gimmick (Blue-IMMUNE) | 45 | 1 | 1 | **0 (IMMUNE)** | **2** | attack 13 |

**Drowned Warden** — *"It has waited in the flooded cell so long the water forgot it was
ever a man."* resist Blue 0.5 (water is its element), weak Yellow 2.0 (drowned in the dark;
light burns it); R/G normal so there is always a non-Blue answer. Low, relentless 7-7 then
mends itself 8 every third turn — an attrition wall. Out-DPS its regen; the clean answer is
Yellow (2.0). Distinct from the base Slime (flat 8, no heal) by huge HP + self-sustain.

**Grasping Drowned** — *"Hands break the surface first, then the arms, then whatever is left
of the face."* weak Red 2.0 (fire boils it off); Blue is NORMAL here — the one enemy where a
Blue build still works, an intentional out from the biome's Blue trap. A grab (6) then a
telegraphed wrench (11), cycling — chips every turn with a spike you can see coming. Low HP
means focus it down; weak-R lets a Red pivot delete it.

**Lantern Medusa** — *"Its light is not to see by. It is so the drowned can watch you
tire."* resist Blue 0.5 (the tide mends it), weak Green 2.0 (rot unmakes the jelly). Pokes
6, mends itself 10, then CURSES you (value 2 = your healing is halved for 2 turns) — it wins
the long game by healing itself while denying yours. Answer: burst with Green (2.0) before
the curse+regen loop closes.

**Corpsefire Wisp** — *"A drowned candle still burning. The sea has spent an age trying to
put it out."* IMMUNE Blue 0.0 — a corpse-flame water cannot drown, so Blue does literally
nothing; weak Yellow 2.0 (true light scatters it). The biome's "you cannot bring only
water" teaching moment. Flat, huge 13 every turn on a 45-HP frame — delete it or eat the
biggest per-hit in the biome. Deliberately NOT a charge-nuke; its identity is the flat burst
+ Blue immunity.

## Boss — Vael, the Drowned Sovereign (`drowned-sovereign`) 🔱 — baseHp 150

**Fight fantasy.** A tidal color-INVERSION puzzle. The correct answer color rotates Yellow →
Blue → Green across three phases, so you re-tool your palette twice as the sea comes in and
goes out. He carries the biome's CURSE (heal-denial) and self-heal — sustain and
anti-sustain the Colossus lacks. Deepest irony: at Slack Water (Phase 1) he becomes weak to
Blue, the very color his drowned court made useless — the one moment the tide answers to
you. **Distinct from Colossus:** Colossus = flat/charge escalation + "harden against your
color" (R→B→Y as denial). Vael = tide-driven color rotation as an INVITATION to switch
(Y→B→G), plus curse + self-heal — an attrition/heal-economy fight. Engine's fixed boss
model: HP-fraction > 0.66 = Phase 0, > 0.33 = Phase 1, else Phase 2; each phase a plain
Enemy swapped via `CombatState.enemy` override, intent reset to `script[0]`.

| Phase | Name | Trigger (HP frac) | Weak | Script | Flavor |
|---|---|---|---|---|---|
| 0 | The Rising Dark | > 0.66 | Y ×2 (B ×0.5) | attack 12 → curse 2 → heal 10 | *"He surfaces crowned in weed, and the first thing he does is take your mercy from you."* |
| 1 | The Ebb (Slack Water) | > 0.33 | B ×2 (Y ×0.5) | attack 16 → charge → attack 26 | AFFINITY SHIFT — the subversion; Blue finally pays. The Crown of the Drowned Sovereign's home window. *"The water pulls back and leaves the king naked to the very sea he ruled."* |
| 2 | The Maelstrom | ≤ 0.33 | G ×2 (B/Y back to normal) | attack 20 → curse 1 → attack 24 | Third answer color in three phases; the final curse denies your clutch heal, so FINISH, don't top off. *"No throne now, only the whirlpool — and he means to take you down it with him."* |

## Engine extensions

- **New enemy verb `curse` (the biome's one new verb)** *(used by Lantern Medusa, Drowned
  Sovereign phases 0 and 2)*. `curse(value)`: the enemy forgoes its attack (0 direct damage)
  to set the player's `curseTurns = value`. While `curseTurns > 0` the player's total move
  HEAL is halved (×0.5); `curseTurns` decrements by 1 at end of each resolved player turn.
  Fully telegraphed. Not a wedge: the player still acts and can win; it only softens sustain,
  and it is temporary. **Sketch:** extend `EnemyActionType` with `curse`; add
  `readonly curseTurns: number` (default 0) to `CombatState`; `applyEnemyAction` `curse`
  sets `curseTurns = value`, 0 damage; heal-apply step multiplies move heal by
  `(curseTurns > 0 ? 0.5 : 1)`; decrement at end of each player turn. Engine touch:
  `combat/types.ts`, the combat state machine, UI telegraph label + `curse` tint.
- **Boss-scaling guard (related to `curse`).** `scaleBossAction()` scales the `value` of
  non-`charge` actions by `atkMult`. For `curse`, `value` is a TURN COUNT — scaling would
  inflate duration at deep floors. Treat `curse` as **non-scaling** (like `charge`). Boss
  self-heal MAY keep scaling. Sketch: in `scaleBossAction`,
  `if (action.type === 'charge' || action.type === 'curse') return action;`. Engine touch:
  `run/boss.ts`.

---

## Engine-extension summary (all four biomes)

| Extension | Kind | Biome | New field(s) | Byte-identical when absent? |
|---|---|---|---|---|
| `frostArmor` | new verb | Glacial Crypt | `enemyShield?: number` | Yes |
| `armor` | new verb | Emberworks | `enemyArmor?: number` | Yes |
| `spore` | new verb | Rotwood | `rotStacks: number` (+ `rotTick` on TurnResolution) | Yes (gated on `enemy?` override) |
| `curse` | new verb | Sunken Catacombs | `curseTurns: number` | Yes |
| `comboThreshold` | approved condition | Glacial (relic) | — | n/a (approved §7) |
| `rotStacks` in `RelicContext` | context field | Rotwood (relics) | `rotStacks?: number` | n/a |
| `curse` boss-scaling guard | scaling rule | Sunken Catacombs | — | n/a |

**Feasibility bounds confirmed (see `content-audit-log.md`; re-checked after the 2026-07-17
fairness amendment):** every affinity table uses valid tiers over R/G/B/Y; all enemy HP 45–260
(within 40–300); all bosses baseHp 150 (within 120–160); all heals 5–12 (within 4–12 — the
floor moved to 5 with the Mirebark Hulk self-heal cut). The ONLY stat-bound breach is boss
telegraphed nukes exceeding `atk ≤ 20` (now 6 instances after the Forgeheart ease: Rimeheart
22/28, Forgeheart 22, Rotmother 24, Vael 26/24) — ruled boss-exempt, consistent with the
existing Bone Colossus precedent; all regular enemy attacks stay ≤ 20.
