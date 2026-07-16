# Dungeon Cascades

A skill-based rogue-lite where match-3 is the combat engine — and skill is real. You
win by *engineering cascades* with Puzzle & Dragons-style drag-path moves (pick up a
tile, drag it through the grid, chain deep multi-combo turns), not by lucky refills.
Runs are structured Slay the Spire-style: a branching map of fights, elites, events,
shops and rest sites, drafted relics, and a boss — a self-contained 15–20 minute run
where losing was your fault and winning felt earned.

Fantasy dungeon-lite theme (slimes, skeletons, cursed relics). Free, built for fun, no
monetization.

## Status

Early — design / docs phase. There is **no playable build yet**; the Expo app has not
been created. Right now the repository is documentation only, driving a staged build
that starts with proving the core loop is fun before any rogue-lite wrapper is added.

## Tech

Expo + React Native + TypeScript, with a pure headless TypeScript game engine
(deterministic, seeded RNG) rendered on `@shopify/react-native-skia` and driven by
react-native-reanimated + react-native-gesture-handler. Built and tested primarily on
iPhone via Expo Go.

## Docs

Project documentation lives in [`docs/`](docs/). Start with
[`docs/master_plan.md`](docs/master_plan.md) for the full vision.
