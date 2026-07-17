/**
 * The relic roster — 88 relics AS DATA: the 12 base relics (Stage 3) plus the 76 Stage-6
 * expansion relics (content-relics.md). Every entry is a pure `Relic`: an id, a name, a line
 * of fantasy-lite flavor, a rarity tier, an `unlockedByDefault` gate, and its per-hook modifiers.
 * There is NO engine logic here — behavior is computed from these modifiers by relicHooks.ts.
 * Adding a relic is a new object in ROSTER; nothing else changes.
 *
 * RARITY MIGRATION (content-relics.md): the legacy `normal`→`common`, `elite`→`epic`. The base
 * 12 are the ONLY `unlockedByDefault: true` relics; every expansion relic starts locked (`false`)
 * and enters the pool later via the biome/boss/altar meta paths (wave 2). Draft/shop pools filter
 * to the unlocked set by default (draft.ts / shop.ts).
 *
 * RARITY LEDGER (asserted in tests): base 9 common + 3 epic; new 40 common + 22 epic + 14
 * legendary ⇒ 49 common / 25 epic / 14 legendary = 88 total.
 *
 * PURE ENGINE: no React / React Native imports; deterministic; immutable data.
 */
import { HOOK_NAMES, MODIFIER_KINDS } from './relicTypes';
import type { Relic, RelicModifier, RelicRegistry } from './relicTypes';

/**
 * The roster in canonical order — base 12 FIRST (preserving the Stage-3 draft/stacking/tiebreak
 * order and the def[0]/color-coverage fixtures), then the 76 expansion relics grouped by rarity
 * and source. This order is the draft pool order and the stacking tiebreak.
 */
export const ROSTER: readonly Relic[] = [
  // ══════════════════════════════════════════════════════════════════════════════════════
  // BASE 12 (Stage 3) — the only unlockedByDefault relics. Rarities migrated normal→common,
  // elite→epic (content-relics.md migration note).
  // ══════════════════════════════════════════════════════════════════════════════════════
  // ── 4 affinity-keyed damage relics: +50% to one color (multiplicative) ──────────────
  { id: 'emberfang', name: 'Emberfang Charm', flavor: 'A fang that never cooled from the forge.', tier: 'common', unlockedByDefault: true, hooks: { onDamageComputed: { op: 'mul', amount: 0.5, color: 'R' } } },
  { id: 'verdant-idol', name: 'Verdant Idol', flavor: 'Moss-wrapped, it hungers for green light.', tier: 'common', unlockedByDefault: true, hooks: { onDamageComputed: { op: 'mul', amount: 0.5, color: 'G' } } },
  { id: 'tidecaller-pearl', name: 'Tidecaller Pearl', flavor: 'Storms sleep inside; blue wakes them.', tier: 'common', unlockedByDefault: true, hooks: { onDamageComputed: { op: 'mul', amount: 0.5, color: 'B' } } },
  { id: 'sunspike-medallion', name: 'Sunspike Medallion', flavor: 'Noon made solid; it burns the patient.', tier: 'common', unlockedByDefault: true, hooks: { onDamageComputed: { op: 'mul', amount: 0.5, color: 'Y' } } },
  // ── heal scaling ────────────────────────────────────────────────────────────────────
  { id: 'rowan-chalice', name: 'Chalice of Rowan', flavor: 'Every drop counts twice.', tier: 'common', unlockedByDefault: true, hooks: { onHealComputed: { op: 'mul', amount: 0.5 } } },
  // ── cascade-multiplier modifier: +6% damage per EXTRA combo in the move ──────────────
  { id: 'cascade-sigil', name: 'Cascade Sigil', flavor: 'The longer the fall, the deeper the ruin.', tier: 'epic', unlockedByDefault: true, hooks: { onDamageComputed: { op: 'mul', amount: 0.06, perCombo: true } } },
  // ── economy: +25% gold ────────────────────────────────────────────────────────────────
  { id: 'misers-knuckle', name: "Miser's Knuckle", flavor: 'Coins cling to the greedy.', tier: 'common', unlockedByDefault: true, hooks: { onGoldEarned: { op: 'mul', amount: 0.25 } } },
  // ── defensive: −2 to every incoming attack (NOT a block tile) ─────────────────────────
  { id: 'bulwark-rune', name: 'Bulwark Rune', flavor: 'The blow lands softer on the warded.', tier: 'common', unlockedByDefault: true, hooks: { onIncomingDamage: { op: 'add', amount: -2 } } },
  // ── 2 combat-start effects ────────────────────────────────────────────────────────────
  { id: 'ambushers-cowl', name: "Ambusher's Cowl", flavor: 'Strike before they ever see you.', tier: 'epic', unlockedByDefault: true, hooks: { onCombatStart: { op: 'add', amount: 10, kind: 'enemyChip' } } },
  { id: 'phoenix-feather', name: 'Phoenix Feather', flavor: 'A little warmth, banked against the storm.', tier: 'epic', unlockedByDefault: true, hooks: { onCombatStart: { op: 'add', amount: 8, kind: 'playerHeal' } } },
  // ── per-turn regen ────────────────────────────────────────────────────────────────────
  { id: 'second-wind', name: 'Second Wind Charm', flavor: 'A second breath, taken every turn.', tier: 'common', unlockedByDefault: true, hooks: { onTurnStart: { op: 'add', amount: 1, kind: 'regen' } } },
  // ── flat outgoing damage (additive; stacks before multipliers) ───────────────────────
  { id: 'whetstone-charm', name: 'Whetstone Charm', flavor: 'A keener edge on every strike.', tier: 'common', unlockedByDefault: true, hooks: { onDamageComputed: { op: 'add', amount: 2 } } },

  // ══════════════════════════════════════════════════════════════════════════════════════
  // EXPANSION — COMMON (40) · source: common-designer · unlockedByDefault: false
  // ══════════════════════════════════════════════════════════════════════════════════════
  // ── per-color flat +3 (pre-cascade) ──
  { id: 'cinderbrand-nail', name: 'Cinderbrand Nail', flavor: 'Forge-hot iron that bites deepest in red.', tier: 'common', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'add', amount: 3, color: 'R' } } },
  { id: 'thornmaw-fetish', name: 'Thornmaw Fetish', flavor: 'Bound briars that drink the green light.', tier: 'common', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'add', amount: 3, color: 'G' } } },
  { id: 'frostglass-shard', name: 'Frostglass Shard', flavor: 'A splinter of winter, keen against the blue.', tier: 'common', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'add', amount: 3, color: 'B' } } },
  { id: 'gilded-fulgurite', name: 'Gilded Fulgurite', flavor: 'Lightning cooled to glass, still hungry for gold-fire.', tier: 'common', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'add', amount: 3, color: 'Y' } } },
  // ── per-color +1 flat per EXTRA combo ──
  { id: 'emberflow-chain', name: 'Emberflow Chain', flavor: 'Each falling link fans the red flame hotter.', tier: 'common', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'add', amount: 1, color: 'R', perCombo: true } } },
  { id: 'bramblewind-chain', name: 'Bramblewind Chain', flavor: 'Every tumble tightens the thorns.', tier: 'common', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'add', amount: 1, color: 'G', perCombo: true } } },
  { id: 'undertow-chain', name: 'Undertow Chain', flavor: 'The longer the fall, the higher the tide.', tier: 'common', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'add', amount: 1, color: 'B', perCombo: true } } },
  { id: 'solar-chain', name: 'Solar Chain', flavor: 'Cascades stoke the sun-links link by link.', tier: 'common', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'add', amount: 1, color: 'Y', perCombo: true } } },
  // ── per-color +4 flat on 3+ combos ──
  { id: 'magma-seal', name: 'Magma Seal', flavor: 'Break the third link and the red earth splits.', tier: 'common', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'add', amount: 4, color: 'R', comboThreshold: 3 } } },
  { id: 'moss-seal', name: 'Moss Seal', flavor: 'Three falls wake the green rot beneath.', tier: 'common', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'add', amount: 4, color: 'G', comboThreshold: 3 } } },
  { id: 'rime-seal', name: 'Rime Seal', flavor: 'Three cascades and the blue frost shatters outward.', tier: 'common', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'add', amount: 4, color: 'B', comboThreshold: 3 } } },
  { id: 'dawn-seal', name: 'Dawn Seal', flavor: 'Three links, and dawn breaks all at once.', tier: 'common', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'add', amount: 4, color: 'Y', comboThreshold: 3 } } },
  // ── ALL-color cascade-threshold multiplier ladder ──
  { id: 'groundswell-totem', name: 'Groundswell Totem', flavor: 'A tremor becomes a wave once it starts to roll.', tier: 'common', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.1, comboThreshold: 3 } } },
  { id: 'avalanche-totem', name: 'Scree Totem', flavor: 'Four stones loosed, and the whole slope shifts.', tier: 'common', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.15, comboThreshold: 4 } } },
  { id: 'tectonic-idol', name: 'Tectonic Idol', flavor: 'Five faults, and the deep plates grind.', tier: 'common', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.25, comboThreshold: 5 } } },
  { id: 'cataclysm-bead', name: 'Cataclysm Bead', flavor: 'Six-deep, the world simply gives way.', tier: 'common', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.35, comboThreshold: 6 } } },
  // ── ALL-color cascade-threshold additive ladder ──
  { id: 'rockslide-idol', name: 'Rockslide Idol', flavor: 'Loose scree adds its weight to every long fall.', tier: 'common', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'add', amount: 2, comboThreshold: 3 } } },
  { id: 'faultline-charm', name: 'Faultline Charm', flavor: 'Where the ground cracks five times, it cracks wide.', tier: 'common', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'add', amount: 5, comboThreshold: 5 } } },
  { id: 'sunder-charm', name: 'Sunder Charm', flavor: 'Six links deep, nothing holds together.', tier: 'common', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'add', amount: 8, comboThreshold: 6 } } },
  // ── onCascadeWave (per wave after the first) ──
  { id: 'tremor-stone', name: 'Tremor Stone', flavor: 'Every aftershock finds the enemy again.', tier: 'common', unlockedByDefault: false, hooks: { onCascadeWave: { op: 'add', amount: 1, kind: 'enemyDamage' } } },
  { id: 'springwater-charm', name: 'Springwater Charm', flavor: 'Each wave leaves a little clear water behind.', tier: 'common', unlockedByDefault: false, hooks: { onCascadeWave: { op: 'add', amount: 1, kind: 'playerHeal' } } },
  { id: 'prospectors-lens', name: "Prospector's Lens", flavor: 'The keen eye spots coin in every ripple.', tier: 'common', unlockedByDefault: false, hooks: { onCascadeWave: { op: 'add', amount: 1, kind: 'gold' } } },
  // ── heal relics ──
  { id: 'dewleaf-poultice', name: 'Dewleaf Poultice', flavor: 'A broad leaf, a deeper mending.', tier: 'common', unlockedByDefault: false, hooks: { onHealComputed: { op: 'add', amount: 2 } } },
  { id: 'wellspring-locket', name: 'Wellspring Locket', flavor: 'The longer the cascade, the fuller the well.', tier: 'common', unlockedByDefault: false, hooks: { onHealComputed: { op: 'add', amount: 1, perCombo: true } } },
  { id: 'font-of-renewal', name: 'Font of Renewal', flavor: 'Great falls fill the font to overflowing.', tier: 'common', unlockedByDefault: false, hooks: { onHealComputed: { op: 'mul', amount: 0.25, comboThreshold: 4 } } },
  { id: 'verdant-balm', name: 'Verdant Balm', flavor: 'Three-fold cascades coax the green salve free.', tier: 'common', unlockedByDefault: false, hooks: { onHealComputed: { op: 'add', amount: 3, comboThreshold: 3 } } },
  // ── economy / event side-channels ──
  { id: 'coinpurse-charm', name: 'Coinpurse Charm', flavor: 'A fuller purse for every spoil.', tier: 'common', unlockedByDefault: false, hooks: { onGoldEarned: { op: 'add', amount: 3 } } },
  { id: 'gravekeepers-due', name: "Gravekeeper's Due", flavor: 'The fallen always leave their toll.', tier: 'common', unlockedByDefault: false, hooks: { onEnemyDefeated: { op: 'add', amount: 3, kind: 'gold' } } },
  { id: 'hagglers-chit', name: "Merchant's Rebate", flavor: 'Every bargain returns a little to your hand.', tier: 'common', unlockedByDefault: false, hooks: { onShopPurchase: { op: 'add', amount: 5, kind: 'gold' } } },
  { id: 'travelers-tithe', name: "Traveler's Tithe", flavor: 'Rest, and the road pays its due.', tier: 'common', unlockedByDefault: false, hooks: { onRestUsed: { op: 'add', amount: 12, kind: 'gold' } } },
  { id: 'pathfinders-map', name: "Pathfinder's Map", flavor: 'A new land, and a purse to greet it.', tier: 'common', unlockedByDefault: false, hooks: { onActStart: { op: 'add', amount: 20, kind: 'gold' } } },
  // ── heal side-channels ──
  { id: 'vulture-feather', name: 'Vulture Feather', flavor: 'You mend on what others leave behind.', tier: 'common', unlockedByDefault: false, hooks: { onEnemyDefeated: { op: 'add', amount: 3, kind: 'playerHeal' } } },
  { id: 'bedroll-talisman', name: 'Bedroll Talisman', flavor: 'A warmer camp, a deeper sleep.', tier: 'common', unlockedByDefault: false, hooks: { onRestUsed: { op: 'add', amount: 8, kind: 'playerHeal' } } },
  { id: 'wayfarers-draught', name: "Wayfarer's Draught", flavor: 'One long draught before the next country.', tier: 'common', unlockedByDefault: false, hooks: { onActStart: { op: 'add', amount: 12, kind: 'playerHeal' } } },
  { id: 'almsgivers-token', name: "Almsgiver's Token", flavor: 'Coin given freely returns as vigor.', tier: 'common', unlockedByDefault: false, hooks: { onShopPurchase: { op: 'add', amount: 6, kind: 'playerHeal' } } },
  // ── combat-start ──
  { id: 'skirmishers-dart', name: "Skirmisher's Dart", flavor: 'First blood, drawn before the bell.', tier: 'common', unlockedByDefault: false, hooks: { onCombatStart: { op: 'add', amount: 5, kind: 'enemyChip' } } },
  { id: 'travelers-ration', name: "Traveler's Ration", flavor: 'A bite before battle steadies the hand.', tier: 'common', unlockedByDefault: false, hooks: { onCombatStart: { op: 'add', amount: 4, kind: 'playerHeal' } } },
  // ── defense / regen / cascade mult ──
  { id: 'aegis-scale', name: 'Aegis Scale', flavor: 'The scaled hide turns the worst of every blow.', tier: 'common', unlockedByDefault: false, hooks: { onIncomingDamage: { op: 'mul', amount: -0.15 } } },
  { id: 'trollblood-charm', name: 'Trollblood Charm', flavor: "Wounded, the troll's blood runs thickest — it creeps back hardest when the end is near.", tier: 'common', unlockedByDefault: false, hooks: { onTurnStart: { op: 'add', amount: 3, kind: 'regen', playerHpBelow: 0.5 } } },
  { id: 'chain-link-charm', name: 'Chain-Link Charm', flavor: 'Momentum answers to whoever keeps the chain moving.', tier: 'common', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.03, perCombo: true } } },

  // ══════════════════════════════════════════════════════════════════════════════════════
  // EXPANSION — EPIC (22) · source: epic-designer · unlockedByDefault: false
  // ══════════════════════════════════════════════════════════════════════════════════════
  { id: 'avalanche-crown', name: 'Avalanche Crown', flavor: 'A crown of loose stones; disturb it and the mountain answers.', tier: 'epic', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.55, comboThreshold: 5 }, onIncomingDamage: { op: 'add', amount: 2 } } },
  { id: 'chain-fed-ruin', name: 'Chain-Fed Ruin', flavor: 'Ruin feeds on its own falling.', tier: 'epic', unlockedByDefault: false, hooks: { onCascadeWave: { op: 'add', amount: 3, kind: 'enemyDamage' }, onDamageComputed: { op: 'mul', amount: -0.15 } } },
  { id: 'deepening-spiral', name: 'Deepening Spiral', flavor: 'The deeper the fall, the sweeter the mending.', tier: 'epic', unlockedByDefault: false, hooks: { onHealComputed: { op: 'mul', amount: 0.09, perCombo: true }, onGoldEarned: { op: 'mul', amount: -0.2 } } },
  { id: 'berserkers-bargain', name: "Berserker's Bargain", flavor: 'Hit harder; bleed for it.', tier: 'epic', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.45 }, onIncomingDamage: { op: 'add', amount: 3 } } },
  { id: 'bloodless-edge', name: 'Bloodless Edge', flavor: 'It drinks your mending and whets itself on the dregs.', tier: 'epic', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.35 }, onHealComputed: { op: 'mul', amount: -1 } } },
  { id: 'misers-ruin', name: "Spendthrift's Ruin", flavor: 'Power now, purse never.', tier: 'epic', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.4 }, onGoldEarned: { op: 'mul', amount: -1 } } },
  { id: 'ironroot-aegis', name: 'Ironroot Aegis', flavor: 'Rooted deep, it barely notices the blow.', tier: 'epic', unlockedByDefault: false, hooks: { onIncomingDamage: { op: 'add', amount: -5 }, onDamageComputed: { op: 'mul', amount: -0.15 } } },
  { id: 'counterweight-sigil', name: 'Counterweight Sigil', flavor: 'Brace low to strike high.', tier: 'epic', unlockedByDefault: false, hooks: { onIncomingDamage: { op: 'mul', amount: -0.3 }, onDamageComputed: { op: 'mul', amount: 0.25, comboThreshold: 4 }, onGoldEarned: { op: 'mul', amount: -0.2 } } },
  { id: 'hagglers-charm', name: "Haggler's Charm", flavor: 'A silver tongue shaves every price.', tier: 'epic', unlockedByDefault: false, hooks: { onShopPurchase: { op: 'mul', amount: -0.4, kind: 'price' }, onGoldEarned: { op: 'mul', amount: -0.15 } } },
  { id: 'toll-of-plenty', name: 'Toll of Plenty', flavor: 'The dead pay their toll in coin.', tier: 'epic', unlockedByDefault: false, hooks: { onEnemyDefeated: { op: 'add', amount: 12, kind: 'gold' }, onIncomingDamage: { op: 'add', amount: 1 } } },
  { id: 'wanderers-hearth', name: "Wanderer's Hearth", flavor: 'Every fire burns twice as warm to the weary.', tier: 'epic', unlockedByDefault: false, hooks: { onRestUsed: { op: 'mul', amount: 1, kind: 'restHeal' }, onIncomingDamage: { op: 'add', amount: 2 } } },
  { id: 'ascetics-vow', name: "Ascetic's Vow", flavor: 'Comfort is a wound; refuse it and grow keen.', tier: 'epic', unlockedByDefault: false, hooks: { onRestUsed: { op: 'mul', amount: -1, kind: 'restHeal' }, onDamageComputed: { op: 'mul', amount: 0.25 } } },
  { id: 'second-dawn', name: 'Second Dawn', flavor: 'Each threshold crossed, the light restores you.', tier: 'epic', unlockedByDefault: false, hooks: { onActStart: { op: 'add', amount: 30, kind: 'playerHeal' }, onGoldEarned: { op: 'mul', amount: -0.2 } } },
  { id: 'crescendo-idol', name: 'Echoing Idol', flavor: 'Louder and louder through the hall, until the vault itself breaks.', tier: 'epic', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.6, comboThreshold: 6 }, onIncomingDamage: { op: 'add', amount: 2 } } },
  { id: 'reapers-tally', name: "Reaper's Tally", flavor: 'It keeps a private ledger of the slain, and the grave takes its cut of your vigor.', tier: 'epic', unlockedByDefault: false, hooks: { onEnemyDefeated: { op: 'add', amount: 15, kind: 'gold' }, onHealComputed: { op: 'mul', amount: -0.25 } } },
  { id: 'harvest-of-souls', name: 'Harvest of Souls', flavor: 'Reap the fallen; feed the living.', tier: 'epic', unlockedByDefault: false, hooks: { onEnemyDefeated: { op: 'add', amount: 15, kind: 'playerHeal' }, onHealComputed: { op: 'mul', amount: -0.4 } } },
  { id: 'wavecrash-totem', name: 'Wavecrash Totem', flavor: 'Each breaking wave leaves you stronger on the shore.', tier: 'epic', unlockedByDefault: false, hooks: { onCascadeWave: { op: 'add', amount: 2, kind: 'playerHeal' }, onHealComputed: { op: 'mul', amount: -0.25 } } },
  { id: 'tidal-coffers', name: 'Tidal Coffers', flavor: 'Long tides wash treasure up the strand.', tier: 'epic', unlockedByDefault: false, hooks: { onCascadeWave: { op: 'add', amount: 2, kind: 'gold' }, onDamageComputed: { op: 'mul', amount: -0.1 } } },
  { id: 'emberspiral-torc', name: 'Emberspiral Torc', flavor: 'Red fire climbs its own smoke.', tier: 'epic', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.12, color: 'R', perCombo: true }, onHealComputed: { op: 'mul', amount: -0.2 } } },
  { id: 'prism-overcharge', name: 'Prism Overcharge', flavor: 'Every color turned to a blade.', tier: 'epic', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.3 }, onHealComputed: { op: 'mul', amount: -0.3 } } },
  { id: 'zenith-chalice', name: 'Zenith Chalice', flavor: 'At the peak of the fall, the cup overflows.', tier: 'epic', unlockedByDefault: false, hooks: { onHealComputed: { op: 'mul', amount: 0.6, comboThreshold: 4 }, onDamageComputed: { op: 'add', amount: -2 } } },
  { id: 'heralds-gambit', name: "Herald's Gambit", flavor: 'Announce yourself with a wound.', tier: 'epic', unlockedByDefault: false, hooks: { onCombatStart: { op: 'add', amount: 18, kind: 'enemyChip' }, onHealComputed: { op: 'mul', amount: -0.2 } } },

  // ══════════════════════════════════════════════════════════════════════════════════════
  // EXPANSION — LEGENDARY (14) · unlockedByDefault: false
  // ══════════════════════════════════════════════════════════════════════════════════════
  // ── Biome & boss legendaries (8) ──
  { id: 'rimebound-sigil', name: 'Rimebound Fang', flavor: 'Cold does not comfort the dead here — it cracks them. The fang finds the seam and splits it wide.', tier: 'legendary', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'mul', amount: 1, color: 'B', comboThreshold: 4 } } },
  { id: 'rimeheart-shard', name: 'Rimeheart Shard', flavor: 'The sovereign’s frozen heart, still beating — it armors you in the same rime that guarded it.', tier: 'legendary', unlockedByDefault: false, hooks: { onIncomingDamage: { op: 'mul', amount: -0.3 }, onDamageComputed: { op: 'mul', amount: 0.3, color: 'B' } } },
  { id: 'bellows-heart', name: 'Bellows Heart', flavor: 'Every breath of the bellows burns red; the quench has no hold on you.', tier: 'legendary', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'mul', amount: 1, color: 'R', also: { op: 'mul', amount: -0.5, color: 'B' } } } },
  { id: 'forgeheart-ember', name: 'Forgeheart Ember', flavor: "The forge's dying heart, still hammering in your chest.", tier: 'legendary', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.75, color: 'R' }, onIncomingDamage: { op: 'add', amount: 2 } } },
  { id: 'heartrot-seed', name: 'Heartrot Seed', flavor: 'Let the rot take root — it answers to you now.', tier: 'legendary', unlockedByDefault: false, hooks: { onTurnStart: { op: 'add', amount: 2, kind: 'regen', also: { op: 'add', amount: 1, kind: 'regen', perRotStack: true, rotStackCap: 6 } } } },
  { id: 'sporecrown', name: 'Sporecrown', flavor: 'Crowned in rot, you strike as she did — deathless and blooming.', tier: 'legendary', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.08, perRotStack: true, rotStackCap: 5 } } },
  { id: 'maelstrom-pearl', name: 'Maelstrom Pearl', flavor: 'The deep pays out to those who spin the whole current — clear water and treasure both.', tier: 'legendary', unlockedByDefault: false, hooks: { onCascadeWave: { op: 'add', amount: 3, kind: 'playerHeal', also: { op: 'add', amount: 3, kind: 'gold' } } } },
  { id: 'crown-of-the-drowned-sovereign', name: 'Crown of the Drowned Sovereign', flavor: 'Its weight is the whole sea, and the sea answers to you now.', tier: 'legendary', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.12, color: 'B', perCombo: true }, onCombatStart: { op: 'add', amount: 12, kind: 'enemyChip' } } },
  // ── Designer legendaries (6) ──
  { id: 'bloodstone-altar', name: 'Bloodstone Altar', flavor: 'A shard of the sacrifice-stone; it drinks your blood to whet every blow.', tier: 'legendary', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'mul', amount: 0.75 }, onIncomingDamage: { op: 'mul', amount: 0.6 } } },
  { id: 'avalanche-core', name: 'Landslide Core', flavor: 'Loose one stone and the whole mountain answers.', tier: 'legendary', unlockedByDefault: false, hooks: { onCascadeWave: { op: 'add', amount: 2, kind: 'enemyDamage', perWaveIndex: true } } },
  { id: 'gravebound-tithe', name: 'Gravebound Tithe', flavor: 'The dead pay their toll to the one who felled them.', tier: 'legendary', unlockedByDefault: false, hooks: { onEnemyDefeated: { op: 'add', amount: 12, kind: 'playerHeal', also: { op: 'add', amount: 20, kind: 'gold' } } } },
  { id: 'thornheart-reliquary', name: 'Thornheart Reliquary', flavor: 'Mercy grown thorns — it mends you and rakes the foe in the same breath.', tier: 'legendary', unlockedByDefault: false, hooks: { onHealComputed: { op: 'mul', amount: 0.5 }, onCombatStart: { op: 'add', amount: 15, kind: 'enemyChip' } } },
  { id: 'crescendo-crown', name: 'Crescendo Crown', flavor: 'Nothing, nothing — then everything at once.', tier: 'legendary', unlockedByDefault: false, hooks: { onDamageComputed: { op: 'mul', amount: 1, comboThreshold: 4 } } },
  { id: 'marrow-of-the-colossus', name: 'Marrow of the Colossus', flavor: 'Torn from the skeleton lord’s core — it rends the foe the moment battle is joined.', tier: 'legendary', unlockedByDefault: false, hooks: { onCombatStart: { op: 'add', amount: 0, kind: 'enemyChip', maxHpFraction: 0.12, also: { op: 'add', amount: 10, kind: 'playerHeal' } } } },
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

/**
 * Ids of the relics unlocked from the start (the base 12), in canonical order. Draft/shop pools
 * default to this set, so locked expansion relics never appear until wave 2 wires meta unlocks.
 */
export const UNLOCKED_BY_DEFAULT_IDS: readonly string[] = ROSTER.filter((r) => r.unlockedByDefault === true).map((r) => r.id);

/** Fetch a relic by id. Throws on unknown id (boundary validation). */
export function getRelic(id: string, registry: RelicRegistry = RELIC_REGISTRY): Relic {
  const relic = registry[id];
  if (relic === undefined) {
    throw new Error(`getRelic: unknown relic id '${id}'`);
  }
  return relic;
}

// ── Registry integrity (the canonical-schema validator) ──────────────────────────────────
const KNOWN_HOOKS: ReadonlySet<string> = new Set<string>(HOOK_NAMES);
const KNOWN_KINDS: ReadonlySet<string> = new Set<string>(MODIFIER_KINDS);
const KNOWN_OPS: ReadonlySet<string> = new Set<string>(['add', 'mul']);
const KNOWN_COLORS: ReadonlySet<string> = new Set<string>(['R', 'G', 'B', 'Y', 'P']);

/** Validate ONE modifier (and its `also` chain) against the canonical schema. Throws on any typo. */
function assertModifierWellFormed(relicId: string, hook: string, mod: RelicModifier): void {
  if (!KNOWN_OPS.has(mod.op)) {
    throw new Error(`relic '${relicId}' hook '${hook}': unknown op '${mod.op}'`);
  }
  if (!Number.isFinite(mod.amount)) {
    throw new Error(`relic '${relicId}' hook '${hook}': non-finite amount`);
  }
  if (mod.color !== undefined && !KNOWN_COLORS.has(mod.color)) {
    throw new Error(`relic '${relicId}' hook '${hook}': unknown color '${mod.color}'`);
  }
  if (mod.kind !== undefined && !KNOWN_KINDS.has(mod.kind)) {
    throw new Error(`relic '${relicId}' hook '${hook}': unknown kind '${mod.kind}'`);
  }
  if (mod.comboThreshold !== undefined && (!Number.isInteger(mod.comboThreshold) || mod.comboThreshold < 1)) {
    throw new Error(`relic '${relicId}' hook '${hook}': comboThreshold must be a positive integer`);
  }
  if (mod.playerHpBelow !== undefined && !(mod.playerHpBelow > 0 && mod.playerHpBelow <= 1)) {
    throw new Error(`relic '${relicId}' hook '${hook}': playerHpBelow must be a fraction in (0, 1]`);
  }
  if (mod.rotStackCap !== undefined && (!Number.isInteger(mod.rotStackCap) || mod.rotStackCap < 1)) {
    throw new Error(`relic '${relicId}' hook '${hook}': rotStackCap must be a positive integer`);
  }
  if (mod.maxHpFraction !== undefined && !(mod.maxHpFraction > 0 && mod.maxHpFraction <= 1)) {
    throw new Error(`relic '${relicId}' hook '${hook}': maxHpFraction must be a fraction in (0, 1]`);
  }
  if (mod.also !== undefined) {
    assertModifierWellFormed(relicId, hook, mod.also);
  }
}

/**
 * Assert that ONE relic is well-formed against the canonical schema: known hook names, ops,
 * colors, kinds, and valid condition/scaler values (incl. every `also` link). A typo'd hook,
 * kind, or condition value is a THROW — so it surfaces as a test failure, never a silent no-op.
 */
export function assertRelicWellFormed(relic: Relic): void {
  if (typeof relic.id !== 'string' || relic.id.length === 0) {
    throw new Error('relic has an empty/invalid id');
  }
  for (const hook of Object.keys(relic.hooks)) {
    if (!KNOWN_HOOKS.has(hook)) {
      throw new Error(`relic '${relic.id}' references unknown hook '${hook}'`);
    }
    const mod = relic.hooks[hook as keyof typeof relic.hooks];
    if (mod !== undefined) {
      assertModifierWellFormed(relic.id, hook, mod);
    }
  }
}

/** Assert every relic in a roster is well-formed (registry integrity). */
export function assertRosterWellFormed(roster: readonly Relic[] = ROSTER): void {
  for (const relic of roster) {
    assertRelicWellFormed(relic);
  }
}
