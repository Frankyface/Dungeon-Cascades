# Dungeon Cascades — Stage 6 Expansion: Audit Log (relic audit evidence)

Four audits were run against the Stage-6 content (76 relics + 12 existing = 88 cross-checked;
4 biomes, 16 enemies, 4 bosses). Two passed, two failed; every failing finding was resolved
in the revision — see the changeLog at the end. This file is the audit evidence Cam requested.

## Verdict summary

| Audit | Verdict | Findings | Severity breakdown |
|---|---|---|---|
| Uniqueness | **FAIL** (gate blocks on any HIGH) | 10 | 3 HIGH (H1–H3), 4 MEDIUM (M1–M4), 3 LOW (L1–L3) |
| Usefulness | **PASS** | 3 | 0 useless, 3 weak (trade-math/threshold tuning) |
| Feasibility | **PASS WITH FLAGS** | 15 | 4 HIGH + 4 MED + 1 LOW engine-surgery, 3 data-consistency, 2 notes, 1 stat-bound |
| Distinctiveness | **FAIL** | 5 | 2 HIGH (A–B), 2 MEDIUM (C–D), 1 LOW-MED (E) |

> Note on the uniqueness count: the enumerated findings are 10 (3H/4M/3L). The audit's own
> stats block reported `low: 2 / total: 9`, which is a stale internal tally — the detailed
> violation list contains L1, L2 and L3, so the low count is 3 and the true total is 10.
> All 10 are recorded and all were addressed.

---

## 1. Uniqueness — FAIL

**Verdict.** 3 HIGH-severity uniqueness violations found (audit gate blocks on any HIGH). The
rest of the 76 are cleanly differentiated; the earthquake/threshold ladders, per-color
families, and cascade-wave parallel sets are all intentionally non-dominating. But there is a
cluster of three legendaries that collapse into one design slot, a pair of legendaries sharing
the wave-true-damage niche, and a common that strictly dominates an existing relic.

Stats: 12 existing relics reviewed, 76 new audited, 88 cross-checked; 3 HIGH, 4 MEDIUM, 3 LOW.

### HIGH

- **H1 — dominance chain (3 legendaries, one slot):** `crescendo-crown` (×2), `rimebound-sigil`
  (+80%), `maelstrom-pearl` (+60%) — all legendary, all `onDamageComputed`, all-color, gated
  at comboThreshold ≥ 4, all zero-downside. A strictly-ordered dominance chain. **Fix:** keep
  crescendo-crown as the sole all-color 4+ cliff; redesign the other two onto different axes.
- **H2 — wave-true-damage duplicate:** `rimeheart-shard` (flat +3/wave) and `avalanche-core`
  (escalating +2/+4/+6) occupy the same "deep-cascade anti-resist true-damage" niche, and
  rimeheart-shard is a cost-free legendary twin of the epic `chain-fed-ruin` (+3/wave, −15%).
  **Fix:** keep one wave-true-damage legendary (Landslide Core); re-identity rimeheart-shard.
- **H3 — strict dominance vs existing relic:** `trollblood-charm` (common, +2/turn regen)
  strictly dominates existing `second-wind` (+1/turn) — same hook, same rarity band
  (normal ≈ common), double the value, no downside. **Fix:** make trollblood a conditional
  comeback; confirm the normal→common mapping with Cam.

### MEDIUM

- **M1 — Avalanche name-family collision:** `avalanche-totem`, `avalanche-crown`,
  `avalanche-core`. Rename two.
- **M2 — soft-dominance:** `ascetics-vow` and `prism-overcharge` both grant +30% all-damage;
  ascetics' cost (rest healing) is softer than prism's (−30% in-combat heal). Spread the
  magnitudes/axes.
- **M3 — name + theme collision:** `hagglers-chit` (common flat rebate) vs `hagglers-charm`
  (epic % discount). Rename one.
- **M4 — name-root reuse + soft-dominance:** `misers-ruin` (+50% dmg / no gold) reuses the
  "Miser's" name of existing Miser's Knuckle for the opposite effect AND soft-dominates
  `berserkers-bargain` (+40% / +3 incoming). Rename + rebalance.

### LOW

- **L1 — name similarity:** `crescendo-idol` (epic) vs `crescendo-crown` (legendary). Rename one.
- **L2 — legendary degrades to a common:** `heartrot-seed` baseline (+2/turn) equals common
  `trollblood-charm` outside the Rotwood. Acceptable if biome-gated; consider a small always-on
  secondary.
- **L3 — suffix overload:** `rimebound-sigil`, `counterweight-sigil`, existing `cascade-sigil`
  (plus a "Heart" motif overload). Trim if convenient.

**Clean families confirmed non-dominating:** earthquake all-color threshold-mul ladder
(groundswell ≥3/+10%, scree ≥4/+15%, tectonic ≥5/+25%, cataclysm ≥6/+35%); additive threshold
ladder (rockslide ≥3/+2, faultline ≥5/+5, sunder ≥6/+8); per-color flat add; per-color
perCombo add; per-color ≥3 threshold seals; cascade-wave commons +1/wave by kind; cascade-wave
epics +2–3/wave with cost; heal-scaling variants; combat-start opener ladder; economy/rest/
act-start channels by kind.

---

## 2. Usefulness — PASS

**Verdict.** 0 useless, 3 weak (< 5 threshold ⇒ PASS). All 76 map to a real archetype; the
three weak flags are trade-math/threshold tuning, not dead relics. By rarity: 40 common, 22
epic (audit listed 23 / 13 legendary in a stale tally — the canonical ledger is 40/22/14).

### Weak (fixed in revision)

- **`sunder-charm`** (common) — fired only at 7+ combos and paid a flat +8 diluted by the
  cascade multiplier. **Fix:** gate lowered to 6+.
- **`hagglers-charm`** (epic) — −15% on ALL combat gold outweighed a −25% shop discount for
  most routes (net-neutral-to-negative). **Fix:** discount raised to −40%.
- **`tidal-coffers`** (epic) — −2 flat/group applied BEFORE the cascade multiplier ballooned
  into a large scaling loss on the deep cascades it rewards. **Fix:** changed to a flat −10%
  mul.

**Strongest designs called out:** crescendo-crown, rimebound-sigil/maelstrom-pearl,
forgeheart-ember & bloodstone-altar, gravebound-tithe, marrow-of-the-colossus. Every relic
maps to a real archetype; no orphan effects.

---

## 3. Feasibility — PASS WITH FLAGS

**Verdict.** Of 76 relics, ~63 map cleanly onto existing hooks or the §7 approved set
(`onCascadeWave`/`onEnemyDefeated`/`onActStart`/`onRestUsed`/`onShopPurchase` +
color/kind/comboThreshold). 4 relics need manager sign-off (HIGH engine-surgery beyond §7); 5
need moderate/low extensions; several kind/condition NAMING inconsistencies would cause
resolver bugs and must be canonicalized. Biomes are structurally sound: 1 flagged new verb
each with a sane sketch, valid affinity tiers, HP 45–260, bosses baseHp 150, heals 6–12. The
ONLY stat-bound breach is boss telegraphed nukes exceeding `atk ≤ 20` (7 instances) —
consistent with the Bone Colossus pattern, needing an explicit boss-exempt ruling.

### Engine-surgery — HIGH (manager sign-off) → all respecced in revision

- **`marrow-of-the-colossus`** — used unapproved `onEnemyHpBreak` + per-combat state.
  Respecced onto `onCombatStart` with a `maxHpFraction` chip mode (12% max-HP rend + heal 10).
- **`thornheart-reliquary`** — introduced a `healSpill` cross-domain seam. Respecced to
  `onHealComputed` +50% + `onCombatStart` 15 true chip.
- **`crescendo-idol`** — needed a run-scoped act counter feeding a dynamic mul. Respecced to a
  `comboThreshold:6` cliff (+60%, +2 incoming) and renamed Echoing Idol.
- **`reapers-tally`** — same stateful per-kill snowball. Respecced to `onEnemyDefeated` +15
  gold / −25% healing.

### Engine-surgery — MEDIUM

- **`heartrot-seed`** — two mods on one hook + rot-tick suppression + capped per-stack heal +
  rotStacks context. Resolved via the `RelicModifier[]` refactor + Rotwood rot extension.
- **`sporecrown`** — needs rotStacks in RelicContext + a capped perRotStack scaling mode.
- **`bellows-heart`** — wanted an aggregate move-damage multiplier (no such seam). Respecced to
  Red ×2 / Blue −50% color mods.
- **`gravebound-tithe`** — two channels on one `onEnemyDefeated` hook ⇒ the `RelicModifier[]`
  generalization.

### Engine-surgery — LOW

- **`avalanche-core`** (Landslide Core) — escalating per-wave add needs a `perWaveIndex`
  scaling mode analogous to perCombo.

### Data-consistency (must canonicalize before build)

- **`onCascadeWave` kinds** inconsistent (enemyChip/waveDamage/none; playerHeal/waveHeal;
  gold/waveGold) ⇒ canonicalize to `enemyDamage`/`playerHeal`/`gold`.
- **Player-heal channel** mixes `playerHeal` and `heal` ⇒ canonicalize to `playerHeal`; keep
  `restHeal` distinct as the rest-node value-transform.
- **Combo condition** mixes `comboMin` and `comboThreshold` ⇒ standardize on `comboThreshold`.

### Feasibility notes

- **`onShopPurchase`/`onRestUsed` dual semantics** — route by kind: value-transform kinds
  (`price`/`restHeal`) vs additive side-effect kinds (`gold`/`playerHeal`). No new hook needed.
- **Additive-penalty floor** — clamp negative additive mods at apply sites (incoming ≥ 0,
  damage group ≥ 0) for ironroot-aegis, tidal-coffers, zenith-chalice.

### Stat-bound

- **`boss-attack-over-20`** — 7 boss nukes 22–28 (Rimeheart 22/28, Forgeheart 26/24/28,
  Rotmother 24, Vael 26/24). All non-boss attacks ≤ 20. Ruled boss-exempt (Bone Colossus
  precedent); recorded in decisions.md.

Array-modifier refactor unblocks: gravebound-tithe, marrow-of-the-colossus, heartrot-seed
(and bellows-heart, maelstrom-pearl).

---

## 4. Distinctiveness — FAIL

**Verdict.** 5 distinctiveness defects (2 HIGH, 2 MEDIUM, 1 LOW-MED). Rotwood is the strongest,
most distinctive biome and was used as the template. All four kits pass the threat-mix check
(criterion 5): each has a coherent tank/chip/support/gimmick spread.

- **A (HIGH) — Glacial Crypt ≡ Sunken Catacombs mechanically.** Both were "Blue is the trap
  color" kits with near-identical affinity roles (weak-Y tank, weak-R chipper, weak-G healer)
  and a boss handing Blue a one-phase redemption. **Fix:** re-found Glacial on its `frostArmor`
  barrier verb (shield-break puzzle), drop the biome-wide Blue-resist, redistribute enemy
  answers to four colors (tank weak-Blue, chipper weak-Yellow, healer weak-Red, glass
  weak-Green), and re-tool Rimeheart into a frost-barrier survival boss.
- **B (HIGH) — Emberworks Blue monoculture.** All 4 enemies AND all 3 boss phases were weak
  Blue; Red was a dead color. **Fix:** spread answers (slag-brute weak-Blue, cinder-imp
  weak-Yellow, forge-tender weak-Green, furnace-wisp weak-Blue), and make Forgeheart's answer
  WALK Blue → Red+Green → Yellow, giving Red a real use in the cracked-core window.
- **C (MEDIUM) — permafrost-warden ≡ mirebark-hulk (same tank).** Both ~220–260HP
  hit/hit/charge-nuke soaks. **Fix:** permafrost → frostArmor shield-break grind; mirebark →
  regen tank (self-heal 8).
- **D (MEDIUM) — hoarfrost-cantor ≡ mendcap-colony (same healer).** Both 140HP, ~22 self-heal
  per cycle. **Fix:** hoarfrost → single lumped burst-heal every 3rd turn (answers to Red);
  mendcap → steady dribble (answers to Blue).
- **E (LOW-MED) — frostbite-wisp ≡ cinder-imp ≡ base slime (same chipper).** **Fix:**
  frostbite-wisp flickers a frostArmor tell before biting; cinder-imp uses a low-high 5/8
  flicker — neither is a flat slime reskin.

**Passes:** criterion 5 (all role-complete); criterion 3 (Rotmother and Vael well-differentiated
from Bone Colossus; Rimeheart acceptable via inverse-hardening + frostArmor). Most distinctive
biome: Rotwood. Least (pre-fix): Glacial Crypt.

---

## Revision changeLog (what was actually changed)

**HIGH-severity fixes**

- **H1:** Redesigned `rimebound-sigil` into "Rimebound Fang" (id kept) — a Blue-only ×2 burst at
  4+ combos, off the all-color +80% dominance chain; crescendo-crown remains the sole all-color
  ×2-at-4+ legendary; also drops the overloaded "Sigil" suffix (L3).
- **H1:** Repurposed `maelstrom-pearl` from an all-color +60% threshold mul to a no-cost
  deep-cascade sustain+economy legendary (wave-heal 3 + wave-gold 3 per extra wave),
  differentiating it from Crown of the Drowned Sovereign.
- **H2:** Repurposed `rimeheart-shard` off wave-true-damage to a frost-barrier defensive
  legendary (−30% incoming + Blue +30%), leaving Landslide Core (`avalanche-core`) as the sole
  wave-true-damage legendary and un-shadowing the epic `chain-fed-ruin`.
- **H3:** Reworked `trollblood-charm` into a comeback regen (heal 3/turn only while below 50% HP)
  so it no longer strictly dominates the existing Second Wind Charm (+1/turn); adds a minor
  `playerHpBelow` gate.

**MEDIUM-severity fixes**

- **M1:** Renamed `avalanche-totem` → "Scree Totem" and `avalanche-core` → "Landslide Core"
  (ids kept) to end the Avalanche name-family collision; kept "Avalanche Crown".
- **M2:** Lowered `ascetics-vow` reward to +25% (from +30%) so it no longer soft-dominates
  `prism-overcharge`; deliberately did NOT bump prism (that would have dominated
  `bloodless-edge`).
- **M3:** Renamed `hagglers-chit` → "Merchant's Rebate" (id kept) to clear the Haggler's
  name/theme collision with Haggler's Charm.
- **M4:** Renamed `misers-ruin` → "Spendthrift's Ruin" (id kept) and set damage to +40%; raised
  `berserkers-bargain` to +45% so neither soft-dominates the other (blood-tax = more power,
  economy-tax = combat-safe).

**LOW-severity fixes**

- **L1:** Renamed `crescendo-idol` → "Echoing Idol" (id kept), reserving "Crescendo" for the
  burst crown (also respecced, see feasibility).

**Usefulness fixes**

- **sunder-charm:** Lowered gate 7+ → 6+ combos so it fires within reach; stays additive +8
  above faultline (5+/+5).
- **hagglers-charm:** Raised shop discount to −40% (from −25%) so a shop route nets ahead despite
  the −15% combat-gold cost.
- **tidal-coffers:** Changed the damage cost from flat −2/group (pre-multiplier, which ballooned
  on deep cascades) to a flat −10% mul.

**Feasibility respecs & rulings**

- **marrow-of-the-colossus:** Respecced off the unapproved `onEnemyHpBreak` hook + per-combat
  state onto `onCombatStart` — rend enemy for 12% max-HP true damage + heal 10 at combat start
  (keeps the anti-high-HP identity; trades the 50%-phase-break trigger for an opening rend).
- **thornheart-reliquary:** Respecced off the `healSpill` cross-domain seam to `onHealComputed`
  +50% heal + `onCombatStart` 15 true chip — heal-and-harm duality via existing hooks only.
- **crescendo-idol (Echoing Idol):** Respecced off the stateful per-act damage counter to a
  comboThreshold cliff (6+ combos → +60%, +2 incoming), all approved conditions.
- **reapers-tally:** Respecced off the stateful per-kill damage snowball to `onEnemyDefeated`
  +15 gold / −25% healing (approved hooks).
- **bellows-heart CONFLICT CALL:** Respecced off the unsupported aggregate per-wave
  move-multiplier to Red ×2 / Blue −50%. Feasibility told me to remove the mechanic; its
  suggested flat-wave-damage replacement would have recreated the H2 collision with Landslide
  Core, so feasibility>uniqueness resolves to a Red-commitment relic instead.
- **STAT-BOUND CALL:** Ruled boss telegraphed nukes (22–28) exempt from the atk ≤ 20 bound
  (matches the existing Bone Colossus precedent); all regular enemies remain ≤ 20. Recorded as
  a decision.
- **Data-consistency:** Canonicalized `onCascadeWave` kinds to enemyDamage/playerHeal/gold
  across tremor-stone, chain-fed-ruin, Landslide Core, springwater-charm, wavecrash-totem,
  prospectors-lens, tidal-coffers, maelstrom-pearl.
- **Data-consistency:** Canonicalized the player-heal channel to `playerHeal` (second-dawn,
  harvest-of-souls, marrow, etc.) and kept `restHeal` distinct as the rest-node
  value-transform.
- **Data-consistency:** Standardized `comboMin` → `comboThreshold` (avalanche-crown,
  counterweight-sigil, zenith-chalice).
- **Feasibility note:** Flagged the array-valued `RelicModifier[]` generalization as the shared
  refactor for the two-channels-on-one-hook relics (gravebound-tithe, heartrot-seed,
  bellows-heart, maelstrom-pearl, marrow); confirmed additive-penalty clamps (ironroot-aegis,
  zenith-chalice) and onShopPurchase/onRestUsed per-kind routing.

**Distinctiveness fixes**

- **A:** Re-founded the Glacial Crypt on its `frostArmor` barrier verb (shield-break puzzle) and
  dropped the biome-wide Blue-resist; redistributed enemy answers to four colors — tank
  weak-Blue, chipper weak-Yellow, healer weak-Red, glass weak-Green — so it no longer mirrors
  the Sunken Catacombs' Blue-trap kit.
- **A:** Re-tooled Rimeheart into a frost-barrier survival boss (escalating frostArmor barriers,
  Blue-cracks-brittle-ice through-line + Yellow at the bared heart, no curse/heal) instead of a
  Vael-style affinity walk.
- **B:** Broke the Emberworks Blue monoculture — cinder-imp now weak-Yellow, forge-tender
  weak-Green (slag-brute and furnace-wisp stay Blue); Forgeheart's answer now walks
  Blue → Red+Green → Yellow, giving Red a real use in the cracked-core window.
- **C:** Split the twin tanks — permafrost-warden is now a frostArmor shield-break grind
  (atk/atk/frostArmor), mirebark-hulk is now a regen tank (atk/atk/self-heal 8), instead of both
  being charge-nuke soaks.
- **D:** Reshaped hoarfrost-cantor to a single lumped burst-heal every 3rd turn (atk6/atk6/heal12)
  vs mendcap-colony's steady dribble, and it now answers to Red not Green.
- **E:** Gave the chippers hooks/rhythm — frostbite-wisp flickers a thin frostArmor shell before
  biting (frostArmor5/atk6/atk8); cinder-imp uses a low-high 5/8 flicker — so neither is a flat
  slime reskin.

**Other**

- **L2 (resolved):** heartrot-seed no longer collapses into a common's stat line because
  trollblood-charm changed from flat +2/turn to a conditional comeback; left heartrot at +2 base
  regen.
- **Pass-through:** roles, God of War, and (absent) tutorial left unchanged — no audit touched
  them.
- **Counts held exact:** 4 biomes × (4 enemies + 1 boss + 2 legendaries) + 40 commons + 22 epics
  + 6 designer legendaries = 76 relics, 16 enemies, 4 bosses.
