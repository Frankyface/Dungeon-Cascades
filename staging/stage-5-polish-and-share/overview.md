# Stage 5 — Polish & Share

_Status: not started (sketch only) · Folder: `staging/stage-5-polish-and-share/`_
_Gated on: Stage 4 complete (game is balanced and replayable). Feature files will be specced when Stage 4
nears completion._

## Goal
Make it feel good and get it into friends' hands. Add juice (animation/feedback polish), sound, and an art
pass over the placeholder assets, then distribute via **TestFlight** so Cam's friends and online players
can actually play it. This is the "ship it to friends" stage — the payoff for the whole project.

## Scope (from the brief; to become feature files later)
- **Juice**: satisfying feedback on matches, cascades, hits, wins/losses.
- **Sound**: SFX and any music.
- **Art pass**: replace emoji-grade placeholders with real (still lean — free game) art.
- **TestFlight distribution** to friends.

## Definition of done (rough — sharpen when specced)
- [ ] **Friends are playing it** — the game is distributed via TestFlight and real people beyond Cam are
      running it on their devices.
- [ ] Juice, sound, and an art pass are applied and the game feels finished enough to share.

## Dependencies & Notes
- **Apple Developer account required** for TestFlight. Cam may already have one from the drill-deck app —
  this is an open question tracked as a `help.md` item. Stage 1 works in Expo Go WITHOUT it; the account
  becomes a hard dependency only here.
- EAS builds (Cam's existing toolchain) will likely be needed to produce the TestFlight build — Expo Go is
  fine for dev but not for external distribution.
- Do NOT write feature files yet; sketch only.
