# Stage 6 — Expansion Systems Spec (BINDING — from Cam's directive, 2026-07-16)

The gameplay loop is validated as-is ("the game play loop is perfect"). This stage ADDS content and
systems around it. Board/combat core mechanics do not change.

## 1. Acts & Biomes
- A run now has **TWO ACTS**. Act 1 is ALWAYS the default biome (Dungeon: slime/skeleton/bat + Bone
  Colossus). Act 2 is ALWAYS a different biome, seeded-random among the player's act-2 pool.
- **4 new biomes**, each with: theme + palette (UI tint set), **4 exclusive enemies**, **1 boss**
  (3-phase, script + affinity-shift model like Bone Colossus), **1 legendary biome-specific relic**,
  and **1 legendary boss-specific relic**.
- Act 2 = a second 13-floor map in the act-2 biome; difficulty curve CONTINUES (floors 13–25 equivalent
  scaling). Beating the act-2 boss = run victory. Dying anywhere = run over (unchanged).
- Act transition: after the act-1 boss, a brief transition (heal amount: design decision, sim-tuned) then
  the act-2 map.

## 2. Progression / unlock model (three paths; all meta-persistent)
- **(a) Biomes unlock by reaching them**: first time act 2 lands on a biome → that biome is permanently
  unlocked: all its compendium entries reveal AND its legendary biome relic unlocks into the pool.
- **(b) Boss kills**: first kill of each boss → that boss's legendary relic unlocks into the pool.
- **(c) The Altar node**: a new map node type. Interacting offers ONE choice: **sacrifice the run**
  (run ends immediately, counts as a defeat for score; banked score still accrues) in exchange for
  permanently unlocking a NEW (not-yet-unlocked) relic. Unlock rarity odds scale with depth (act,
  floor): deeper = higher epic/legendary chance. Exact odds table: design decision, sim-sanity-checked.
- Locked relics NEVER appear in drafts/shops. The base 12 relics are always unlocked. New relics start
  locked except via the paths above.
- Discovery tracking (for compendium): enemies/bosses are "discovered" when first fought; relics when
  first unlocked/drafted.

## 3. Roles (variant rework)
- Variants become **roles** with real mechanical identity. Cartographer is explicitly called out as too
  weak ("doesn't really do much") — rework it. Every role must pass the "would a player ever pick this
  and feel it" test AND stay inside the ±5pp purity band (existing gate) — EXCEPT God of War (below).
- **God of War class**: awarded for winning Boss Rush. It is deliberately a PRESTIGE class — Cam's
  directive overrides the purity band for this one (log in decisions.md; still sim-measure and report
  its win rate honestly; it must not be selectable until earned).

## 4. Compendium
- Undiscovered relics/bosses/enemies render as LOCKED entries (silhouette/❓ icon + "Undiscovered").
  Counts shown per section ("14/28 discovered"). Existing registry-fidelity test pattern continues.

## 5. Tutorial
- A "How to play" page (menu entry): drag-path move + timer, combos & cascades (with the real damage
  math at current constants: group size bonus, cascade multiplier, single-rounding), affinity/weakness
  targeting, telegraph trust ("what you see is what fires"), relics/drafting, map/route strategy, the
  altar, acts/biomes. Content derives constants from engine config where feasible (no hardcoded stale
  numbers).

## 6. Boss Rush mode
- Unlocked when ALL 5 bosses are discovered. Menu entry (locked with progress until then).
- Mode: fight all 5 bosses back-to-back (order: design decision), no map; healing/draft between bosses:
  design decision (sim-tuned). Death ends the attempt (no meta loss). First victory → unlock **God of
  War** class + compendium flag.

## 7. Relic expansion (+75; total 87)
- New rarity model: **common / epic / legendary** (existing 12 migrate: normal→common, elite→epic).
- Budget for the 75 new: **40 common, 22 epic, 13 legendary** (of the legendaries: 4 biome-specific,
  4 boss-specific from the new bosses, 5 general incl. altar-flavored). Bone Colossus also gets a
  legendary boss relic → +1 (so 76 new total is acceptable; keep ledger exact in the content spec).
- Rarity affects draft/shop weighting and altar odds (design decision, sim-tuned).
- Every relic must be expressible in the hook system. Approved NEW hook types (engine work, keep to
  these): `onCascadeWave` (per-wave triggers), `onEnemyDefeated`, `onActStart`, `onRestUsed`,
  `onShopPurchase`, plus parameterized conditions (color, kind, comboThreshold). Anything beyond needs
  manager sign-off (feasibility audit flags it).

## 8. Secret dev mode (to help test the purity matrix + content)
- Hidden entry (e.g. 7 taps on the menu title). Capabilities: unlock all content toggle (biomes/relics/
  bosses/boss-rush/GoW), reset meta, set run seed + variant + act-2 biome, jump-to-act-2, grant relic,
  reveal fps/perf overlay toggle if cheap. Dev state must NEVER leak into normal meta persistence
  (separate storage key, clearly marked; sim/purity evidence must be dev-mode-free).

## 9. Balance & verification gates (the expansion's DoD)
- All existing suites stay green; engine purity/immutability/determinism constraints unchanged.
- New sim bands (2-act runs, policy bot, 1000+ seeded runs): win rate 20–60%; act-1-boss-reached ≥40%;
  0 wedges; byte-deterministic. Per-biome act-2 win rates within ±10pp of each other (biome fairness).
- Role purity: all roles within ±5pp of vanilla EXCEPT God of War (measured + reported, exempt).
- Relic audit gate (Cam's explicit ask): an Opus audit confirms relics are UNIQUE (no duplicates/
  near-duplicates/strictly-better traps) and USEFUL (every relic plausibly matters in some build) —
  findings fixed before build.
- Boss rush completable by the policy bot under dev-unlock in sim (sanity, no band).
- Final: eas build; then the full purity/balance matrix (the pre-expansion matrix is superseded).

## 10. Out of scope (unchanged)
Sounds/graphics beyond the new app icon (Cam supplies — Stage 5), monetization, cloud saves, Android-first.
