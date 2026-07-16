/**
 * Run-screen palette. Reuses the combat/board hues so the run map, node screens, and fights
 * read as one game, and adds a per-node-type accent so the map's node types are distinct at a
 * glance. Placeholder-grade — final art is a later stage.
 */
import type { NodeType } from '../../engine/run';
import { COMBAT_COLORS } from '../combat/combatColors';

export const RUN_COLORS = {
  screenBg: COMBAT_COLORS.screenBg,
  panelBg: COMBAT_COLORS.panelBg,
  panelBorder: COMBAT_COLORS.panelBorder,
  text: COMBAT_COLORS.text,
  subtle: COMBAT_COLORS.subtle,
  gold: '#f5c542',
  hpFill: COMBAT_COLORS.playerFill,
  hpTrack: COMBAT_COLORS.hpTrack,
  buttonBg: COMBAT_COLORS.buttonBg,
  buttonText: COMBAT_COLORS.buttonText,
  accent: '#38406e',
  edge: '#3a3d63',
  edgeActive: '#8ad0ff',
  lockedNode: '#23243c',
  currentRing: '#8ad0ff',
  visitedNode: '#2c3350',
  winText: COMBAT_COLORS.winText,
  loseText: COMBAT_COLORS.loseText,
} as const;

/** Accent color per node type (marker fill for a legal/enterable node). */
export const NODE_COLOR: Readonly<Record<NodeType, string>> = {
  fight: '#e5484d',
  elite: '#a855f7',
  event: '#3b82f6',
  shop: '#f5c542',
  rest: '#30a46c',
  boss: '#ff6b6b',
};
