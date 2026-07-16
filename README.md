# Dungeon Cascades

A skill-based rogue-lite where match-3 **is** the combat engine — and skill is real.
You win by *engineering cascades* with Puzzle & Dragons-style drag-path moves (pick up
a tile, drag it through the grid, chain deep multi-combo turns), not by lucky refills.
Runs are structured Slay the Spire-style: a branching map of fights, elites, events,
shops and rest sites, drafted relics, and a boss — a self-contained 15–20 minute run.

The core skill is **cascade engineering**: reading the board and deliberately
constructing multi-combo turns. Drag-path execution and drafted relics amplify it;
nothing rewards pure luck. Fantasy dungeon-lite theme (slimes, skeletons, cursed
relics). Free, built for fun, no monetization.

## What's playable now

Runs in **Expo Go** on iPhone — no custom native build needed:

- **Naked board sandbox** — the drag-path match-3 board on its own.
- **Three combat encounters** — slime, skeleton and bat, each with a telegraphed
  intent and tile-affinity damage.
- **Full rogue-lite runs** — a 13-floor branching node map, pick-1-of-3 relic
  drafting, shops / events / rest sites, a 3-phase boss, and death / victory with
  mid-run save & resume.

TestFlight is configured (bundle id + EAS build/submit profiles) for external
distribution once the art pass lands.

## Balance (sim-verified)

The game engine is pure, headless TypeScript with deterministic, seeded RNG, so
headless bots can play thousands of reproducible games. A greedy bot averages **~9.7×**
the combos-per-move of a random bot (3.43 vs 0.35) — evidence the board rewards skill,
not luck. 1000-run balance sims back each layer: single-encounter and full-run win
rates land inside their target bands, with byte-identical reports across identical
runs. (Whether it's *fun* on-device is Cam's call and has not yet been made.)

## Tech

Expo + React Native + TypeScript, with a pure headless TS game engine (`src/engine/`,
zero React/RN imports) rendered on @shopify/react-native-skia and driven by
react-native-reanimated + react-native-gesture-handler. Jest (ts-jest) for unit tests;
a headless sim harness for balance. Local device storage only (async-storage) — no
backend.

## Run it

```
npm install
npx expo start          # open in Expo Go on iPhone
npm test                # Jest unit tests
npm run sim -- --help   # headless balance & determinism harness
```

Sim examples:

```
npm run sim -- --games 1000 --bot greedy --seed 42       # Stage 1: board
npm run sim -- --mode combat --enemy slime --games 500   # Stage 2: one fight
npm run sim -- --mode run --bot policy --games 1000       # Stage 3: full runs
```

## Status

Stages 1–3 are built and machine-verified (engine unit tests + 1000-run sims). Stage 4
(meta-progression + balance at scale) is in progress. On-device human verification —
the Stage 1 fun gate and full-run play — is still pending, and art & sound are
placeholder pending an asset pass. Internal design docs and the staged roadmap live in
[`docs/`](docs/) — start with [`docs/master_plan.md`](docs/master_plan.md).
