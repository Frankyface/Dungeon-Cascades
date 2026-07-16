/**
 * UI-only timing/layout knobs for the combat screen — the beats between the two
 * turn animation phases and the panel HP-bar animation duration. Combat RULES and
 * numbers live in the engine (`src/engine/combat/config.ts`); these are purely how
 * long the screen lingers on each readable moment, tunable on-device by Cam.
 */

/** How long the "player move landed" beat holds (damage/heal callout visible). */
export const IMPACT_BEAT_MS = 650;

/** How long the "enemy acts" beat holds (enemy intent firing on the player). */
export const ENEMY_BEAT_MS = 650;

/** HP bar fill animation duration when a bar's value changes. */
export const HP_ANIM_MS = 320;
