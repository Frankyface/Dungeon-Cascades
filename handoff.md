# Handoff — Dungeon Cascades
_Last updated: 2026-07-17 · Current stage: stage-6-expansion (implementation COMPLETE; matrix + Cam's gates remain)_

## 🎯 Goals
Act 2 expansion is implemented, audited, and fixed. Remaining: the final purity/balance matrix
(running in background), Cam's on-device verdicts, and Stage 5 asset integration when art arrives.

## 📍 Current State
- Expansion FULLY BUILT: 2 acts, 5 biomes, 19 enemies + 5 bosses, 88 relics (49C/25E/14L), 3 unlock
  paths (biome-reach / boss-kill / altar-sacrifice), boss rush → God of War, tutorial, locked
  compendium, biome theming, secret dev mode (7-tap menu title; storage-isolated).
- Balance: all §9 bands PASS — win 49.2%, biome fairness 3.5-3.7pp (≤10), act-1-boss 68.1%, roles all
  ±5pp, GoW 60.2% (prestige-exempt), tranches 2.5/17 runs. Fairness gate shipped in `npm run sim`.
- Audits done + ALL findings fixed: implemented-relic audit (heartrot immunity), adversarial review
  (channel visibility with status chips + effective numbers, dev-leak guard, GoW start card, altar
  ordering + effective odds).
- Suite: 84 suites / 933 tests green · tsc clean · iOS export clean · board+combat baselines byte-identical.
- Builds: pre-tune expansion build 6a70e1ac done; FINAL tuned build launching from 67e3a42.

## 📂 Files I'm Working On
- Background: final EAS build + the full `--mode report` purity matrix (×2 + diff).

## ✅ Things I've Changed
- 2026-07-17 — Fix wave: channel visibility (effective dmg/heal + chips), heartrot, dev-leak, GoW card.
- 2026-07-17 — Per-biome fairness instrumentation shipped into run sim + balance report.
- 2026-07-17 — Balance: bands tuned, roles reworked (Cartographer), biome fairness content amendments.
- 2026-07-17 — Progression: unlocks, altar, boss rush + pre-draft, dev helpers; two-act runs.
- 2026-07-17 — Content: 4 biomes, 16 enemies, 4 bosses, 76 relics from the audited design workflow.

## ❌ Watch Out
- Altar per-run idempotency deferred (needs MetaState schema surgery): crash in the ms window between
  the two awaited writes → benign double-unlock. Known residual, logged in the fix-wave report.
- Combat fixtures pin constants; content-biomes.md carries dated amendment notes — spec and data move together.
- The `--mode report` matrix at 2000 games × 8 configs × 2 passes is an hours-long job — stable window only.

## ➡️ Next Up
1. Background jobs finish → verify matrix verdicts (roles purity, fairness, determinism) + transcribe
   into staging/stage-6-expansion/; submit the final build (Cam: `npx eas-cli submit -p ios --latest`).
2. Cam on-device: two-act run, altar sacrifice, a biome unlock ceremony, boss rush attempt, tutorial,
   compendium discovery states, dev mode isolation; fun-gate verdicts per help.md.
3. Stage 5 when Cam's sounds/graphics arrive (help.md shopping list).

## 🔗 Pointer
Current stage folder: `staging/stage-6-expansion/`
Active file: `staging/stage-6-expansion/spec-systems.md` (§9 gates — matrix evidence lands beside it)
