import { Stack } from 'expo-router';
import { RunProvider } from '../../src/ui/run/RunContext';

/**
 * The run route group: one `RunProvider` wraps every run screen so the live RunState survives
 * navigation between the map, node, and outcome screens. Screen transitions are instant — the
 * run's phase (not the nav stack) decides which screen shows.
 */
export default function RunLayout() {
  return (
    <RunProvider>
      <Stack screenOptions={{ headerShown: false, animation: 'fade', animationDuration: 120 }} />
    </RunProvider>
  );
}
