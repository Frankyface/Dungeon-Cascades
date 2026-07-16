/**
 * Navigation over a generated run map: current position, legal next nodes (adjacent-floor
 * connected only), the visited path, and a move that REJECTS illegal jumps. Pure and
 * serializable — every function returns new data and never mutates its inputs.
 *
 * PURE ENGINE: no React / React Native imports; deterministic. See CLAUDE.md.
 */
import type { MapNode, MapState, RunMap } from './mapTypes';

/** Look up a node by id. Throws on an unknown id (boundary validation). */
export function nodeById(map: RunMap, id: string): MapNode {
  const node = map.nodes.find((n) => n.id === id);
  if (node === undefined) {
    throw new Error(`nodeById: unknown node id '${id}'`);
  }
  return node;
}

/** All nodes on a given floor, in index order. */
export function nodesOnFloor(map: RunMap, floor: number): readonly MapNode[] {
  return map.nodes.filter((n) => n.floor === floor);
}

/** The player's current node. */
export function currentNode(map: RunMap, state: MapState): MapNode {
  return nodeById(map, state.currentNodeId);
}

/** A fresh navigation state parked on the start node. */
export function createMapState(map: RunMap): MapState {
  return { currentNodeId: map.startId, visited: [map.startId] };
}

/**
 * The ids the player may legally move to next: exactly the current node's forward edges
 * (adjacent-floor, connected). Empty at the boss (the run is complete).
 */
export function legalNextNodes(map: RunMap, state: MapState): readonly string[] {
  return currentNode(map, state).next;
}

/** Whether `nodeId` is a legal next move from the current position. */
export function canMoveTo(map: RunMap, state: MapState, nodeId: string): boolean {
  return legalNextNodes(map, state).includes(nodeId);
}

/**
 * Move to `nodeId`, returning a new state with it appended to the visited path. Throws if
 * the jump is illegal — not a forward edge of the current node (skips a floor, jumps
 * sideways, or targets an unconnected node). This is the guard that keeps a run on-rails.
 */
export function moveTo(map: RunMap, state: MapState, nodeId: string): MapState {
  if (!canMoveTo(map, state, nodeId)) {
    throw new Error(
      `moveTo: illegal jump from '${state.currentNodeId}' to '${nodeId}' (legal: ${legalNextNodes(map, state).join(', ') || 'none'})`,
    );
  }
  return { currentNodeId: nodeId, visited: [...state.visited, nodeId] };
}

/** Whether the run has reached the boss node (current position is the terminal). */
export function isComplete(map: RunMap, state: MapState): boolean {
  return state.currentNodeId === map.bossId;
}
