# Feature: Relics & Drafting (build strategy layer)
_Stage: 3 — The Run · Status: not started_

## Goal
Relics are the build-strategy amplifier: data-driven passive modifiers drafted pick-1-of-3 after fights
and elites, shaping how the player wants the board to work (affinity-keyed per the taxonomy decision).
The relic ENGINE (typed trigger hooks) matters more than any individual relic — individual relics are
data. Lives in `src/engine/run/` + hooks into `src/engine/combat/`.

## Success Criteria
- [ ] A **typed relic-hook system** exists: relic effects declare hooks (at minimum `onDamageComputed`,
      `onHealComputed`, `onCombatStart`, `onTurnStart`, `onGoldEarned`) that pure functions apply in a
      DEFINED, documented order — deterministic given the relic list. Adding a relic = adding data, not
      engine code.
- [ ] A **v1 roster of ~12 relics** exists as data, covering at least: 4 affinity-keyed damage modifiers
      (one per color), 1 heal-scaling, 1 cascade-multiplier modifier, 1 economy relic, 1 defensive-ish
      relic (e.g. flat damage reduction — NOT a block tile), and 2+ with combat-start effects. Each has
      name + fantasy-lite flavor + effect data.
- [ ] **Stacking and ordering are lawful**: multiple relics touching the same value compose in the
      documented order (additive-then-multiplicative or as specified); asserted by fixtures with 2–3
      stacked relics against hand-computed outcomes.
- [ ] **Draft flow**: after fight/elite victories, `draftOptions(runState) → 3 distinct relics` drawn
      seeded from the unowned pool (elite drafts pull from a better-weighted pool); `applyDraft` adds the
      pick to RunState; duplicates never offered; pool exhaustion handled gracefully.
- [ ] **Relic effects actually change combat outcomes**: an integration fixture runs the same encounter
      seed with and without a damage relic and asserts the with-relic transcript deals exactly the
      modified damage.

## How We'll Verify
1. `npm test`: hook-order fixtures, stacking fixtures (hand-computed), draft determinism + no-duplicate
   property tests, the with/without-relic integration fixture. Coverage ≥80%, tsc clean, purity greps clean.
2. Full-run sim (feature-run-lifecycle) runs with drafting enabled — relic acquisition must not break
   determinism (same run seed + same choices ⇒ identical transcript).

## Verification Log
(empty until verification actually happens — a feature with an empty log can never be `verified done`)

## Open Questions
- The exact 12 relics (agent proposes the roster at build time; balance is sim + Cam territory).
- Whether relics may modify BOARD behavior (tile spawn weights, timer) in v1 or stay combat-side only —
  keep combat-side for v1 unless trivially clean; board-side relics are a strong v2 lever.
- Relic rarity tiers in v1: keep two (common / elite-weighted) not three.

## Notes & Decisions
- Affinity-keyed relic hooks are the taxonomy debate's Stage 3 payoff — if they prove thin here, the
  taxonomy decision's revisit trigger (add a Block tile) fires.
- Hooks must be pure and serializable-friendly: RunState carries relic IDs; effects derive from data.
