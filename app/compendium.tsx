import { CompendiumScreen } from '../src/ui/compendium/CompendiumScreen';

/**
 * The Compendium route: a top-level, run-independent reference screen (relics, enemies, boss).
 * Deliberately OUTSIDE the run group — it needs no `RunProvider` and is reachable from the menu.
 */
export default function Compendium() {
  return <CompendiumScreen />;
}
