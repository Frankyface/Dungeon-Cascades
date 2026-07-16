# Handoff — Dungeon Cascades
_Last updated: 2026-07-16 · Current stage: stage-4-meta-and-balance (closing) · Stage 5 on hold for Cam's assets_

## 🎯 Goals
Finish the tail of Stage 4 (tonight's purity matrix), land the compendium, attempt the iOS build, then
stop — the project waits on Cam's on-device verdicts and Stage 5 assets.

## 📍 Current State
- Stages 1–3: built + machine-verified; awaiting Cam's on-device gates (fun gate, beat-a-fight, full run).
- Stage 4: built + verified except the ≥2000-game purity matrix (N=1000: all 6 variants PASS, worst 2.1pp).
  Variant picker (/start), score banking, meta persistence all live.
- Boss telegraph HIGH bug FIXED (bossFairness.test.ts guards it); both adversarial reviews closed out.
- Suite: 59 suites / 517 tests green · tsc clean · iOS export clean · baselines byte-identical.
- In flight: compendium agent (relics/enemies/boss encyclopedia + New-run→/start fix).

## 📂 Files I'm Working On
- `src/ui/compendium/` + `app/compendium.tsx` — compendium agent (in flight).
- `staging/stage-4-meta-and-balance/feature-meta-variants.md` — holds tonight's matrix command.

## ✅ Things I've Changed
- 2026-07-16 — Variant-select flow, meta banking (once-guarded), meta persistence adapter; 517 tests.
- 2026-07-16 — Boss telegraph fairness fix + cascade cap (Fable agent, TDD, baselines unchanged).
- 2026-07-16 — Stage 4 engine/sim: variants, meta tranches, --mode report; N=1000 purity all-PASS.
- 2026-07-16 — UI review fixes: double-tap crash, hydrate race, scrollable combat, reducer guards.
- 2026-07-16 — README + master plan refreshed to reality.

## ❌ Watch Out
- Bots don't read telegraphs — telegraph-contract bugs are invisible to sims; bossFairness.test.ts is the
  pattern for human-facing contract tests.
- The ≥2000 purity matrix was killed twice by host restarts — run it in a stable window (~160 min total).
- Combat fixtures pin constants (decisions.md "Combat recalibration") — recompute by hand if tuning.

## ➡️ Next Up
1. TONIGHT (Cam or any session): the purity matrix — command in feature-meta-variants.md; paste the
   table into that log, flip the two [~] DoD boxes if PASS.
2. Verify compendium agent → commit → attempt `eas build -p ios` via Cam's existing session (never enter
   credentials; if Apple auth missing, hand Cam the command).
3. Cam on-device: fun gate + beat-a-fight + full run + restart-persistence (help.md has procedures).
4. Stage 5 when Cam's sounds/graphics arrive (shopping list in help.md).

## 🔗 Pointer
Current stage folder: `staging/stage-4-meta-and-balance/`
Active feature file: `staging/stage-4-meta-and-balance/feature-meta-variants.md`
