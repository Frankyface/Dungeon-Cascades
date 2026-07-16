import { startRun } from '../../engine/run';
import type { RunState } from '../../engine/run';
import {
  NODE_GLYPH,
  NODE_LABEL,
  isCurrentNode,
  isNodeTappable,
  isVisitedNode,
  nodeInteraction,
} from './nodePresentation';

const NODE_TYPES = ['fight', 'elite', 'event', 'shop', 'rest', 'boss'] as const;

describe('node glyph + label tables', () => {
  it('has a distinct glyph and a label for every node type', () => {
    const glyphs = NODE_TYPES.map((t) => NODE_GLYPH[t]);
    expect(new Set(glyphs).size).toBe(NODE_TYPES.length);
    for (const type of NODE_TYPES) {
      expect(NODE_LABEL[type].length).toBeGreaterThan(0);
    }
  });
});

describe('nodeInteraction', () => {
  it('at run start, the current node is enterable and its next nodes are locked', () => {
    const state = startRun(1); // awaiting_node at the start
    const start = state.map.startId;
    const nextId = state.map.nodes.find((n) => n.id === start)!.next[0];

    expect(nodeInteraction(state, start)).toBe('current-enter');
    expect(isNodeTappable(state, start)).toBe(true);
    expect(nodeInteraction(state, nextId)).toBe('locked');
    expect(isNodeTappable(state, nextId)).toBe(false);
  });

  it('in the move phase, the legal next nodes are travel options and the current is visited', () => {
    const base = startRun(1);
    const state: RunState = { ...base, phase: { kind: 'awaiting_move' } };
    const start = state.map.startId;
    const nextIds = state.map.nodes.find((n) => n.id === start)!.next;

    expect(isCurrentNode(state, start)).toBe(true);
    expect(nodeInteraction(state, start)).toBe('visited');
    for (const id of nextIds) {
      expect(nodeInteraction(state, id)).toBe('travel');
      expect(isNodeTappable(state, id)).toBe(true);
    }
  });

  it('marks visited nodes and never makes an off-path node tappable', () => {
    const base = startRun(1);
    const start = base.map.startId;
    const nextId = base.map.nodes.find((n) => n.id === start)!.next[0];
    // Pretend we moved to nextId (visited both), still in the move phase.
    const state: RunState = {
      ...base,
      mapState: { currentNodeId: nextId, visited: [start, nextId] },
      phase: { kind: 'awaiting_move' },
    };
    expect(isVisitedNode(state, start)).toBe(true);
    expect(nodeInteraction(state, start)).toBe('visited');
    // A far node not linked from nextId is locked.
    const far = base.map.nodes.find((n) => !state.mapState.visited.includes(n.id) && !base.map.nodes.find((m) => m.id === nextId)!.next.includes(n.id));
    if (far) {
      expect(isNodeTappable(state, far.id)).toBe(false);
    }
  });
});
