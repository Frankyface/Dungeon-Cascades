# Feature: Enemy Encounters (definitions, telegraphed intents, turn order)
_Stage: 2 — Combat · Status: not started_

## Goal
Define enemies and how a turn plays out. Enemies are fantasy-dungeon-lite (slimes, skeletons) that
**telegraph their intent** — the player always sees what the enemy will do next before committing a move.
Turn order: player drag-move resolves fully (all cascades + combat effects), win check, then the enemy
acts on its telegraphed intent, lose check, then the next intent is telegraphed. Scope: data + flow for
single encounters, not the run layer.

## Success Criteria
- [ ] **Three enemies defined as pure engine data** with distinct affinity spreads and intent scripts:
      1. **Slime** — low HP (~30), weak to R, no resists; script: attack 6 every turn.
      2. **Skeleton** — mid HP (~55), resists R (0.5×), weak to B (2×); script: attack 8 → charge
         (telegraphs "charging") → attack 14, repeating.
      3. **Bat** — low-mid HP (~40), weak to G (2×), resists B (0.5×); script: attack 4 → heal self 5,
         alternating.
      (Exact numbers are config data the combat sim may tune within ±50%; the SHAPES are the criteria:
      one vanilla enemy, one charge-telegraph enemy, one self-healing enemy, distinct affinities.)
- [ ] **Intents are trustworthy**: the telegraphed action (type + value) is exactly what fires — asserted
      by simulating full scripted fights and checking every enemy action against its prior telegraph.
- [ ] **Turn order resolves correctly**: player move → full board+combat resolution → win check (a dead
      enemy never acts) → enemy intent fires → lose check → next telegraph. Asserted by a
      transcript-style unit test covering a full fight including the win-before-enemy-acts edge.
- [ ] **Encounter state is serializable plain data** (JSON-safe CombatState) so the UI renders it and sim
      bots consume it headlessly, mirroring the board engine's conventions.
- [ ] **Deterministic**: same seed + same move paths ⇒ identical fight transcript (enemy behavior contains
      no unseeded randomness; scripts are deterministic by construction).

## How We'll Verify
1. `npm test`: fixture fights assert (a) every fired action matches its telegraph, (b) the full turn-order
   state machine including win-before-enemy-acts and lose-on-enemy-hit edges, (c) intent script cycling
   (skeleton's charge pattern, bat's alternation), (d) transcript determinism across repeated runs.
2. `npx tsc --noEmit` exit 0; `src/engine/` coverage ≥80% maintained; grep guards stay clean (no React/RN,
   no Math.random/Date.now in `src/engine/`).
3. On-device (later, Cam): the intent shown before a move matches what the enemy does after it resolves.

## Verification Log
(empty until verification actually happens — a feature with an empty log can never be `verified done`)

## Open Questions
- Intent vocabulary beyond attack/charge/self-heal (block? debuff?) — NOT in Stage 2; the intent type
  system should be an extensible union so Stage 3 can add without rework.
- Where enemy definitions live for Stage 3's encounter pools (likely `src/engine/combat/enemies.ts` now,
  re-exported into a Stage 3 registry later) — don't design the run layer here.
- Whether enemy HP/damage numbers need a global difficulty scalar for Stage 3 elites — note only.

## Notes & Decisions
- Telegraphed intents are a locked decision (Slay the Spire-style): enemies must be readable and
  plannable, never random surprises. With static affinity tables, ALL enemy behavior in Stage 2 is fully
  deterministic — randomness lives only in board refills.
- Keep enemy logic in the pure engine (`src/engine/combat/`) so encounters sim headlessly.
