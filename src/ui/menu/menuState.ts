/**
 * Pure view-state for the menu's "The Run" section.
 *
 * The section MUST NOT be interactive until the saved run has been hydrated from disk: on a cold
 * start `hasSave` is unknown, and a tap on "Start a run" that fires before hydration resolves would
 * stage + save a fresh run OVER the still-unread save — silent data loss. Modeling the gate as a
 * pure function keeps that safety rule testable without React or native storage.
 *
 * No React / React Native / storage imports — this file is Jest-testable in the node environment.
 */
export type MenuHydration = 'loading' | 'ready';

/** Which variant of the run section to render. `loading` is deliberately non-interactive. */
export type RunSection =
  | { readonly kind: 'loading' } // hydration in flight — show a non-interactive placeholder
  | { readonly kind: 'start' } // hydrated, no save — offer "Start a run"
  | { readonly kind: 'resume' }; // hydrated, save present — offer Continue / Abandon / Start-new

/**
 * Decide which run-section variant to render from the hydration state and whether a save exists.
 * While hydration is `loading`, the result is always the non-interactive `loading` placeholder,
 * regardless of `hasSave` — that is the guard preventing a premature save-clobbering tap.
 */
export function runSection(hydration: MenuHydration, hasSave: boolean): RunSection {
  if (hydration === 'loading') {
    return { kind: 'loading' };
  }
  return hasSave ? { kind: 'resume' } : { kind: 'start' };
}

/**
 * Combined menu hydration (Stage 4): the run section stays `loading` until BOTH the run store AND
 * the meta store are hydrated. The run store guards against clobbering an unread save; the meta
 * store guards against starting a run (and later banking it) before the saved profile is adopted —
 * which would show the wrong unlocked variants and bank onto a blank total. Ready needs both.
 */
export function menuHydration(runHydrated: boolean, metaHydrated: boolean): MenuHydration {
  return runHydrated && metaHydrated ? 'ready' : 'loading';
}
