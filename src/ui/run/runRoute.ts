/**
 * The run-screen NAVIGATION state machine: a pure map from the run's current phase to the
 * expo-router path that should be showing. The provider re-routes after every action by
 * asking this function, so the run's phase — not the nav stack — is the single source of
 * truth for "which screen". No React imports; deterministic and unit-tested.
 */
import type { RunState } from '../../engine/run';

/** Every route a run can be showing. */
export type RunRoute =
  | '/run'
  | '/run/encounter'
  | '/run/draft'
  | '/run/shop'
  | '/run/event'
  | '/run/rest'
  | '/run/altar'
  | '/run/transition'
  | '/run/victory'
  | '/run/defeat';

/**
 * The route for a run state. The map (`/run`) shows both the initial "enter the current node"
 * step (awaiting_node) and the between-nodes "pick the next node" step (awaiting_move). Each
 * interactive phase maps to its screen; a terminal run maps to victory or defeat by status.
 */
export function routeForRunState(state: RunState): RunRoute {
  const phase = state.phase;
  switch (phase.kind) {
    case 'awaiting_node':
    case 'awaiting_move':
      return '/run';
    case 'combat':
      return '/run/encounter';
    case 'draft':
      return '/run/draft';
    case 'shop':
      return '/run/shop';
    case 'event':
      return '/run/event';
    case 'rest':
      return '/run/rest';
    case 'altar':
      // The dedicated Altar sacrifice ceremony (§2c) — explains the trade, offers Sacrifice / Leave.
      return '/run/altar';
    case 'act_transition':
      // The "Act 1 cleared" beat: heal + the Act-2 biome reveal + first-reach unlock ceremony (§1/§2a).
      return '/run/transition';
    case 'ended':
      // `victory` → the win screen; `defeat` AND `sacrificed` (§2c) both go to the defeat outcome,
      // which tailors its copy by `status` (a sacrifice reads as a deliberate trade, not a death).
      return state.status === 'victory' ? '/run/victory' : '/run/defeat';
  }
}
