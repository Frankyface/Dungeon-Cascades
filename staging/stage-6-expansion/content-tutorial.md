# How to Play — Dungeon Cascades

Match-3 *is* the fight. Every gem you clear is a blow landed, a wound healed, or a cascade that turns one good move into a devastating one. Luck fills the board — **you** decide what happens next.

> The numbers below are the game's live settings. Anywhere you see `{{CONFIG:name}}`, the screen shows the real value from the engine, so this guide never goes stale. Current values are noted in brackets so the math reads cleanly.

---

## 1. The Move — one tile, one drag, {{CONFIG:moveTimerMs}} [5 seconds]

The board is a **{{CONFIG:boardCols}}×{{CONFIG:boardRows}}** grid [6 wide, 5 tall] of colored gems: **Red, Green, Blue, Yellow** (the four damage colors) and **Purple** (heal).

On your turn:

1. **Press and hold** any gem to pick it up.
2. **Drag** it through the grid, one step at a time — up, down, left, or right. Diagonals aren't allowed.
3. Each step **swaps** your held gem with the neighbor it moves into. You can snake all over the board, re-arranging a whole region in a single move.
4. **Let go** to lock it in. Matches resolve, then it's the enemy's turn.

**The clock.** You get about **{{CONFIG:moveTimerMs}}** [5 seconds] — but it doesn't start when you pick a gem up. It starts the instant the gem **first moves**. So take your time planning where to grab; the pressure only begins once you commit to dragging. Plan the whole path in your head, then execute fast.

That gap — free planning, timed execution — is the skill. The board is the same for anyone; the difference is what you see in it.

---

## 2. Matches, Combos & Cascades — the damage math

**A match** is **{{CONFIG:matchMin}} [3] or more** gems of the same color in a row or column. Every match of a damage color clears and deals damage. A match of Purple clears and heals you instead.

Three things stack your damage:

- **Bigger groups hit harder.** Every gem beyond the third in a group adds **+{{CONFIG:groupSizeBonus}} [+25%]** to that group. A 3-gem match is the base; a 4-gem match is ×1.25; a 5-gem match is ×1.5.
- **Cascades multiply the whole move.** When gems clear, the ones above fall to fill the gaps — and if that creates *new* matches, they clear too. Each **extra combo** beyond the first adds **+{{CONFIG:cascadeBonus}} [+25%]** to the entire move. This is where huge turns come from: set up a board that keeps matching itself as it falls.
- **Affinity** (next section) doubles or halves each group depending on the enemy's weakness.

### The formula, plainly

For each cleared group:

> **group damage = {{CONFIG:attackBase}} [3]  ×  size bonus  ×  affinity**

where **size bonus = 1 + {{CONFIG:groupSizeBonus}} × (group size − {{CONFIG:matchMin}})** [1 + 0.25 × (size − 3)].

Add up every group, then multiply the total by the cascade multiplier:

> **cascade multiplier = 1 + {{CONFIG:cascadeBonus}} × (total combos − 1)** [1 + 0.25 × (combos − 1)]

> **final damage = round( (sum of all group damage) × cascade multiplier )**

**The rounding happens only once, at the very end.** Groups are summed and cascade-multiplied at full precision, and the final total is rounded a single time. (Healing from Purple is totaled and rounded the same way, separately.)

### Worked example

Say your drag sets off two waves against a slime that's **weak to Red**:

- **Wave 1:** a match of **4 Red** gems clears. Slime is weak to Red, so affinity = **×2**.
  → 3 × (1 + 0.25×(4−3)) × 2 = 3 × **1.25** × 2 = **7.5**
- **Wave 2 (cascade):** gems fall and form a match of **3 Green**. Slime is normal to Green, so affinity = **×1**.
  → 3 × (1 + 0.25×(3−3)) × 1 = 3 × **1.0** × 1 = **3.0**

Now combine. That was **2 combos**, so the cascade multiplier is 1 + 0.25×(2−1) = **×1.25**.

> (7.5 + 3.0) × 1.25 = 10.5 × 1.25 = **13.125 → 13 damage**

Notice the single rounding matters: if you rounded each group *first* (8 + 3 = 11, then ×1.25 = 13.75 → 14) you'd get a different number. The game always sums first and rounds last — so **13** is what lands.

Your starting HP pool is **{{CONFIG:playerMaxHp}} [60]**, so learning to chain cascades is the difference between trading blows and ending fights in one turn.

---

## 3. Affinity — hit them where it hurts

Every enemy has an affinity table. When a damage color lands, it's multiplied by that enemy's affinity to the color:

| Affinity | Multiplier | Meaning |
|---|---|---|
| **Weak** | **×{{CONFIG:affinityWeak}} [2]** | Double damage — this is the color to aim for |
| **Normal** | ×1 | No change (the default for any color not listed) |
| **Resist** | **×{{CONFIG:affinityResist}} [0.5]** | Half damage — avoid leaning on this color |
| **Immune** | **×{{CONFIG:affinityImmune}} [0]** | No damage at all |

Read the enemy before you plan your drag. A skeleton that **resists Red but is weak to Blue** rewards a Blue-focused move and punishes a Red one — the same gems can do quadruple the work depending on which color you build. Purple (heal) ignores affinity entirely; it always mends you.

---

## 4. Telegraph Trust — what you see is what fires

Above every enemy is a **telegraph** showing exactly what it will do on its next turn:

- **⚔ 8** — it will attack for 8.
- **⚡ charge** — it's winding up. No damage this turn, but a bigger hit is coming (skeletons go ⚔ 8 → ⚡ charge → ⚔ 16).
- **✚ heal 8** — it will heal itself for 8.

**The telegraph is a promise. What you see is exactly what fires.** No hidden dice, no surprise crits. If it says ⚔ 20, plan for 20. This holds even for bosses on the exact turn they change phase — the telegraph updates to the phase's true opening move before it happens, never after. Trust it, and you can plan several turns ahead: race a healer, tank a small hit to set up a cascade, or burst a boss before its charged blow lands.

---

## 5. Relics & Drafting — build your run

**Relics** are permanent passive powers you collect during a run. After winning fights you'll **draft** one from a small offer; **shops** sell relics and healing for gold. The more relics you stack, the more your build takes shape.

Relics come in three rarities — **common, epic, legendary**. Rarer relics are stronger or stranger, and they show up less often in drafts and shops (rarity also shifts the Altar's odds — see below). Your base set is always available; the rest are unlocked through play.

**How relic effects stack.** Multiple relics that touch the same thing combine in one fixed order: **all the flat additions happen first, then all the percentage multipliers.**

> **result = (base value + every +flat) × every (1 + percentage)**

So a relic that adds **+2** flat damage and one that adds **+50%** to Red combine as *(base + 2) × 1.5* — never the other way around. This means flat bonuses matter most on small hits, and percentage bonuses reward the big cascades you're already building. Relics can key off a **color**, a **combo count** (rewarding longer cascades), combat start, each turn, gold earned, and more — so different relic sets push you toward different playstyles.

---

## 6. The Map — choose your road

Each act is a branching map climbed one floor at a time. You always take **one node per floor**, and forks let you choose your route. Every path is guaranteed at least one Rest and ends at the boss. Node types:

- **⚔ Fight** — a standard enemy encounter. Win to draft a relic.
- **☠ Elite** — a tougher, scaled-up enemy for a richer reward. More risk, more payoff.
- **🛒 Shop** — spend gold on relics or healing.
- **❓ Event** — a choice, sometimes a gamble, for gold, HP, or a relic.
- **🔥 Rest** — heal **{{CONFIG:restHealPct}} [30%]** of your max HP, once. Bank it before a boss.
- **⛧ Altar** *(new)* — a fateful choice (see below).
- **👑 Boss** — the floor's end: a **3-phase** foe that shifts its affinity and script as its HP drops. Beat it to move on.

**Route strategy:** plan your line before you climb. Weigh Elites (power now, danger now) against safer Fights, and make sure a Rest sits between you and the boss when your HP is thin.

### ⛧ The Altar — sacrifice for permanence

The Altar offers **one** choice: **sacrifice the run.** The run ends immediately (it counts as a defeat for scoring — but the score you've banked so far still counts), and in exchange you **permanently unlock a brand-new relic** you didn't have before. That relic joins your pool for every future run.

**The deeper you are, the rarer the reward.** An Altar late in Act 2 is far more likely to hand you an epic or legendary than one early in Act 1. Sacrificing a strong run for a legendary relic is a real, deliberate trade — sometimes the best move for your *next* run is to end this one.

---

## 7. Acts & Biomes — two dungeons, one run

A full run is now **two acts**.

- **Act 1** is always the **Dungeon** — slimes, skeletons, and bats, capped by the **Bone Colossus**.
- **Act 2** is always a *different* biome, drawn from the ones you've unlocked. There are **four** to discover, each with its own theme, its own four enemies, its own 3-phase boss, and its own legendary relics.

After you fell the Act 1 boss, you catch your breath (a bit of healing) and drop into a second 13-floor map in the new biome. The difficulty curve **keeps climbing** — Act 2 is meant to test the build you assembled in Act 1. **Beating the Act 2 boss wins the run.** Dying anywhere ends it.

The first time Act 2 lands you in a new biome, that biome is **permanently unlocked**: all its compendium entries reveal, and its legendary biome relic enters your pool.

---

## 8. Death, Score & Unlocks

**Death.** If your HP reaches 0 — in any fight, in any act — the run is over. There's no revive. But a lost run is never wasted.

**Score banks every run, win or lose:**

> **score = (deepest floor reached × {{CONFIG:scorePerFloor}} [1]) + (encounters won × {{CONFIG:scorePerEncounterWon}} [2]) + (victory ? {{CONFIG:victoryBonus}} [10] : 0)**

Even a defeat banks the floors and fights it earned, so you always make progress. Your cumulative score unlocks new **starting roles** — power-neutral ways to begin a run (a starting relic traded against a smaller HP pool, map foresight, and so on). They change *how* you start, never how strong you are.

**Three more ways to unlock content permanently:**

1. **Reach a new biome** → the biome and its legendary relic unlock.
2. **Kill a boss for the first time** → that boss's legendary relic unlocks.
3. **Use an Altar** → sacrifice the run to unlock a new relic (deeper = rarer).

Everything you fight or unlock fills the **Compendium** — enemies, bosses, and relics you haven't met yet show as locked silhouettes, with a running "discovered" count per section.

**Boss Rush & the God of War.** Once you've discovered all five bosses, a **Boss Rush** mode opens: all five, back-to-back, no map. Win it once and you earn the **God of War** — a prestige starting class, and proof you've truly mastered the cascade.

---

*Skill comes from engineering cascades. Everything else — the drag, the build, the route — is how you turn a lucky board into a certain kill.*
