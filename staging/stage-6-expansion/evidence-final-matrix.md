# Stage 6 — Final Purity/Balance Matrix Evidence (2026-07-17)

Command (run twice, stdout diffed): `npm run sim -- --mode report --seed 42` (default 2000 games/config,
policy bot, fresh meta = base-12 relic pool). **Both passes BYTE-IDENTICAL.**

## §9 gate verdicts — ALL PASS

| Gate | Result | Verdict |
|---|---|---|
| Determinism (2000×8×2 passes) | byte-identical diff | ✅ PASS |
| Vanilla win rate 20–60% | **48.9%** | ✅ PASS |
| Role purity ±5pp vs vanilla | cartographer −3.0 · ember-start −1.6 · merchants-purse −2.8 · vitality-pact +2.6 · ironhide +1.3 · glass-cannon +1.4 | ✅ ALL PASS |
| Biome fairness ≤10pp spread (act-2, vanilla) | **8.3pp** | ✅ PASS |

Notes:
- N=2000 sampling error ≈ ±1.1pp at these rates; the worst role delta (3.0pp) is comfortably in-band.
- God of War is band-EXEMPT by owner decision (decisions.md); prior measurement 60.2% (+21.4pp at N=1000).
- Expansion relics show 0 draft picks in this matrix BY DESIGN (fresh meta = locked pool; the matrix
  measures the out-of-box experience). Unlocked-pool behavior is covered by the boss-rush/dev-pool sims
  and the relic audit's liveness trace.
- Earlier same-day evidence at 1000 games: fairness 3.5–3.7pp (per-biome table in the balance-wave report);
  the 8.3pp here is the 2000-game vanilla-only read — both inside the band.
- Regenerate anytime with the command above; the fairness verdict line is part of the report output.

Full report artifacts: scratchpad matrix_A.txt/matrix_B.txt (session-local); the report is fully
reproducible from the committed code + seed.
