/**
 * Pure presentation + legality helpers for run-map nodes: a glyph and label per node type,
 * and — given the live `RunState` — whether a node is the current position, already visited,
 * or a legal next move. The map `.tsx` reads these to draw distinct node types, mark the
 * visited path, and enable ONLY legal taps. No React imports; deterministic.
 */
import { legalNextNodes } from '../../engine/run';
import type { NodeType, RunState } from '../../engine/run';

/** A distinct display glyph per node type (placeholder-grade, like the tile/enemy glyphs). */
export const NODE_GLYPH: Readonly<Record<NodeType, string>> = {
  fight: '⚔',
  elite: '☠',
  event: '❓',
  shop: '🛒',
  rest: '🔥',
  altar: '🩸',
  boss: '👑',
};

/** A short human label per node type (used for accessibility + the node caption). */
export const NODE_LABEL: Readonly<Record<NodeType, string>> = {
  fight: 'Fight',
  elite: 'Elite',
  event: 'Event',
  shop: 'Shop',
  rest: 'Rest',
  altar: 'Altar',
  boss: 'Boss',
};

/**
 * How a node can be interacted with from the current run state:
 * - `current-enter`: the player is parked here and must ENTER it (awaiting_node).
 * - `travel`: a legal next node the player may MOVE to (awaiting_move).
 * - `visited`: already resolved / passed through (shown on the path, not tappable).
 * - `locked`: not reachable from the current position right now.
 */
export type NodeInteraction = 'current-enter' | 'travel' | 'visited' | 'locked';

/** Whether `nodeId` is the player's current map position. */
export function isCurrentNode(state: RunState, nodeId: string): boolean {
  return state.mapState.currentNodeId === nodeId;
}

/** Whether `nodeId` has been visited (is on the travelled path). */
export function isVisitedNode(state: RunState, nodeId: string): boolean {
  return state.mapState.visited.includes(nodeId);
}

/** The interaction role of `nodeId` given the current phase (drives tappability + styling). */
export function nodeInteraction(state: RunState, nodeId: string): NodeInteraction {
  const phase = state.phase.kind;
  if (phase === 'awaiting_node' && isCurrentNode(state, nodeId)) {
    return 'current-enter';
  }
  if (phase === 'awaiting_move' && legalNextNodes(state.map, state.mapState).includes(nodeId)) {
    return 'travel';
  }
  if (isVisitedNode(state, nodeId)) {
    return 'visited';
  }
  return 'locked';
}

/** Whether a tap on `nodeId` triggers an engine action (enter or travel) right now. */
export function isNodeTappable(state: RunState, nodeId: string): boolean {
  const interaction = nodeInteraction(state, nodeId);
  return interaction === 'current-enter' || interaction === 'travel';
}
