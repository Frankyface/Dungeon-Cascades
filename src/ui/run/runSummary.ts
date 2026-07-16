/**
 * Pure run-summary computation for the victory / defeat screens: fold a `RunState` into the
 * headline numbers (outcome, floors reached, nodes cleared, relics, gold, HP). Reads only the
 * serializable run state, so the summary screens are thin renderers. No React imports.
 */
import { nodeById } from '../../engine/run';
import type { RunState, RunStatus } from '../../engine/run';

/** The numbers a run-end screen displays. */
export interface RunSummary {
  readonly outcome: RunStatus;
  /** Whether the run reached the boss floor (a full victory climb). */
  readonly reachedBoss: boolean;
  /** Deepest floor the player stood on (0-indexed; boss floor = floorCount − 1). */
  readonly floorsReached: number;
  readonly floorCount: number;
  /** Nodes fully resolved (engine telemetry counter). */
  readonly nodesCompleted: number;
  readonly relicIds: readonly string[];
  readonly relicCount: number;
  readonly gold: number;
  readonly hp: number;
  readonly maxHp: number;
}

/** The deepest floor among the visited node ids. */
function deepestVisitedFloor(state: RunState): number {
  let deepest = 0;
  for (const id of state.mapState.visited) {
    const floor = nodeById(state.map, id).floor;
    if (floor > deepest) {
      deepest = floor;
    }
  }
  return deepest;
}

/** Compute the run summary for a run in any state (active or terminal). Pure. */
export function computeRunSummary(state: RunState): RunSummary {
  const floorsReached = deepestVisitedFloor(state);
  return {
    outcome: state.status,
    reachedBoss: floorsReached >= state.map.floorCount - 1,
    floorsReached,
    floorCount: state.map.floorCount,
    nodesCompleted: state.nodesCompleted,
    relicIds: state.relicIds,
    relicCount: state.relicIds.length,
    gold: state.gold,
    hp: state.playerHp,
    maxHp: state.playerMaxHp,
  };
}
