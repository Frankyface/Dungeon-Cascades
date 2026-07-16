# Dungeon Cascades — Master Plan

> This document is the complete vision for Dungeon Cascades, written so that a
> brand-new Claude session with zero prior context can understand the entire
> project from this file alone. Working title. Today's baseline date: 2026-07-15.

## Pitch

"A 15-minute rogue-lite run where losing was your fault and winning felt earned."

## Problem & Why

Slay the Spire-style rogue-lites reward reading the board and building a plan, but
normal match-3 games feel luck-driven — you win because the refills fell your way.
Dungeon Cascades exists to fix that: match-3 is the combat engine, and skill is
real. You win by *engineering cascades* with deliberate drag-path moves, not by
lucky refills. The refills stay random (a dynamic board is a deliberate design
choice), but the multi-combo structures you build on top of them are yours to
construct. The soul of the game is this skill pillar:

- **Primary — cascade engineering:** the best players read the board deeper and
  deliberately construct multi-combo turns. Cascades are engineered, not windfalls.
- **Amplifier — execution:** Puzzle & Dragons-style *drag-path* moves. Expert
  hands turn a good plan into 6+ combos in one move.
- **Amplifier — build strategy:** drafted relics and route choices shape how you
  want the board to work.

Explicitly rejected as skill models: a perfect-information / deterministic board
(it would kill the board dynamism Cam wants), and pure-twitch real-time play
(strategy must survive).

## Target users & use cases

Cam and their friends / online players who like Slay the Spire-style runs but find
normal match-3 too luck-driven. It is a free game, built for fun. There is no
monetization in current plans — ever. The core use case: sit down, play one
self-contained 15–20 minute run, and feel that the outcome was earned.

## v1 scope

**IN (v1):**
- One starting build ("the Adventurer" — name is a placeholder)
- Drag-path, turn-based match-3 combat
- Telegraphed enemy intents (attack in N turns, etc.); turn order: your drag-move, then enemy acts
- Branching node map: fight / elite / event / shop / rest
- Shops, events, and rest sites
- Draft a reward (relic / upgrade) after fights
- A boss; death ends the run (rogue-lite)
- Winnable runs of 15–20 minutes, 8–12 encounters
- Light meta-progression (unlocks add variety, not raw power)
- Fantasy dungeon-lite theme (slimes, skeletons, cursed relics); placeholder / emoji-grade art is fine early

**OUT — explicit non-goals, parked for v2+:**
- Multiple characters / loadouts
- Acts 2 and beyond
- Daily challenges
- Ascension-style difficulty ladders
- Cloud saves
- Monetization
- Polished art
- Android-first testing (the app should run on Android, but iPhone is the proof device for v1)

## Future roadmap (6–12 months — possibilities, not commitments)

These are honest post-v1 directions to keep in mind, none of them promised. They
become real only if the fun gate passes and appetite is there:

- **Multiple characters / builds** beyond the single Adventurer, each changing how
  you want the board to work.
- **Act 2 and beyond** — more encounters, new enemy tiers, a longer campaign arc.
- **Daily seeded challenges** — everyone plays the same seed and compares results
  (the seeded, deterministic engine makes this natural).
- **First-class Android release** — the app already targets Android; this would
  promote it from "runs on Android" to a tested, shipped Android build.
- **Bag / weighted refill systems** as a deeper pro-skill lever (currently an open question).

All of the above are speculative. v1 ships small first.

## Tech stack & key decisions

Each choice is one line of *why*; the full reasoning, alternatives, and revisit
conditions live in [docs/decisions.md](decisions.md).

- **Expo + React Native + TypeScript** — Cam's existing toolchain (their drill-deck
  app uses Expo + EAS builds); the tooling stays boring so design gets the attention.
- **@shopify/react-native-skia + react-native-reanimated + react-native-gesture-handler**
  — 60fps canvas board and drag input without adopting a game engine; all three run
  in Expo Go, so Stage 1 needs no custom native builds.
- **Pure TypeScript game engine with zero React / RN imports** (`src/engine/`) —
  headless and deterministic (seeded RNG throughout), which is what makes the
  automated verification convention possible.
- **Jest** (ts-jest) — unit tests with a ≥80% coverage target on `src/engine/`.
- **Local device storage only** (async-storage or MMKV — open question) — saves and
  meta-progression; no backend.
- **Rejected:** Godot 4 (a new toolchain to learn), Phaser-in-Capacitor (drag feel
  risk in a WebView), Unity (overkill for this).

### Verification convention (Cam chose "mostly automated")

1. All engine / combat / run logic: unit tests, TDD, ≥80% coverage on `src/engine/`.
2. Balance & correctness at scale: a simulation harness — headless bots play
   hundreds/thousands of seeded runs; stats reports (combos/move, cascade
   distribution, win rates) are the evidence.
3. Game FEEL: only Cam can judge — milestone builds run on Cam's iPhone (Expo Go in
   Stage 1). Claude never declares feel "done".
4. Feature status state machine (only path): `not started → in progress → awaiting
   verification → verified done`. `verified done` REQUIRES a dated Verification Log
   entry with real evidence. No exceptions.

Truth hierarchy when docs and reality conflict: actual code / system state >
`handoff.md` > stage files > `docs/master_plan.md`. Reality wins — fix the docs.

## Architecture sketch

```
src/
├── engine/          # PURE TS, no React/RN imports. Deterministic, seeded RNG throughout.
│   ├── board/       # grid state, tile spawn, drag-path move resolution, match detection, cascade/combo resolution
│   ├── combat/      # (Stage 2) tile→action mapping, enemy intents, damage/block math
│   ├── run/         # (Stage 3) node-map generation, drafting, economy, run save state
│   └── sim/         # headless bot players + stats harness
├── ui/              # React Native
│   ├── board/       # Skia canvas renderer + gesture drag handling
│   └── screens/     # menus, map, combat, results (plain RN)
└── state/           # thin store bridging engine ↔ UI (zustand — open question)
```

The engine is pure and headless on purpose: with zero React / RN imports and seeded,
deterministic RNG throughout, the same seed and the same drag path always produce the
same result. That determinism is the foundation for everything — unit tests can assert
exact outcomes against hand-computed fixtures, and the sim harness can run thousands of
reproducible headless games to measure balance without ever rendering a frame. The UI
layer stays a thin renderer over engine state, so game logic can be verified long before
(and independently of) how it looks or feels on device. Status note (updated
2026-07-16): the Expo app now exists — the `src/engine/{board,combat,run,sim}` modules
and the `app/` expo-router screens (menu, board sandbox, combat, and the full run flow)
are built through Stage 3. `src/state/` was left unused: no external store proved
necessary, so state bridges engine↔UI with plain React.

## Staged roadmap

Progressive detail rule: Stage 1 is fully specified, Stage 2 moderately specified,
Stages 3–5 are overview-only sketches.

Status column current as of 2026-07-16 (reality > this table; see `handoff.md` and the
stage `overview.md` files for the live detail).

| # | Folder | Goal | Headline | Definition of done (rough) | Status (2026-07-16) |
|---|--------|------|----------|----------------------------|---------------------|
| 1 | `staging/stage-1-naked-board/` | Prove the core is fun BEFORE any rogue-lite wrapper | Drag-path match-3 engine on Skia, 60fps on Cam's iPhone | Engine unit-tested & deterministic; sim bots play 1000 headless games; Cam plays on-device; **FUN GATE decision recorded** | Built (engine + sims verified done); **awaiting Cam's fun gate on-device via TestFlight** |
| 2 | `staging/stage-2-combat/` | Make matching mean something | Tile types → actions, enemies with telegraphed intents, win/lose | Beat a scripted encounter on-device; combat math unit-tested | Built + sim-verified (taxonomy, 3 enemies, combat math, balance bands); **awaiting Cam's on-device win** |
| 3 | `staging/stage-3-the-run/` | The full rogue-lite loop | Node map, drafting, shop/event/rest, boss, death & victory | Complete a real 15–20 min run start to finish | Built + sim-verified (13-floor map, ~12 relics, shop/event/rest, 3-phase boss, save/resume; 1000-run sim passed); **awaiting Cam's on-device full run** |
| 4 | `staging/stage-4-meta-and-balance/` | Make it KEEP being fun | Meta-unlocks + simulation harness at scale | Balance report from sims; unlocks persist between runs | **In progress** — shape decided (starting variants, ±5pp purity band); building now |
| 5 | `staging/stage-5-polish-and-share/` | Make it feel good, get it to friends | Juice, sound, art pass, TestFlight | Friends are playing it | **On hold** — autonomous build stops after Stage 4; starts when Cam supplies sound/art assets (decisions.md 2026-07-15) |

## Open questions & risks

### Open questions (do not resolve these unilaterally — record and settle when the owning stage arrives)

**Resolved as their owning stage arrived** (full reasoning in `docs/decisions.md`):

- **Board size:** ✓ 6×5 (decisions.md "Stage 1 board defaults adopted", 2026-07-15).
- **Drag timer length:** ✓ ~5s, enforced in the UI layer (engine stays timer-agnostic)
  (decisions.md "Stage 1 board defaults adopted").
- **Refill RNG:** ✓ pure uniform random behind a swappable, seeded `TileSource`
  interface, with a sim flag reserved to A/B a bag later (decisions.md "Stage 1 refill
  RNG model"). The bag is deferred, not dismissed.
- **Tile taxonomy:** ✓ offense-first affinity model — four elemental damage colors
  (R/G/B/Y vs per-enemy weakness/resist) + P = Heal; every cleared group counts toward
  the cascade multiplier (decisions.md "Tile taxonomy: offense-first affinity model").
- **Combo → damage scaling curve:** ✓ decided, then recalibrated after first sim
  contact (ATTACK_BASE 10→~3, enemy HP scaled up) (decisions.md "Combat math defaults"
  + "Combat recalibration").
- **Meta-progression purity:** ✓ power-neutral **starting variants** (sidegrades)
  unlocked by cumulative-score tranches, each held within ±5pp of vanilla win rate by a
  hard sim band (decisions.md "Meta-progression shape").
- **Storage:** ✓ async-storage behind an injected persistence port, so the engine stays
  pure (decisions.md "Stage 3 structural defaults"). **State lib:** no external store
  proved necessary — `src/state/` is unused and state bridges engine↔UI with plain
  React (zustand not adopted).

**Still genuinely open:**

- **Diagonal drag:** v1 is orthogonal-only — revisit at the fun gate.
- **Apple Developer account status** — Cam may already have one from drill-deck; a hard
  dependency only for TestFlight in Stage 5. Dev works in Expo Go without it. Tracked in
  `help.md`.
- **Final game name** — working title "Dungeon Cascades" is fine for now.
- **Route richness (Stage 3)** — the map uses one node-role per floor, so every route
  crosses the same node-type sequence (route choice picks the instance, not the type
  mix). If runs feel flat on-device, move the generator to mixed-type rows (StS-style).
  Flagged in `staging/stage-3-the-run/feature-node-map.md`; revisit at the Stage 3
  on-device milestone.

### Top risk & its defense

**"The core isn't fun"** is Cam's named #1 risk. Defense: Stage 1 builds the **naked
board** — the drag-path match-3 engine and renderer — *before* any rogue-lite wrapper,
and ends in an explicit **kill / pivot / continue fun gate**. Cam plays it on-device
and decides continue / pivot / kill, and that decision is recorded in
[docs/decisions.md](decisions.md). No combat, run, or meta work begins until the fun
gate passes.

## Glossary

- **Drag-path move:** the core input. You pick up one tile and drag it through the
  grid; it swaps positions with each tile it passes. A timer (~5s default, tunable)
  limits how long the path can be once the held tile first moves. Release or timeout
  ends the move. This is the Puzzle & Dragons-style mechanic that gives the game its
  high skill ceiling.
- **Cascade:** what happens after matches clear. Gravity drops the surviving tiles,
  new tiles spawn from the top (via seeded RNG), and any new match-3+ lines that form
  clear too — the chain continues, each continuation adding combos. Engineering deep
  cascades is the primary skill.
- **Combo:** each distinct cleared group (a row/column of ≥3 same-color tiles) counts
  as +1 combo. A single drag-path move can trigger many combos across multiple cascade
  steps. Combo count drives power (a damage multiplier in combat; exact scaling is a
  Stage 2 design question).
- **Fun gate:** the explicit kill / pivot / continue checkpoint at the end of Stage 1.
  Cam plays the naked board on-device and decides whether the core is fun enough to
  continue, needs a pivot, or should be killed. The decision is recorded in decisions.md.
- **Node map:** the branching map of a run, made of nodes typed fight / elite / event /
  shop / rest. Choosing your route through it is real strategy (Slay the Spire-style).
- **Relic:** a drafted reward or upgrade earned after fights that shapes how you want
  the board to work. Relics are the "build strategy" amplifier of the skill pillar.
- **Meta-progression:** light, persistent unlocks between runs. The purity principle:
  unlocks add VARIETY, not raw power, so the game stays skill-driven (concrete design
  is an open Stage 4 question).
- **Seeded RNG:** deterministic random number generation driven by a seed. The same
  seed produces the same tile spawns and refills every time, which makes runs
  reproducible — the basis for unit tests and the sim harness.
- **Sim harness:** headless bot players (e.g. random-path and greedy bots) plus a stats
  CLI. It runs N seeded games with no rendering and reports metrics (avg combos/move,
  cascade-depth distribution, resolution time, win rates) as the evidence for
  determinism and balance.
