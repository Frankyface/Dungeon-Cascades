# Handoff — Dungeon Cascades
_Last updated: 2026-07-16 · Current stage: stage-4-meta-and-balance (Stage 5 on hold for Cam's assets)_

## 🎯 Goals
Finish Stage 2 combat (recalibration in flight), then build Stages 3–5 via managed Opus agents.
Cam's fun-gate verdict (TestFlight) remains the standing kill/pivot check over everything.

## 📍 Current State
- Stage 1: engine + sims **verified done**; UI + fun gate **awaiting Cam** (TestFlight configured).
- Stage 2: **all automated gates passed** (recalibrated: greedy 96.6–100% win, medians 5–7, random ≤0.6%).
- Stage 3: **built + sim-verified** — full rogue-lite playable (map/draft/shop/event/rest/boss/save);
  38.8% policy win rate, 0 wedges/1000 runs. Awaiting Cam on-device.
- Stage 4 **in progress** (agent building variants + purity matrix + balance report); 2 read-only
  review agents sweeping engine + UI in parallel.
- Suite: 51 suites / 415 tests green · tsc clean · expo export clean.

## 📂 Files I'm Working On
- `src/engine/combat/config.ts` + combat fixtures — recalibration agent (in flight).
- `staging/stage-2-combat/feature-combat-resolution.md` — awaiting its sim-band evidence.

## ✅ Things I've Changed
- 2026-07-15 — Combat recalibration decision: ATTACK_BASE→~3, enemies ~80–120 HP, amended per-enemy bands.
- 2026-07-15 — Combat UI: fight screen (telegraph badge, affinity chips, HP anim), menu routes; 179→189 tests.
- 2026-07-15 — Combat sim mode: encounter runner, weakness-targeting greedy-combat bot, per-enemy reports.
- 2026-07-15 — Meta-progression verdict: sim-verified starting variants (±5pp purity band); Stage 4 DoD.
- 2026-07-15 — Combat engine verified: affinity damage, trustworthy intents, 100% module coverage.

## ❌ Watch Out
- Combat unit fixtures PIN constants — any constant change requires hand-recomputed fixtures (see
  "Combat recalibration" in decisions.md; the sim agent correctly refused to force green).
- Two agents sharing the working tree can trip each other's "all tests green" gates — sequence builds
  that both touch `npm test` scope.
- Greedy sims are DFS-bound (~100s/1000 board games; combat sims slower) — budget verification time.

## ➡️ Next Up
1. Verify recalibration (bands table, determinism, fixtures auditable) → close Stage 2 automatable gates.
2. Launch Stage 3: run-engine agent (src/engine/run: map/relics/economy/lifecycle), then full-run sim +
   run-UI agents in parallel (UI owns the async-storage install).
3. Stage 4 (variants + balance at scale) → Stage 5 (juice/sound/icon); Cam: TestFlight fun gate + stage
   milestones on-device (help.md).

## 🔗 Pointer
Current stage folder: `staging/stage-4-meta-and-balance/`
Active feature file: `staging/stage-4-meta-and-balance/feature-meta-variants.md`
