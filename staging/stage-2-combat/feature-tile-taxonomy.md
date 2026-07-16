# Feature: Tile Taxonomy (what tile colors mean)
_Stage: 2 — Combat · Status: verified done_

## Goal
Own and settle the central Stage 2 design decision: **what each tile color maps to** in combat — then
implement it as engine tile types. DECIDED 2026-07-15 by structured debate (see `docs/decisions.md`):
**offense-first affinity model** — R/G/B/Y are elemental damage affinities checked against per-enemy
weakness/resistance multipliers; P = Heal, the single utility color. Every cleared group (heal included)
counts toward the cascade multiplier: no combo is ever dead.

## Success Criteria
- [x] A **tile taxonomy is decided** and **recorded as a dated entry in `docs/decisions.md`**
      (chose / because / rejected / revisit if). (Done 2026-07-15 — offense-first affinity model.)
- [x] `src/engine/combat/` implements the taxonomy **data-driven**: a tile-effect table maps each color to
      its combat effect (damage-with-affinity or heal), so adding a future verb (e.g. Block) is a data
      change plus one effect handler — not an engine rewrite.
- [x] **Affinity multipliers** apply per enemy: the same cleared red group deals 2× to a red-weak enemy,
      0.5× to a red-resistant one, per the enemy's affinity table — asserted by unit fixtures.
- [x] **Heal groups heal** the player by the specified formula and **still increment the cascade
      multiplier** for the whole move — asserted by a fixture where adding a heal group increases total
      damage of the other groups.
- [x] The 5-color board's **combos/move stays in the Stage 1 healthy band**: re-run the Stage 1 sim
      (`npm run sim -- --games 1000 --bot greedy --seed 42 --moves 20`) after combat integration and
      confirm greedy avg combos/move is unchanged (3.43 ± 0.01 — combat must not perturb board behavior).

## How We'll Verify
1. `docs/decisions.md` contains the dated taxonomy entry. (Exists — 2026-07-15.)
2. `npm test`: unit fixtures assert each color's effect, affinity multiplier application (weak/normal/
   resist/immune), heal amount, and heal-groups-feed-cascade-multiplier. Hand-computed expected values.
3. `npm run sim -- --games 1000 --bot greedy --seed 42 --moves 20` → avg combos/move equals the Stage 1
   baseline (board engine untouched ⇒ byte-identical report expected).
4. `npx tsc --noEmit` exit 0; coverage on `src/engine/` stays ≥80%.

## Verification Log
### 2026-07-15 — Manager session executed the full How We'll Verify procedure — PASS
- Taxonomy decision recorded in decisions.md (offense-first affinity, 2026-07-15). Engine implements it
  data-driven: `TILE_EFFECTS` color→verb table + per-verb handlers in `src/engine/combat/effects.ts` —
  adding a verb is a data entry + one handler (exhaustive-switch enforced at compile time).
- `npm test` → 20 suites / 139 tests green, including affinity-multiplier fixtures (weak/normal/resist/
  immune), heal formula, and the heal-groups-raise-cascade-multiplier fixture (damage 25→30 when a heal
  group joins the move). `engine/combat` coverage 100/100/100/100; `npx tsc --noEmit` exit 0.
- Board-behavior gate: `npm run sim -- --games 1000 --bot greedy --seed 42 --moves 20` → avg combos/move
  **3.4309**, exactly the Stage 1 baseline (board files untouched, verified via git).
- Built by an Opus subagent; all commands independently re-run by the manager session.

## Open Questions
- Elemental flavor names for R/G/B/Y (Ember/Venom/Frost/Storm?) — cosmetic, settle in UI work.
- Whether affinity multipliers are per-enemy static or can shift mid-fight (phase shields) — keep static
  in Stage 2; phases are a Stage 3 boss question.
- Revisit trigger (from decisions.md): if Stage 3 relics find too few affinity hooks or fights feel
  one-note → add a Block tile via the data-driven effect layer.

## Notes & Decisions
- Debate synthesis adopted from the losing side: Heal as the one utility; performance-scaled gold economy
  in Stage 3 (not gold tiles); relic hooks keyed to affinities; effect layer stays data-driven for cheap
  future verbs.
- Keep tile→effect mapping in the pure engine so sim bots can play combat headlessly.
