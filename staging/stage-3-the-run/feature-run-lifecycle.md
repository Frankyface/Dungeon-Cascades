# Feature: Run Lifecycle (run state, boss, save/load, death & victory, full-run sim)
_Stage: 3 — The Run · Status: awaiting verification (ALL automated gates passed; Cam's on-device run remains)_

## Goal
Stitch map + combat + relics + economy into one complete, persistent run: start → route through the map →
fights/elites with the difficulty ramp → the boss → victory; or death anywhere → run over. RunState
serializes to local storage (async-storage behind an injected port — the engine stays pure) and resumes
after an app restart. The full-run headless sim is this feature's automated proof AND the project's
Stage 4 balance instrument.

## Success Criteria
- [ ] **RunState** is one serializable plain-data object (map + position, player HP, gold, relics, RNG
      states, current encounter if mid-fight) — the single save unit. JSON round-trip is lossless.
- [ ] **Boss encounter** exists as data: ~120 HP (config, ramp-scaled), a multi-phase scripted intent
      cycle meaningfully harder than normals (e.g. charge patterns + a scripted affinity-shift phase via
      the data-driven effect layer); beating it ends the run in **victory**.
- [ ] **Death ends the run**: player HP ≤ 0 in any encounter produces a terminal defeated RunState;
      further actions rejected; the save is cleared (rogue-lite — no retry from save).
- [ ] **Save/load**: saving on every node completion via the storage port; a mid-run save loaded back
      produces an IDENTICAL continuation (transcript equality fixture: play A→save→load→play B equals
      playing A→B straight through). An in-memory port implementation makes this fully unit-testable; the
      async-storage adapter is thin UI-side wiring.
- [ ] **Full-run sim** (extends the harness; the stage's headline evidence):
      `npm run sim -- --mode run --bot policy --games 1000 --seed 42` where the policy bot = greedy-combat
      in fights + a documented routing/draft/shop heuristic. Gates:
      • 1000 seeded runs complete with **zero crashes/wedges** (every run terminates in victory or death);
      • **policy-bot win rate lands in 25–75%** (jeopardy is real in both directions; constants tunable);
      • encounters per completed run within **8–12**; median total moves per run within a 30–90 band
        (proxy for the 15–20 min target at human pace);
      • report byte-deterministic (same flags twice ⇒ identical stdout).
- [ ] Cam can **complete a real 15–20 minute run start to finish on-device** (map → fights → draft → shop
      /event/rest → boss), and death/victory both behave. (Human gate — stays unticked until Cam plays.)

## How We'll Verify
1. `npm test`: RunState round-trip, save/load transcript-equality, death/victory terminal fixtures, boss
   phase-cycle fixtures. Coverage ≥80%, tsc clean, purity greps clean (storage port keeps async-storage
   OUT of `src/engine/`).
2. The full-run sim commands above, run twice for the determinism diff; stats pasted into this log.
3. Stage 1 + Stage 2 sim baselines still reproduce (no regression in board or single-encounter behavior).
4. On-device (Cam): one full run to victory or honest death; save/resume by killing and reopening the app
   mid-run.

## Verification Log
### 2026-07-15 — Engine portion verified (manager re-ran gates) — sim CLI gates + Cam's run remain
- RunState lossless round-trip; save→load→continue ≡ straight-through (transcript equality); terminal
  states reject actions; save cleared on any terminal. Boss "Bone Colossus": 3 HP-phase scripts with an
  affinity SHIFT (R-weak → R-resist/B-weak → Y-weak), 120→185 HP by floor, max hit 26. Elite/difficulty
  scaling dampened (hp ×(1+(diff−1)·0.2), atk ×(1+(diff−1)·0.15); elite ×1.3/×1.2). Floor-0 always intro
  slime. 20-seed full-run batch: zero wedges, both victory and defeat observed; greedy policy ≈34% win
  over 100 seeds (inside 25–75% band, pre-CLI). Combat seam extended minimally (optional CombatState.enemy
  override for phase shifts) — combat suite unmodified, baselines byte-identical.
- REMAINING: the full-run sim CLI gates (1000 runs, determinism diff — next agent) and Cam's on-device run.

### 2026-07-15 — Full-run sim gates ALL PASS (manager spot-verified) — only Cam's on-device run remains
- `npm run sim -- --mode run --bot policy --games 1000 --seed 42`: **38.8% win rate, 0 wedges/1000**,
  boss-reached 48.6%, encounters/victory-run median 11 (9–11 ⊆ 8–12), moves median 57 (∈30–90). Deaths
  peak floors 1–2 and the boss floor — healthy difficulty shape. Trivial policy 0.0% (skill floor holds).
  Byte-deterministic (1000-run diff empty; manager re-diffed at 200 games: identical, 43.0% in band).
- NO run-layer tuning needed — default configs passed as-built. 51 suites / 415 tests green; tsc clean;
  coverage ≥80% both required metrics; Stage 1+2 baselines byte-identical.
- Policy heuristic: HP-fraction routing (hurt→rest-first / healthy→elite-first / mid→fight-first),
  combat via the shipped greedyComboPath, draft/shop/event via the engine's stepRun preferences.

## Open Questions
- Boss identity/flavor (Bone Colossus?) and whether its affinity-shift phase reads clearly in the UI.
- Policy-bot heuristic quality: it only needs to be a consistent measuring stick, not a good player — but
  if its win rate is degenerate (0% or 100%) tuning attributes to constants vs bot must be diagnosed.
- Auto-save frequency: per node vs also mid-combat (per node for v1; mid-combat death = that fight is lost
  on resume — acceptable rogue-lite strictness? Flag to Cam at the milestone).

## Notes & Decisions
- The full-run sim is deliberately built HERE (not Stage 4) so Stage 3 lands with its own evidence;
  Stage 4 scales it (more seeds, more policies, balance report) rather than inventing it.
- All seeds derive from one run seed via the established deriveSeed tree: a run is one number → fully
  reproducible map, encounters, refills, drafts, shops, events.
