# Feature: Economy & Non-Combat Nodes (gold, shop, events, rest)
_Stage: 3 — The Run · Status: verified done_

## Goal
The non-combat nodes that make routing meaningful. Gold is **performance-scaled** (the taxonomy debate's
"skill-earned economy" concession): fighting well literally pays better. Shops convert gold to relics/
healing, rest sites heal, events are scripted risk/reward choices. All pure engine data + logic in
`src/engine/run/`.

## Success Criteria
- [x] **Performance-scaled gold**: fight rewards = base + bonus scaled by turns-to-win (faster than the
      config median pays more) + bonus for HP retained; elites pay a multiplier. Hand-computed fixtures
      for fast/slow/hurt/clean wins. Constants in config, sim-tunable.
- [x] **Shop**: seeded stock (2–3 relics from the unowned pool + 1 heal item), config prices; buying
      deducts gold, grants the item, removes the slot; insufficient gold rejected; leaving is always
      legal. Serializable ShopState.
- [x] **Rest**: heals 30% max HP (config), capped at max; single-use per node; state transitions asserted.
- [x] **Events**: ~6 scripted events as data, each 2–3 choices with deterministic outcomes (gold gain/loss,
      HP gain/loss, relic gain, mixed gambles resolved by seeded roll). Every event choice is a fixture:
      known state + choice ⇒ exact outcome. Event draws per node are seeded and deterministic.
- [x] **No dead economy states**: property test — whatever the gold/HP state, every node always offers at
      least one legal action (leave/skip counts), so a run can never wedge in a non-combat node.

## How We'll Verify
1. `npm test`: reward fixtures, shop/rest/event state-machine fixtures, the no-wedge property test,
   determinism repeats. Coverage ≥80%, tsc clean, purity greps clean.
2. Full-run sim: economy paths exercised across thousands of runs (bots buy greedily / never buy as two
   policies); zero wedges or negative-gold states tolerated.

## Verification Log
### 2026-07-15 — Manager re-verified all gates — PASS
- Performance-scaled gold live (base 10 + speed bonus 8×clamp((6−turns)/5) + HP bonus 6×fraction, elite ×2,
  onGoldEarned hook; fixtures: fast-clean 24, slow-hurt 13, elite 48, Miser's Knuckle 24→30). Shop (seeded
  stock, buy/reject/leave), rest (30% heal, single-use), 6 scripted events (every choice + both gamble
  branches fixture-tested; leave always legal; events never kill — HP floors at 1). No-wedge property test
  passes. 361 tests / 44 suites green; tsc clean; coverage ≥80%; Stage 1+2 baselines byte-identical.

## Open Questions
- Exact gold constants and prices (sim brackets them; Cam's on-device runs judge whether shops feel
  affordable-but-not-trivial).
- Event flavor/writing quality — placeholder text acceptable for the milestone; a writing pass is Stage 5.
- Whether the heal item is instant-use at purchase or pocketed — keep instant for v1 simplicity.

## Notes & Decisions
- Locked context: performance-scaled gold replaces gold TILES (taxonomy decision) — the economy rewards
  combat skill without diluting the board.
- Seeded event/shop draws derive from the run seed tree so full runs stay reproducible.
