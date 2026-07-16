import { StartSelectScreen } from '../src/ui/run/StartSelectScreen';

/**
 * The start-selection route (Stage 4). Deliberately OUTSIDE the run group: no run exists yet, so
 * this screen must not be wrapped in `RunProvider`. It stages a run (vanilla or a variant) and
 * navigates into `/run`, where the provider picks it up.
 */
export default function StartSelect() {
  return <StartSelectScreen />;
}
