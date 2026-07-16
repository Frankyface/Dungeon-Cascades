/**
 * Pure map-layout math for the run map screen: turn a generated `RunMap` (a layered DAG)
 * into absolute x/y positions for every node and every forward edge, so the `.tsx` map
 * renderer is a thin absolute-position layout with ZERO geometry logic of its own.
 *
 * Convention: floor 0 (the start) sits at the BOTTOM, the boss floor at the TOP — the
 * player climbs upward. Within a floor, nodes are spread evenly across the usable width.
 * Everything here is deterministic and unit-tested; no React / React Native imports.
 */
import type { MapNode, NodeType, RunMap } from '../../engine/run';

/** Node marker diameter (px). */
export const MAP_NODE_SIZE = 52;
/** Vertical distance between adjacent floor centers (px). */
export const MAP_FLOOR_GAP = 96;
/** Top / bottom padding above the boss and below the start (px). */
export const MAP_VERTICAL_PAD = 64;
/** Left / right padding so edge nodes are never flush to the screen edge (px). */
export const MAP_HORIZONTAL_PAD = 36;
/** Rendered thickness of an edge connector (px). */
export const MAP_EDGE_THICKNESS = 3;

/** A node placed in screen space (center coordinates). */
export interface LaidOutNode {
  readonly id: string;
  readonly type: NodeType;
  readonly floor: number;
  readonly index: number;
  readonly x: number;
  readonly y: number;
}

/** A forward edge placed in screen space (from → to node centers). */
export interface LaidOutEdge {
  readonly fromId: string;
  readonly toId: string;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/** The full laid-out map: sized content plus positioned nodes and edges. */
export interface MapLayout {
  readonly width: number;
  readonly height: number;
  readonly nodeSize: number;
  readonly nodes: readonly LaidOutNode[];
  readonly edges: readonly LaidOutEdge[];
}

/** The y-center for a node on `floor` (floor 0 at the bottom, boss floor at the top). */
export function floorY(floor: number, floorCount: number): number {
  return MAP_VERTICAL_PAD + (floorCount - 1 - floor) * MAP_FLOOR_GAP;
}

/** The x-center for the `index`-th of `count` nodes across a `width`-wide screen. */
export function nodeX(index: number, count: number, width: number): number {
  const usable = width - 2 * MAP_HORIZONTAL_PAD;
  return MAP_HORIZONTAL_PAD + (usable * (index + 1)) / (count + 1);
}

/**
 * Lay out a whole run map for a `width`-wide screen. Content height grows with the floor
 * count so the map scrolls; nodes are spread per floor and edges follow the DAG's forward
 * `next` links. Pure — a given (map, width) always yields the same layout.
 */
export function computeMapLayout(map: RunMap, width: number): MapLayout {
  const floorCount = map.floorCount;
  const byFloor = new Map<number, MapNode[]>();
  for (const node of map.nodes) {
    const list = byFloor.get(node.floor) ?? [];
    list.push(node);
    byFloor.set(node.floor, list);
  }

  const placed = new Map<string, LaidOutNode>();
  const nodes: LaidOutNode[] = [];
  for (const [floor, floorNodes] of byFloor) {
    const ordered = [...floorNodes].sort((a, b) => a.index - b.index);
    for (const node of ordered) {
      const laid: LaidOutNode = {
        id: node.id,
        type: node.type,
        floor: node.floor,
        index: node.index,
        x: nodeX(node.index, ordered.length, width),
        y: floorY(floor, floorCount),
      };
      placed.set(node.id, laid);
      nodes.push(laid);
    }
  }

  const edges: LaidOutEdge[] = [];
  for (const node of map.nodes) {
    const from = placed.get(node.id);
    if (from === undefined) continue;
    for (const toId of node.next) {
      const to = placed.get(toId);
      if (to === undefined) continue;
      edges.push({ fromId: node.id, toId, x1: from.x, y1: from.y, x2: to.x, y2: to.y });
    }
  }

  return {
    width,
    height: 2 * MAP_VERTICAL_PAD + (floorCount - 1) * MAP_FLOOR_GAP,
    nodeSize: MAP_NODE_SIZE,
    nodes,
    edges,
  };
}

/** A connector geometry for rendering an edge as a single rotated view. */
export interface EdgeGeometry {
  /** Left of the connector's bounding box before rotation. */
  readonly left: number;
  /** Vertical center of the connector (the row it rotates about). */
  readonly top: number;
  /** Connector length (distance between the two node centers). */
  readonly length: number;
  /** Rotation in degrees about the connector's center. */
  readonly angleDeg: number;
}

/**
 * Geometry to draw an edge as one thin view of `length` rotated `angleDeg` about its center.
 * The view is positioned so its center lands on the segment midpoint (RN rotates about the
 * view center by default), so a horizontal segment is angle 0 and a vertical one is 90.
 */
export function edgeGeometry(x1: number, y1: number, x2: number, y2: number): EdgeGeometry {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const length = Math.hypot(x2 - x1, y2 - y1);
  const angleDeg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return { left: midX - length / 2, top: midY, length, angleDeg };
}
