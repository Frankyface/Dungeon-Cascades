# Feature: Enemy Encounters (definitions, telegraphed intents, turn order)
_Stage: 2 — Combat · Status: not started_

## Goal
Define enemies and how a turn plays out. Enemies are fantasy-dungeon-lite (slimes, skeletons) that
**telegraph their intent** — e.g. "attacks for X in N turns" — so the player can plan cascades against a
known threat. Establishes turn order: the player takes a drag-move, then the enemy acts on its telegraphed
intent. Scope here is data + flow for a single encounter, not the full run.

## Success Criteria
- [ ] At least one **enemy is defined** with stats (HP and an intent it can act on) as engine data.
- [ ] The enemy **telegraphs its next action** (type and value, e.g. attack for X, and when) and the
      player can see it before committing a move.
- [ ] **Turn order resolves correctly**: the player's drag-move resolves fully (all cascades), then the
      enemy acts on the telegraphed intent, then the next intent is telegraphed.
- [ ] The telegraphed intent actually **fires as telegraphed** (the shown number/effect is what happens),
      so intents are trustworthy to plan around.

## How We'll Verify
(Rougher than Stage 1 — sharpen when Stage 1 nears its fun gate.)
1. Unit tests (`npm test`): given an enemy with a scripted intent sequence, simulate turns and assert the
   enemy acts exactly as telegraphed, in the correct order relative to the player's move.
2. On-device (Expo Go, iPhone): play a turn and confirm the intent shown before your move matches what the
   enemy does after your move resolves.

## Verification Log
(empty until verification actually happens — a feature with an empty log can never be `verified done`)

## Open Questions
- Enemy roster size and variety for a first vertical slice (how many distinct enemies before it's worth
  testing on-device).
- Intent vocabulary: attack only, or also block/buff/status — keep minimal for Stage 2, expand later.
- How intents scale/telegraph across multiple turns (fixed script vs simple AI) — start scripted.
- Where enemy definitions live relative to the Stage 3 run/encounter system (avoid designing the run layer
  here).

## Notes & Decisions
- Telegraphed intents are a locked run-structure decision (Slay the Spire-style) from `docs/decisions.md`
  (2026-07-15) — enemies must be readable and plannable, never random surprises.
- Keep enemy logic in the pure engine (`src/engine/combat/`) so encounters can be sim-tested headlessly.
