# Dungeon Cascades — Decision Log

This is an append-only decision ledger. Each entry records a real decision: what we
chose, why, what we rejected, and the condition that should make us revisit it. Format
per entry:

```
## <date> — <title>
**Chose:** … · **Because:** … · **Rejected:** … · **Revisit if:** …
```

Rules: future sessions **append** new decisions to the bottom; they never rewrite or
delete history. If a past decision is reversed, add a NEW dated entry that supersedes it
and explains why — the old entry stays as the record of what we once believed. The
newest applicable entry wins. Fun-gate and pivot/kill outcomes are recorded here too.

---

## 2026-07-15 — Skill philosophy
**Chose:** Cascade engineering as the primary skill, with execution (drag-path) and build strategy as amplifiers. · **Because:** It fixes the "match-3 feels lucky" problem while keeping a dynamic board that Cam wants. · **Rejected:** A perfect-information / deterministic board (kills the board dynamism Cam wants); a pure execution / twitch game (strategy must matter). · **Revisit if:** The fun gate shows cascades feel random anyway.

## 2026-07-15 — Combat move mechanic
**Chose:** Puzzle & Dragons-style drag-path matching (pick up a tile, drag it, it swaps with each tile it passes, under a move timer). · **Because:** It is the best-proven high-skill-ceiling mechanic in match-3, and it stays turn-based so strategy survives. · **Rejected:** Swap + move timer (lower skill ceiling); fully real-time (drafting stops mattering); timing-window triggers (too light). · **Revisit if:** Drag feels bad with a mouse / on smaller screens, or Skia gesture performance fails.

## 2026-07-15 — Run structure
**Chose:** Slay the Spire-style branching node-map runs (fight / elite / event / shop / rest). · **Because:** It is a proven rogue-lite frame, and route choice adds the build-strategy skill layer. · **Rejected:** Puzzle Quest-style head-to-head; Dungeon Raid-style single continuous board. · **Revisit if:** Playtests show the map layer adds friction without adding meaningful choice.

## 2026-07-15 — Platform
**Chose:** A mobile app (iOS/Android) with iPhone as the primary test device. · **Because:** Drag-path input is touch-native, and Cam tests on an iPhone. · **Rejected:** Web-first; desktop / Steam (a bigger bar, and a later destination if ever). · **Revisit if:** The touch mechanic proves to need a larger screen, or a desktop audience becomes the priority.

## 2026-07-15 — Ambition
**Chose:** A fun project / free game — lean scope, placeholder art, ship early, no monetization. · **Because:** The goal is a game Cam and friends enjoy, not a commercial product; keeping scope lean protects the schedule and keeps focus on the core. · **Rejected:** A polished commercial release; any monetization model. · **Revisit if:** The finished game turns out to have wider appeal and Cam's appetite changes.

## 2026-07-15 — Tech stack
**Chose:** Expo + TypeScript + Skia + Reanimated + Gesture Handler, with a pure headless TS engine, and Jest for tests. · **Because:** It is Cam's known toolchain; all the libraries run in Expo Go (so Stage 1 needs no custom builds); and a headless engine enables sim-based verification. · **Rejected:** Godot 4 (a new toolchain to learn); Phaser-in-Capacitor (drag feel risk in a WebView); Unity (overkill). · **Revisit if:** Skia can't hold 60fps on device.

## 2026-07-15 — v1 scope
**Chose:** IN — a branching node map, shops/events/rest, light meta-unlocks, one starting build, and a boss; run length 15–20 minutes across 8–12 encounters. · **Because:** This is the smallest complete rogue-lite loop that proves the concept. · **Rejected (parked for v2+):** Multiple builds, acts 2+, daily challenges, ascension ladders, cloud saves, monetization. · **Revisit if:** The fun gate passes and appetite changes.

## 2026-07-15 — Theme
**Chose:** Fantasy dungeon-lite (slimes, skeletons, cursed relics). · **Because:** It is instantly readable, free / placeholder assets exist everywhere, and relic/event flavor writes itself. · **Rejected:** Abstract-minimal; sci-fi. · **Revisit if:** The theme starts limiting the mechanics or a stronger hook appears.

## 2026-07-15 — Verification convention
**Chose:** Mostly automated — TDD unit tests on the engine, a sim harness for balance, and Cam plays milestone builds for feel. · **Because:** Cascade logic grows quickly and needs machine-checkable guardrails; only Cam can judge feel. · **Rejected:** A mostly-manual convention (too risky as cascade logic grows). · **Revisit if:** The automated suite stops catching the bugs that actually matter, or maintaining it costs more than it saves.

## 2026-07-15 — Top risk & defense
**Chose:** Treat "the core isn't fun" as the #1 risk, and defend against it by building Stage 1 as a naked board with an explicit kill/pivot fun gate BEFORE any rogue-lite wrapper is built. · **Because:** If the core drag-path cascade loop isn't fun, nothing built on top of it will save it — so prove that first, cheaply. · **Rejected:** Building combat / run / meta systems first and hoping the core lands. · **Revisit if:** The fun gate passes and the core is validated (the defense has done its job).

## 2026-07-15 — Name & repo
**Chose:** Working title "Dungeon Cascades", public GitHub repo Frankyface/Dungeon-Cascades. · **Because:** A working title is enough to start, and a public repo suits a free, for-fun project. · **Rejected:** Holding for a final name before starting. · **Revisit if:** A better final name is chosen (an open question), or the repo needs to change visibility.

## 2026-07-15 — Stage 1 refill RNG model (settled by structured two-agent debate)
**Chose:** Pure uniform random refill for Stage 1, implemented behind a swappable, seeded `TileSource` interface, with a sim-harness flag reserved for comparing alternative sources. · **Because:** In drag-path match-3 the engineered combos are computed from the visible board at release — refill cannot starve them, it only adds bonus skyfall, so droughts don't invalidate the core skill payout (this broke the Tetris 7-bag analogy). Uniform is also the null hypothesis: the sim harness must measure the board's true variance before any smoothing exists, or the stats measure the smoothing instead of the board; and smoothing baked in from day one could mask an unfun core at the fun gate. · **Rejected:** Bag/weighted refill as the Stage 1 default (Tetris-bag fairness argument, fun-gate insurance, tighter sim variance) — deferred, not dismissed; its interface-seam and comparison-flag demands were adopted. · **Revisit if:** Sim stats show skyfall combos rivaling engineered combos for the greedy bot, or the fun gate feels luck-dominated — then build the bag and A/B it by sim flag in Stage 2.

## 2026-07-15 — Stage 1 board defaults adopted
**Chose:** 6×5 board (6 columns × 5 rows), 5 tile colors, ~5s drag timer enforced in the UI layer (engine stays timer-agnostic), orthogonal-only drag. · **Because:** These were the documented proposed defaults (P&D-standard board); adopting them unblocks the engine build, and all are cheap constants to change. · **Rejected:** Debating each default individually before writing code. · **Revisit if:** The fun gate or sim stats argue for a different board size, timer, or diagonal drag.
