# Dungeon Cascades — Stage 6 Expansion: Relics (Revised, all 76)

Post-audit relic roster. Grouped by rarity. Each entry gives `id`, name, rarity, source,
flavor, exact effect, hook mapping, and engine notes.

## Rarity ledger

| Rarity | Count | Breakdown |
|---|---|---|
| Common | 40 | 40 designer commons |
| Epic | 22 | 22 designer epics |
| Legendary | 14 | 8 biome+boss (2 per biome × 4) + 6 designer |
| **Total** | **76** | 4 biomes × (4 enemies + 1 boss + 2 legendaries) + 40 commons + 22 epics + 6 designer legendaries |

The 8 biome/boss legendaries: `rimebound-sigil` (Rimebound Fang), `rimeheart-shard`;
`bellows-heart`, `forgeheart-ember`; `heartrot-seed`, `sporecrown`; `maelstrom-pearl`,
`crown-of-the-drowned-sovereign`. The 6 designer legendaries: `bloodstone-altar`,
`avalanche-core` (Landslide Core), `gravebound-tithe`, `thornheart-reliquary`,
`crescendo-crown`, `marrow-of-the-colossus`.

## Migration note — existing relic rarities

The three legacy rarity names map onto the new three-tier scale for all previously-shipped
relics: **existing `normal` → `common`**, **existing `elite` → `epic`**. (Legendary is
unchanged.) This mapping is what makes the H3 uniqueness finding land — `trollblood-charm`
(common) sits in the same band as the existing `second-wind` (`normal → common`) and was
reworked to a comeback-regen so it no longer strictly dominates it. Confirm the base-set
migration is applied before shipping so draft/shop odds and dominance checks use the
unified scale.

## Stacking order (from the tutorial, for reference)

All flat additions apply first, then all percentage multipliers, per hook:
`result = (base + Σ flat) × Π (1 + pct)`. Group damage and cascade multipliers resolve at
full precision; the move total is rounded once at the end.

## Shared engine refactor

Several relics put **two channels on one hook**. These require generalizing
`Relic.hooks` values from a single `RelicModifier` to `RelicModifier[]` and iterating the
array in `applyRelicHooks`. This one contained refactor unblocks: `gravebound-tithe`,
`marrow-of-the-colossus`, `heartrot-seed`, `bellows-heart`, and `maelstrom-pearl`.

---

# COMMON (40)

### 1. Cinderbrand Nail — `cinderbrand-nail` — common — *common-designer*
*"Forge-hot iron that bites deepest in red."*
**Effect:** Red (R) damage groups deal +3 flat damage (added before size/cascade
multipliers).
**Hooks:** `onDamageComputed` {color:R, add 3}.

### 2. Thornmaw Fetish — `thornmaw-fetish` — common — *common-designer*
*"Bound briars that drink the green light."*
**Effect:** Green (G) damage groups deal +3 flat (pre-cascade).
**Hooks:** `onDamageComputed` {color:G, add 3}.

### 3. Frostglass Shard — `frostglass-shard` — common — *common-designer*
*"A splinter of winter, keen against the blue."*
**Effect:** Blue (B) damage groups deal +3 flat (pre-cascade).
**Hooks:** `onDamageComputed` {color:B, add 3}.

### 4. Gilded Fulgurite — `gilded-fulgurite` — common — *common-designer*
*"Lightning cooled to glass, still hungry for gold-fire."*
**Effect:** Yellow (Y) damage groups deal +3 flat (pre-cascade).
**Hooks:** `onDamageComputed` {color:Y, add 3}.

### 5. Emberflow Chain — `emberflow-chain` — common — *common-designer*
*"Each falling link fans the red flame hotter."*
**Effect:** Red groups gain +1 flat per EXTRA combo in the move (1 × (totalCombos−1)).
**Hooks:** `onDamageComputed` {color:R + perCombo, add 1}.

### 6. Bramblewind Chain — `bramblewind-chain` — common — *common-designer*
*"Every tumble tightens the thorns."*
**Effect:** Green groups gain +1 flat per extra combo.
**Hooks:** `onDamageComputed` {color:G + perCombo, add 1}.

### 7. Undertow Chain — `undertow-chain` — common — *common-designer*
*"The longer the fall, the higher the tide."*
**Effect:** Blue groups gain +1 flat per extra combo.
**Hooks:** `onDamageComputed` {color:B + perCombo, add 1}.

### 8. Solar Chain — `solar-chain` — common — *common-designer*
*"Cascades stoke the sun-links link by link."*
**Effect:** Yellow groups gain +1 flat per extra combo.
**Hooks:** `onDamageComputed` {color:Y + perCombo, add 1}.

### 9. Magma Seal — `magma-seal` — common — *common-designer*
*"Break the third link and the red earth splits."*
**Effect:** On moves of 3+ combos, Red groups deal +4 flat (0 otherwise).
**Hooks:** `onDamageComputed` {color:R + comboThreshold:3, add 4}.
**Engine:** approved `comboThreshold` — apply only when totalCombos ≥ 3.

### 10. Moss Seal — `moss-seal` — common — *common-designer*
*"Three falls wake the green rot beneath."*
**Effect:** On moves of 3+ combos, Green groups deal +4 flat.
**Hooks:** `onDamageComputed` {color:G + comboThreshold:3, add 4}.

### 11. Rime Seal — `rime-seal` — common — *common-designer*
*"Three cascades and the blue frost shatters outward."*
**Effect:** On moves of 3+ combos, Blue groups deal +4 flat.
**Hooks:** `onDamageComputed` {color:B + comboThreshold:3, add 4}.

### 12. Dawn Seal — `dawn-seal` — common — *common-designer*
*"Three links, and dawn breaks all at once."*
**Effect:** On moves of 3+ combos, Yellow groups deal +4 flat.
**Hooks:** `onDamageComputed` {color:Y + comboThreshold:3, add 4}.

### 13. Groundswell Totem — `groundswell-totem` — common — *common-designer*
*"A tremor becomes a wave once it starts to roll."*
**Effect:** On moves of 3+ combos, ALL damage groups deal +10% (×1.10). Lowest rung of the
cascade-threshold ladder.
**Hooks:** `onDamageComputed` {comboThreshold:3, mul 0.10}.

### 14. Scree Totem — `avalanche-totem` — common — *common-designer*
*"Four stones loosed, and the whole slope shifts."*
**Effect:** On moves of 4+ combos, ALL groups deal +15% (×1.15). Ladder rung 2; stacks
multiplicatively with the other threshold totems on deep cascades.
**Hooks:** `onDamageComputed` {comboThreshold:4, mul 0.15}.
**Engine:** renamed from "Avalanche Totem" to end the Avalanche name-family collision (M1);
id kept.

### 15. Tectonic Idol — `tectonic-idol` — common — *common-designer*
*"Five faults, and the deep plates grind."*
**Effect:** On moves of 5+ combos, ALL groups deal +25% (×1.25). Ladder rung 3.
**Hooks:** `onDamageComputed` {comboThreshold:5, mul 0.25}.

### 16. Cataclysm Bead — `cataclysm-bead` — common — *common-designer*
*"Six-deep, the world simply gives way."*
**Effect:** On moves of 6+ combos, ALL groups deal +35% (×1.35). Ladder rung 4.
**Hooks:** `onDamageComputed` {comboThreshold:6, mul 0.35}.

### 17. Rockslide Idol — `rockslide-idol` — common — *common-designer*
*"Loose scree adds its weight to every long fall."*
**Effect:** On moves of 3+ combos, ALL groups deal +2 flat (additive).
**Hooks:** `onDamageComputed` {comboThreshold:3, add 2}.

### 18. Faultline Charm — `faultline-charm` — common — *common-designer*
*"Where the ground cracks five times, it cracks wide."*
**Effect:** On moves of 5+ combos, ALL groups deal +5 flat (additive).
**Hooks:** `onDamageComputed` {comboThreshold:5, add 5}.

### 19. Sunder Charm — `sunder-charm` — common — *common-designer*
*"Six links deep, nothing holds together."*
**Effect:** On moves of 6+ combos, ALL groups deal +8 flat (additive). Top additive rung —
a reward for genuinely engineered mega-cascades, now reachable.
**Hooks:** `onDamageComputed` {comboThreshold:6, add 8}.
**Engine:** gate lowered 7+ → 6+ (usefulness fix: fires within reach). Sits above faultline
(5+/+5) on the additive ladder.

### 20. Tremor Stone — `tremor-stone` — common — *common-designer*
*"Every aftershock finds the enemy again."*
**Effect:** Each cascade WAVE after the first deals 1 direct damage to the enemy (ignores
affinity). An N-wave move deals N−1 bonus direct damage.
**Hooks:** `onCascadeWave` {kind:enemyDamage, add 1} (folds once per wave beyond the first).
**Engine:** kind canonicalized to `enemyDamage`; apply rounded (≥0) total as direct
affinity-ignoring HP loss (enemy HP floored at 1).

### 21. Springwater Charm — `springwater-charm` — common — *common-designer*
*"Each wave leaves a little clear water behind."*
**Effect:** Each cascade wave after the first heals the player 1 HP (capped at max).
**Hooks:** `onCascadeWave` {kind:playerHeal, add 1}.

### 22. Prospector's Lens — `prospectors-lens` — common — *common-designer*
*"The keen eye spots coin in every ripple."*
**Effect:** Each cascade wave after the first grants 1 gold (banked on combat resolution).
**Hooks:** `onCascadeWave` {kind:gold, add 1}.

### 23. Dewleaf Poultice — `dewleaf-poultice` — common — *common-designer*
*"A broad leaf, a deeper mending."*
**Effect:** Heal (Purple) groups restore +2 HP each (before cascade multipliers).
**Hooks:** `onHealComputed` {add 2}.

### 24. Wellspring Locket — `wellspring-locket` — common — *common-designer*
*"The longer the cascade, the fuller the well."*
**Effect:** Heal groups restore +1 HP per EXTRA combo (1 × (totalCombos−1)).
**Hooks:** `onHealComputed` {perCombo, add 1}.

### 25. Font of Renewal — `font-of-renewal` — common — *common-designer*
*"Great falls fill the font to overflowing."*
**Effect:** On moves of 4+ combos, heal groups restore +25% HP (×1.25).
**Hooks:** `onHealComputed` {comboThreshold:4, mul 0.25}.

### 26. Verdant Balm — `verdant-balm` — common — *common-designer*
*"Three-fold cascades coax the green salve free."*
**Effect:** On moves of 3+ combos, heal groups restore +3 HP each (additive, 0 otherwise).
**Hooks:** `onHealComputed` {comboThreshold:3, add 3}.

### 27. Coinpurse Charm — `coinpurse-charm` — common — *common-designer*
*"A fuller purse for every spoil."*
**Effect:** Every gold reward increased by +3 flat (applied before banking, ≥0).
**Hooks:** `onGoldEarned` {add 3}.

### 28. Gravekeeper's Due — `gravekeepers-due` — common — *common-designer*
*"The fallen always leave their toll."*
**Effect:** Gain 3 gold each time you defeat an enemy (bosses count once, on reaching 0 HP).
**Hooks:** `onEnemyDefeated` {kind:gold, add 3}.

### 29. Merchant's Rebate — `hagglers-chit` — common — *common-designer*
*"Every bargain returns a little to your hand."*
**Effect:** Each shop purchase refunds 5 gold (net cost reduced by 5, floored so it never
nets negative cost).
**Hooks:** `onShopPurchase` {kind:gold, add 5}.
**Engine:** renamed from "Haggler's Chit" to clear the collision with Haggler's Charm (M3);
id kept. Flat-rebate vs %-discount distinction is now clear in the names.

### 30. Traveler's Tithe — `travelers-tithe` — common — *common-designer*
*"Rest, and the road pays its due."*
**Effect:** Using a Rest node also grants 12 gold.
**Hooks:** `onRestUsed` {kind:gold, add 12} (additive side-channel, distinct from the
`restHeal` value-transform).

### 31. Pathfinder's Map — `pathfinders-map` — common — *common-designer*
*"A new land, and a purse to greet it."*
**Effect:** Gain 20 gold at the start of each act (Act 1 + Act 2 = up to 40 total).
**Hooks:** `onActStart` {kind:gold, add 20}.

### 32. Vulture Feather — `vulture-feather` — common — *common-designer*
*"You mend on what others leave behind."*
**Effect:** Heal 3 HP each time you defeat an enemy (bosses count once; capped at max).
**Hooks:** `onEnemyDefeated` {kind:playerHeal, add 3}.

### 33. Bedroll Talisman — `bedroll-talisman` — common — *common-designer*
*"A warmer camp, a deeper sleep."*
**Effect:** Resting restores +8 additional HP on top of the node's base rest heal (capped
at max).
**Hooks:** `onRestUsed` {kind:playerHeal, add 8} (additive side-channel, distinct from
`restHeal`).

### 34. Wayfarer's Draught — `wayfarers-draught` — common — *common-designer*
*"One long draught before the next country."*
**Effect:** Restore 12 HP at the start of each act (capped at max).
**Hooks:** `onActStart` {kind:playerHeal, add 12}.

### 35. Almsgiver's Token — `almsgivers-token` — common — *common-designer*
*"Coin given freely returns as vigor."*
**Effect:** Each shop purchase heals you 6 HP (capped at max).
**Hooks:** `onShopPurchase` {kind:playerHeal, add 6} (additive side-channel).

### 36. Skirmisher's Dart — `skirmishers-dart` — common — *common-designer*
*"First blood, drawn before the bell."*
**Effect:** Deal 5 damage to the enemy at the start of each combat (enemy HP floored at 1).
**Hooks:** `onCombatStart` {kind:enemyChip, add 5}.

### 37. Traveler's Ration — `travelers-ration` — common — *common-designer*
*"A bite before battle steadies the hand."*
**Effect:** Begin each combat healed for 4 HP (capped at max).
**Hooks:** `onCombatStart` {kind:playerHeal, add 4}.

### 38. Aegis Scale — `aegis-scale` — common — *common-designer*
*"The scaled hide turns the worst of every blow."*
**Effect:** Reduce every incoming enemy attack by 15% (×0.85).
**Hooks:** `onIncomingDamage` {mul −0.15}.

### 39. Trollblood Charm — `trollblood-charm` — common — *common-designer*
*"Wounded, the troll's blood runs thickest — it creeps back hardest when the end is near."*
**Effect:** While you are BELOW 50% max HP, heal 3 HP at the start of each of your turns
(capped at max). Above half health it does nothing. A comeback brick, distinct from Second
Wind Charm's steady +1/turn.
**Hooks:** `onTurnStart` {kind:regen + playerHpBelow:0.5, add 3}.
**Engine:** reworked from a flat +2/turn regen (which strictly dominated the existing Second
Wind Charm, H3) into a conditional comeback: bigger heal, but only when low. Adds a small
`playerHpBelow` gate — a minor condition parallel to the existing enemyHp-fraction machinery
(`bossPhaseForHp`), far cheaper than a new hook, evaluated at `onTurnStart` where player HP
is already known.

### 40. Chain-Link Charm — `chain-link-charm` — common — *common-designer*
*"Momentum answers to whoever keeps the chain moving."*
**Effect:** ALL damage groups deal +3% per EXTRA combo (×(1 + 0.03 × (totalCombos−1))).
**Hooks:** `onDamageComputed` {perCombo, mul 0.03}.

---

# EPIC (22)

### 1. Avalanche Crown — `avalanche-crown` — epic — *epic-designer*
*"A crown of loose stones; disturb it and the mountain answers."*
**Effect:** When a move reaches 5+ combos, every damage group deals +55%. Standing cost:
you take +2 from every incoming attack, cascade or not.
**Hooks:** `onDamageComputed` {comboThreshold:5, mul 0.55}; `onIncomingDamage` {add 2}.
**Engine:** standardized `comboMin` → `comboThreshold`.

### 2. Chain-Fed Ruin — `chain-fed-ruin` — epic — *epic-designer*
*"Ruin feeds on its own falling."*
**Effect:** Each cascade wave after the first deals +3 direct damage to the enemy (a 4-wave
move = +9). Cost: all damage groups deal −15%.
**Hooks:** `onCascadeWave` {kind:enemyDamage, waveIndex≥2, add 3}; `onDamageComputed`
{mul −0.15}.
**Engine:** kind canonicalized `enemyDamage`; gate waveIndex≥2. No longer shadowed by a
cost-free legendary at the same +3 (rimeheart-shard repurposed off wave damage, H2).

### 3. Deepening Spiral — `deepening-spiral` — epic — *epic-designer*
*"The deeper the fall, the sweeter the mending."*
**Effect:** Heal groups heal +9% per extra combo (a 5-combo move = +36%). Cost: −20% gold.
**Hooks:** `onHealComputed` {perCombo, mul 0.09}; `onGoldEarned` {mul −0.20}.

### 4. Berserker's Bargain — `berserkers-bargain` — epic — *epic-designer*
*"Hit harder; bleed for it."*
**Effect:** All damage groups deal +45%. Cost: +3 to every incoming attack.
**Hooks:** `onDamageComputed` {mul 0.45}; `onIncomingDamage` {add 3}.
**Engine:** reward raised +40% → +45% (M4) so the blood-tax relic out-damages the
economy-tax Spendthrift's Ruin (+40%, no gold); neither soft-dominates the other now.

### 5. Bloodless Edge — `bloodless-edge` — epic — *epic-designer*
*"It drinks your mending and whets itself on the dregs."*
**Effect:** All damage groups deal +35%. Cost: Purple heal groups heal 0 — no active
cascade healing at all.
**Hooks:** `onDamageComputed` {mul 0.35}; `onHealComputed` {mul −1} (×0: zeroes every heal
group; forces a defense/lifesteal build).
**Engine:** non-dominated — prism-overcharge stays +30% (not bumped in M2) so it never
dominates this relic's +35%; ascetics-vow was lowered instead.

### 6. Spendthrift's Ruin — `misers-ruin` — epic — *epic-designer*
*"Power now, purse never."*
**Effect:** All damage groups deal +40%. Cost: you earn no gold — no shops, ever.
**Hooks:** `onDamageComputed` {mul 0.40}; `onGoldEarned` {mul −1} (×0: draft-only, no
economy).
**Engine:** renamed from "Miser's Ruin" to break the clash with the existing Miser's
Knuckle (M4a); id kept. Reward lowered +50% → +40% (M4b) so it no longer soft-dominates
Berserker's Bargain — equal-ish power, opposite cost axis.

### 7. Ironroot Aegis — `ironroot-aegis` — epic — *epic-designer*
*"Rooted deep, it barely notices the blow."*
**Effect:** Every incoming attack −5 (heavy flat block). Cost: all damage groups deal −15%.
**Hooks:** `onIncomingDamage` {add −5} (clamped so post-fold incoming ≥ 0);
`onDamageComputed` {mul −0.15}.
**Engine:** confirm incoming-attack clamp at the apply site (≥0).

### 8. Counterweight Sigil — `counterweight-sigil` — epic — *epic-designer*
*"Brace low to strike high."*
**Effect:** Every incoming attack −30% (multiplicative). When a move reaches 4+ combos,
groups deal +25%. Cost: −20% gold.
**Hooks:** `onIncomingDamage` {mul −0.30}; `onDamageComputed` {comboThreshold:4, mul 0.25};
`onGoldEarned` {mul −0.20}.
**Engine:** standardized `comboMin` → `comboThreshold`.

### 9. Haggler's Charm — `hagglers-charm` — epic — *epic-designer*
*"A silver tongue shaves every price."*
**Effect:** All shop prices −40% (pay 60%). Cost: −15% gold from combat.
**Hooks:** `onShopPurchase` {mul −0.40} (price × 0.60); `onGoldEarned` {mul −0.15}.
**Engine:** discount raised −25% → −40% (usefulness) so a shop-heavy route nets ahead
despite the combat-gold penalty. `onShopPurchase` price-transform kind.

### 10. Toll of Plenty — `toll-of-plenty` — epic — *epic-designer*
*"The dead pay their toll in coin."*
**Effect:** Gain +12 gold each time an enemy is defeated. Cost: +1 to every incoming attack.
**Hooks:** `onEnemyDefeated` {kind:gold, add 12}; `onIncomingDamage` {add 1}.
**Engine:** distinct from Reaper's Tally (kill-gold +15 / −25% heal cost) by number and cost
axis.

### 11. Wanderer's Hearth — `wanderers-hearth` — epic — *epic-designer*
*"Every fire burns twice as warm to the weary."*
**Effect:** Rest nodes heal +100% (double the rest heal). Cost: +2 to every incoming attack.
**Hooks:** `onRestUsed` {kind:restHeal, mul 1} (rest heal ×2); `onIncomingDamage` {add 2}.
**Engine:** `restHeal` is the value-transform channel (transforms the node's base heal),
distinct from the additive `playerHeal` side-channel. Cap at max HP.

### 12. Ascetic's Vow — `ascetics-vow` — epic — *epic-designer*
*"Comfort is a wound; refuse it and grow keen."*
**Effect:** Rest nodes heal 0 — you may never rest to recover. In exchange, all damage
groups deal +25% for the whole run.
**Hooks:** `onRestUsed` {kind:restHeal, mul −1} (×0: rest healing forfeited);
`onDamageComputed` {mul 0.25}.
**Engine:** reward lowered +30% → +25% (M2) so its softer cost no longer buys the same +30%
as prism-overcharge's harsher −30% in-combat heal cost. Chosen over bumping prism, which
would have made prism dominate bloodless-edge.

### 13. Second Dawn — `second-dawn` — epic — *epic-designer*
*"Each threshold crossed, the light restores you."*
**Effect:** Heal 30 HP at the start of each act. Cost: −20% gold.
**Hooks:** `onActStart` {kind:playerHeal, add 30} (capped at max); `onGoldEarned`
{mul −0.20}.
**Engine:** heal channel canonicalized `heal` → `playerHeal`.

### 14. Echoing Idol — `crescendo-idol` — epic — *epic-designer*
*"Louder and louder through the hall, until the vault itself breaks."*
**Effect:** When a move reaches 6 or more combos, every damage group deals +60%. Moves
under 6 gain nothing. Cost: +2 to every incoming attack.
**Hooks:** `onDamageComputed` {comboThreshold:6, mul 0.60}; `onIncomingDamage` {add 2}.
**Engine:** respecced off the stateful per-act damage counter (feasibility HIGH — no
run-scoped scaler under §7) to a pure comboThreshold cliff, and renamed "Crescendo Idol" →
"Echoing Idol" (L1, reserving "Crescendo" for the burst crown); id kept. A distinct band
above avalanche-crown (5+/+55%) and counterweight (4+/+25%).

### 15. Reaper's Tally — `reapers-tally` — epic — *epic-designer*
*"It keeps a private ledger of the slain, and the grave takes its cut of your vigor."*
**Effect:** Gain +15 gold each time you defeat an enemy. Cost: all your healing is reduced
by 25%.
**Hooks:** `onEnemyDefeated` {kind:gold, add 15}; `onHealComputed` {mul −0.25}.
**Engine:** respecced off the stateful per-kill damage snowball (feasibility HIGH) to a
feasible on-kill economy relic. Distinct axis from Toll of Plenty (heal-cost vs
incoming-cost, bigger bounty).

### 16. Harvest of Souls — `harvest-of-souls` — epic — *epic-designer*
*"Reap the fallen; feed the living."*
**Effect:** Heal 15 HP whenever an enemy is defeated. Cost: heal groups heal −40%.
**Hooks:** `onEnemyDefeated` {kind:playerHeal, add 15} (capped at max); `onHealComputed`
{mul −0.40}.
**Engine:** heal channel canonicalized `heal` → `playerHeal`.

### 17. Wavecrash Totem — `wavecrash-totem` — epic — *epic-designer*
*"Each breaking wave leaves you stronger on the shore."*
**Effect:** Each cascade wave after the first heals you +2 (a 4-wave move = +6). Cost: heal
groups heal −25%.
**Hooks:** `onCascadeWave` {kind:playerHeal, waveIndex≥2, add 2}; `onHealComputed`
{mul −0.25}.
**Engine:** kind canonicalized `playerHeal` (was `waveHeal`); gate waveIndex≥2; capped at
max.

### 18. Tidal Coffers — `tidal-coffers` — epic — *epic-designer*
*"Long tides wash treasure up the strand."*
**Effect:** Each cascade wave after the first adds +2 gold to the fight's reward (a 4-wave
move = +6). Cost: all damage groups deal −10%.
**Hooks:** `onCascadeWave` {kind:gold, waveIndex≥2, add 2}; `onDamageComputed` {mul −0.10}.
**Engine:** kind canonicalized `gold` (was `waveGold`). Damage cost changed from add −2
(pre-multiplier, which the audit showed ballooned on deep cascades) to a flat −10% mul
(usefulness).

### 19. Emberspiral Torc — `emberspiral-torc` — epic — *epic-designer*
*"Red fire climbs its own smoke."*
**Effect:** Red damage groups gain +12% per extra combo (a 5-combo move = +48% on Red).
Cost: −20% healing.
**Hooks:** `onDamageComputed` {color:R + perCombo, mul 0.12}; `onHealComputed` {mul −0.20}.

### 20. Prism Overcharge — `prism-overcharge` — epic — *epic-designer*
*"Every color turned to a blade."*
**Effect:** All four damage colors deal +30% (broad, no color gate). Cost: −30% healing.
**Hooks:** `onDamageComputed` {mul 0.30}; `onHealComputed` {mul −0.30}.
**Engine:** kept at +30% (M2 resolved by lowering ascetics-vow instead) so it never
dominates bloodless-edge (+35%/heal=0).

### 21. Zenith Chalice — `zenith-chalice` — epic — *epic-designer*
*"At the peak of the fall, the cup overflows."*
**Effect:** When a move reaches 4+ combos, heal groups heal +60%. Cost: −2 flat damage per
group.
**Hooks:** `onHealComputed` {comboThreshold:4, mul 0.60}; `onDamageComputed` {add −2}
(clamped so post-fold group damage ≥ 0).
**Engine:** standardized `comboMin` → `comboThreshold`; confirm damage-group clamp.

### 22. Herald's Gambit — `heralds-gambit` — epic — *epic-designer*
*"Announce yourself with a wound."*
**Effect:** Chip the enemy for 18 HP at the start of every combat (never below 1 HP). Cost:
−20% healing all fight.
**Hooks:** `onCombatStart` {kind:enemyChip, add 18}; `onHealComputed` {mul −0.20}.

---

# LEGENDARY (14)

## Biome & boss legendaries (8)

### 1. Rimebound Fang — `rimebound-sigil` — legendary — *biome: glacial-crypt*
*"Cold does not comfort the dead here — it cracks them. The fang finds the seam and splits
it wide."*
**Effect:** On any move that chains 4 or more combos, your BLUE (B) damage groups deal
DOUBLE (×2). Moves under 4 combos, and all non-Blue groups, get nothing. A per-color
skill-cliff tied to the Glacial Crypt's "cold shatters brittle ice" identity — build long
Blue cascades to shatter the frost guardians and any Blue-reachable resist wall.
**Hooks:** `onDamageComputed` {color:B + comboThreshold:4, mul 1} — Blue groups only, only
when totalCombos ≥ 4.
**Engine:** redesigned off the H1 all-color +80% dominance chain (crescendo-crown is now the
sole all-color ×2-at-4+ legendary). Uses ONLY the approved condition (color +
comboThreshold) — no new hook. A binary cliff, distinct from Cascade Sigil's smooth ramp and
Crown of the Drowned Sovereign's Blue perCombo ramp (Crown wins small Blue moves; the Fang
leaps ahead at 4+). Renamed off the overloaded "Sigil" suffix (L3).

### 2. Rimeheart Shard — `rimeheart-shard` — legendary — *boss: rimeheart*
*"The sovereign's frozen heart, still beating — it armors you in the same rime that guarded
it."*
**Effect:** Reduce every incoming enemy attack by 30% (×0.70), and your Blue (B) damage
groups deal +30%. You wear the Rimeheart's frost barrier: the cold that shields you also
sharpens your strike.
**Hooks:** `onIncomingDamage` {mul −0.30} (multiplicative frost-barrier mitigation; composes
with additive blocks); `onDamageComputed` {color:B, mul 0.30}.
**Engine:** repurposed off wave-true-damage (H2 — Landslide Core is now the sole
wave-true-damage legendary). Existing hooks only. A frost-BARRIER defensive identity fitting
the boss's shield-break fantasy — distinct from aegis-scale (common −15% flat) and
counterweight-sigil (epic −30% + conditional offense + gold cost) by pairing all-combat Blue
offense with no cost at legendary rarity.

### 3. Bellows Heart — `bellows-heart` — legendary — *biome: emberworks*
*"Every breath of the bellows burns red; the quench has no hold on you."*
**Effect:** Your Red (R) damage groups deal DOUBLE (×2). In exchange, your Blue (B) damage
groups deal −50% — you commit wholly to the forge and abandon the quench.
**Hooks:** `onDamageComputed` {color:R, mul 1} (Red ×2); `onDamageComputed` {color:B,
mul −0.5} (Blue ×0.5 — an offensive, build-locking cost, not a survivability tax).
**Engine:** respecced off the unsupported aggregate per-wave move-multiplier (feasibility).
CONFLICT CALL: feasibility suggested flat wave-true-damage, but that would recreate the H2
collision with Landslide Core; feasibility>uniqueness resolves to removing the bad mechanic,
uniqueness>the replacement axis picks a Red-commitment relic instead. Two color mods on
`onDamageComputed` use the array-modifier generalization. Great tension in the reworked
Emberworks: Blue is a key answer color there, so this relic makes you choose Red-commitment
vs the biome's quench.

### 4. Forgeheart Ember — `forgeheart-ember` — legendary — *boss: forgeheart*
*"The forge's dying heart, still hammering in your chest."*
**Effect:** Your Red (R) damage groups deal +75%. In exchange, every incoming enemy attack
that lands hits you for +2.
**Hooks:** `onDamageComputed` {color:R, mul 0.75} (mixed-color moves only boost the R
portion); `onIncomingDamage` {add 2}.
**Engine:** unchanged. Distinct from Bellows Heart (Red ×2 with an offensive Blue-lock cost)
by a smaller Red boost paid with a survivability tax.

### 5. Heartrot Seed — `heartrot-seed` — legendary — *biome: rotwood*
*"Let the rot take root — it answers to you now."*
**Effect:** You are immune to spore/rot damage. At the start of each of your turns you heal
2 HP, plus 1 HP for every rot stack currently on you (bonus capped at +6/turn,
min(6, rotStacks)). Rot stacks still accumulate from enemy spores and decay 1/turn —
spore-heavy fights become sustained healing.
**Hooks:** `onTurnStart` {kind:regen, add 2} (base +2 via existing regen channel);
`onTurnStart` {kind:regen, perRotStack cap 6, add 1} — zero the player-turn rot tick and
instead heal +1 per rot stack, min(6, rotStacks). Folds into ONE `onTurnStart` modifier via
the array-mod/rot extension.
**Engine:** consumes the Rotwood's sanctioned rot extension (rotStacks in RelicContext +
rot-immunity check). L2 collision with trollblood-charm resolved because trollblood is now a
conditional comeback relic, not flat +2/turn.
**Balance:** neutralises only the biome's DoT; the raw burst nukes (Mirebark 12/12, Deathcap
20, Rotmother 24) are untouched. Outside the Rotwood degrades to a modest +2/turn regen.

### 6. Sporecrown — `sporecrown` — legendary — *boss: the-rotmother*
*"Crowned in rot, you strike as she did — deathless and blooming."*
**Effect:** While you carry any spore/rot stacks, your outgoing damage is increased by +8%
per rot stack, capped at +40% (5 stacks).
**Hooks:** `onDamageComputed` {rotStacks > 0, mul 0.08} — effective factor =
1 + 0.08 × min(5, rotStacks); folds as a single mul. Requires rotStacks in the damage
context (the Rotwood rot extension).
**Engine:** consumes the Rotwood rot extension (rotStacks context + capped perRotStack
scaling). Pure fold otherwise.
**Balance:** alone it demands you willingly eat rot; dead outside the Rotwood. Paired with
Heartrot Seed the rot becomes free AND a damage multiplier.

### 7. Maelstrom Pearl — `maelstrom-pearl` — legendary — *biome: sunken-catacombs*
*"The deep pays out to those who spin the whole current — clear water and treasure both."*
**Effect:** Each cascade WAVE after the first heals you 3 HP AND grants 3 gold (a 4-wave
move = +9 HP and +9 gold). No cost. The whirlpool rewards deep, engineered cascades with
sustain and coin.
**Hooks:** `onCascadeWave` {kind:playerHeal, waveIndex≥2, add 3} (capped at max);
`onCascadeWave` {kind:gold, waveIndex≥2, add 3} (banked at combat resolution).
**Engine:** repurposed off the H1 all-color +60% threshold dominance chain to a per-wave
deep-sea effect, and off wave-TRUE-DAMAGE (reserved for Landslide Core, H2). Two channels on
`onCascadeWave` use the array-mod generalization; canonical kinds playerHeal/gold. Distinct
from wavecrash-totem (wave-heal + heal cost) and tidal-coffers (wave-gold + damage cost) by
combining both channels with no cost at legendary rarity.
**Pairing:** twinned with Crown of the Drowned Sovereign — both reward spinning the current
(Crown for Blue-cascade damage, the Pearl for cascade sustain + gold). Together they anchor a
Blue deep-cascade build without either being auto-win.

### 8. Crown of the Drowned Sovereign — `crown-of-the-drowned-sovereign` — legendary — *boss: drowned-sovereign*
*"Its weight is the whole sea, and the sea answers to you now."*
**Effect:** Your Blue damage grows by +12% for every EXTRA combo in the move (a 5-combo Blue
move = +48% Blue; a 1-combo Blue move = +0%). Additionally, every combat opens with the
undertow dragging the enemy under for 12 chip damage.
**Hooks:** `onDamageComputed` {color:B + perCombo, mul 0.12} — Blue-only, scales by
(totalCombos − 1); lines up with Vael's Ebb phase (weak-B 2.0). `onCombatStart`
{kind:enemyChip, add 12} — one-time undertow opener, never below 1 HP.
**Engine:** unchanged. Uses only already-implemented hooks.

## Designer legendaries (6)

### 9. Bloodstone Altar — `bloodstone-altar` — legendary — *legendary-designer*
*"A shard of the sacrifice-stone; it drinks your blood to whet every blow."*
**Effect:** All outgoing damage +75% (×1.75). In exchange, every incoming enemy attack +60%
(×1.6).
**Hooks:** `onDamageComputed` {mul 0.75} (all colors); `onIncomingDamage` {mul 0.60}
(composes AFTER additive mitigations).
**Engine:** unchanged. Pure existing hooks.

### 10. Landslide Core — `avalanche-core` — legendary — *legendary-designer*
*"Loose one stone and the whole mountain answers."*
**Effect:** Each cascade wave AFTER the first deals bonus TRUE damage that grows with the
chain: +2 on the 2nd wave, +4 on the 3rd, +6 on the 4th, and so on — dealt straight to the
enemy, ignoring all affinity, resistance, and immunity.
**Hooks:** `onCascadeWave` {kind:enemyDamage, perWaveIndex, add 2} — per-wave true damage =
2 × (waveIndex − 1); waveIndex 1 gets nothing. Direct enemy HP loss, bypasses affinity.
**Engine:** renamed from "Avalanche Core" to end the Avalanche name-family collision (M1);
id kept. Now the SOLE wave-true-damage legendary (rimeheart-shard repurposed off it, H2).
Needs the small `perWaveIndex` scaling mode on `effectiveAmount` (analogous to perCombo,
using the waveIndex `onCascadeWave` already threads) and canonical `enemyDamage` kind.

### 11. Gravebound Tithe — `gravebound-tithe` — legendary — *legendary-designer*
*"The dead pay their toll to the one who felled them."*
**Effect:** Whenever you defeat an enemy, immediately heal 12 HP (capped at max) and collect
20 bonus gold.
**Hooks:** `onEnemyDefeated` {kind:playerHeal, add 12}; `onEnemyDefeated` {kind:gold,
add 20}.
**Engine:** two channels on ONE hook — requires the array-valued `RelicModifier[]`
generalization (the shared refactor that also unblocks heartrot-seed, bellows-heart,
maelstrom-pearl and the respecced marrow). Fires once per enemy death (boss once).

### 12. Thornheart Reliquary — `thornheart-reliquary` — legendary — *legendary-designer*
*"Mercy grown thorns — it mends you and rakes the foe in the same breath."*
**Effect:** Your Purple heal groups heal +50%. Additionally, every combat opens with the
reliquary's thorns raking the enemy for 15 TRUE damage (never below 1 HP). Sustain and
offense from one relic.
**Hooks:** `onHealComputed` {mul 0.50}; `onCombatStart` {kind:enemyChip, add 15}
(affinity-ignoring, floored at 1 HP).
**Engine:** respecced off the `healSpill` cross-domain seam (feasibility HIGH). Preserves
the heal-and-harm duality using ONLY existing hooks. Distinct from rowan-chalice (heal-only
+50%) by the opening thorn, and from the chip-openers (ambusher's-cowl/herald's-gambit) by
pairing chip with heal amplification.

### 13. Crescendo Crown — `crescendo-crown` — legendary — *legendary-designer*
*"Nothing, nothing — then everything at once."*
**Effect:** A move that reaches 4 or more total combos deals DOUBLE damage — every damage
group in that move is ×2. A move that falls short of 4 combos gains nothing.
**Hooks:** `onDamageComputed` {comboThreshold:4, mul 1} — ×2 to every group, only when
totalCombos ≥ 4.
**Engine:** kept as the SOLE all-color ×2-at-4+ legendary (H1 collapse of the
crescendo-crown/rimebound/maelstrom dominance chain). Pure approved comboThreshold gate on
the existing fold.

### 14. Marrow of the Colossus — `marrow-of-the-colossus` — legendary — *legendary-designer*
*"Torn from the skeleton lord's core — it rends the foe the moment battle is joined."*
**Effect:** At the start of each combat, rend the enemy for TRUE damage equal to 12% of its
max HP (ignoring affinity) and heal 10 HP. Brutal against high-HP bosses and elites (12% of
150+ is a huge chunk) and in Boss Rush; near-useless against trash you delete outright.
**Hooks:** `onCombatStart` {kind:enemyChip, maxHpFraction:0.12} — true damage =
round(enemyMaxHp × 0.12), direct HP loss, floored ≥ 1, bypasses affinity; `onCombatStart`
{kind:playerHeal, add 10} (capped at max).
**Engine:** respecced off the unapproved `onEnemyHpBreak` hook + per-combat `hpBreakFired`
state (feasibility HIGH) onto the EXISTING `onCombatStart` hook. The only extension is a
`maxHpFraction` chip mode (enemyMaxHp is already available at combat start) — far cheaper
than a new hook, and it keeps the anti-high-HP identity. Two channels on one hook use the
array-modifier generalization. Trades the "50% phase-break" thematic trigger for an opening
rend (feasibility>flavor).

---

## Canonicalization reference (feasibility)

- **`onCascadeWave` kinds** canonicalized to `enemyDamage` / `playerHeal` / `gold` across
  tremor-stone, chain-fed-ruin, Landslide Core, springwater-charm, wavecrash-totem,
  prospectors-lens, tidal-coffers, maelstrom-pearl.
- **Player-heal channel** canonicalized to `playerHeal` (second-dawn, harvest-of-souls,
  marrow, vulture-feather, wayfarers-draught, etc.); `restHeal` kept distinct as the
  rest-node value-transform (wanderers-hearth, ascetics-vow).
- **Combo condition** standardized `comboMin` → `comboThreshold` (avalanche-crown,
  counterweight-sigil, zenith-chalice) matching rimebound-sigil / maelstrom-pearl /
  crescendo-crown.
- **Additive-penalty clamps** confirmed at apply sites: incoming ≥ 0 (ironroot-aegis),
  damage group ≥ 0 (tidal-coffers, zenith-chalice).
- **`onShopPurchase` / `onRestUsed` per-kind routing:** value-transform kinds (`price`,
  `restHeal`) vs additive side-effect kinds (`gold`, `playerHeal`).
