/**
 * Deterministic SCRIPTED policies for headless play, plus a `driveRun` loop that plays a whole
 * run to a terminal state. These are NOT bots (no learning, no RNG of their own) — they are
 * fixed, reproducible move choices so a run can be driven end-to-end in pure TS: the full-run
 * playability proof here, and the next agent's balance sim later.
 *
 * `greedyComboPath` mirrors the proven Stage-2 greedy heuristic (maximize a move's IMMEDIATE
 * match groups); `trivialSwapPath` is a deliberately weak policy (a fixed no-op-ish swap) used
 * to demonstrate an honest death. The driver resolves every non-combat phase with a safe,
 * deterministic choice (first legal route, greedy relic buys, take-first draft, rest, leave
 * events) — a consistent measuring stick, exactly what the sim needs.
 *
 * PURE ENGINE: no React / React Native imports; deterministic; never mutates input.
 */
import { DIRECTIONS, applyPath, findMatches, validatePath } from '../board';
import type { Board, Direction, Path } from '../board';
import { legalNextNodes } from './mapNav';
import { getEvent } from './events';
import { buyShopItem } from './shop';
import { enterNode, playEncounterTurn, resolveDraftPick, advanceToNode, advanceAct } from './runFlow';
import type { RunOptions } from './runFlow';
import { buyFromShop, leaveShop, chooseEventOption, restAtNode, leaveRest } from './runNodes';
import type { RunState } from './runTypes';

/** The reverse of a direction (a step straight back restores an already-scored board). */
function reverseOf(dir: Direction): Direction {
  if (dir === 'up') return 'down';
  if (dir === 'down') return 'up';
  if (dir === 'left') return 'right';
  return 'left';
}

/**
 * The drag path (≤ `maxDepth` steps) that maximizes a move's IMMEDIATE match groups — the same
 * skill proxy the proven Stage-2 greedy bot (depth 4) optimizes. Exhaustive recursive DFS over
 * start cells (row-major) and every non-reversing drag; first-found wins ties. Always returns a
 * valid path (a board always admits a legal 1-step drag). Consumes no RNG; deterministic.
 */
export function greedyComboPath(board: Board, maxDepth = 4): Path {
  let best: Path | null = null;
  let bestScore = -1;

  const consider = (start: { col: number; row: number }, steps: Direction[]): void => {
    const path: Path = { start, steps: [...steps] };
    const score = findMatches(applyPath(board, path).board).length;
    if (best === null || score > bestScore) {
      best = path;
      bestScore = score;
    }
  };

  const dfs = (start: { col: number; row: number }, steps: Direction[]): void => {
    if (steps.length >= 1) consider(start, steps);
    if (steps.length >= maxDepth) return;
    const prev = steps.length > 0 ? reverseOf(steps[steps.length - 1]) : null;
    for (const dir of DIRECTIONS) {
      if (dir === prev) continue; // prune the immediate reversal
      steps.push(dir);
      if (validatePath(board, { start, steps }).ok) dfs(start, steps);
      steps.pop();
    }
  };

  for (let row = 0; row < board.rows; row++) {
    for (let col = 0; col < board.cols; col++) {
      dfs({ col, row }, []);
    }
  }

  return best ?? { start: { col: 0, row: 0 }, steps: ['right'] };
}

/** A deliberately weak fixed move (one swap, no search) — deals ~no damage; used to lose. */
export function trivialSwapPath(_board: Board): Path {
  return { start: { col: 0, row: 0 }, steps: ['right'] };
}

/**
 * Draft/shop preference order — a SURVIVAL-first heuristic (defense & sustain relics first,
 * then damage). A consistent measuring stick per the sim spec ("greedy-combat + a documented
 * routing/draft/shop heuristic"); it is not tuned to be optimal, only sensible and fixed.
 */
const RELIC_PREFERENCE: readonly string[] = [
  'bulwark-rune', // −2 every incoming hit — the biggest run-long mitigation
  'second-wind', // +1 regen per turn
  'phoenix-feather', // +8 HP each fight start
  'rowan-chalice', // ×1.5 heal groups
  'ambushers-cowl', // chip the enemy (shorter fight = less damage taken)
  'cascade-sigil',
  'whetstone-charm',
  'emberfang',
  'verdant-idol',
  'tidecaller-pearl',
  'sunspike-medallion',
  'misers-knuckle',
];

/** Preference rank of a relic id (lower = preferred); unknown ids sort last. */
function relicRank(id: string): number {
  const i = RELIC_PREFERENCE.indexOf(id);
  return i === -1 ? RELIC_PREFERENCE.length : i;
}

/** Pick the most-preferred relic from a draft's options (survival-first). */
function preferredDraftPick(options: readonly string[]): string | null {
  if (options.length === 0) return null;
  return [...options].sort((a, b) => relicRank(a) - relicRank(b))[0];
}

/** HP fraction below which the shop policy prioritizes buying the heal item. */
const SHOP_HEAL_HP_FRACTION = 0.6;

/** The index of an event's no-op "leave" choice (the safe default). */
function leaveChoiceIndex(eventId: string): number {
  const choices = getEvent(eventId).choices;
  const idx = choices.findIndex(
    (c) => c.outcome !== undefined && !c.outcome.goldDelta && !c.outcome.hpDelta && !c.outcome.grantRelic,
  );
  return idx === -1 ? choices.length - 1 : idx;
}

/** The affordable shop slot to buy, or −1 to leave. Heals when low HP; else the best relic. */
function shopBuyIndex(state: RunState): number {
  if (state.phase.kind !== 'shop') return -1;
  const shop = state.phase.shop;
  const items = shop.items;

  // When hurt, buy the heal item first if affordable.
  if (state.playerHp < state.playerMaxHp * SHOP_HEAL_HP_FRACTION) {
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'heal' && buyShopItem(shop, i, state.gold).ok) return i;
    }
  }
  // Otherwise the most-preferred affordable relic.
  let best = -1;
  let bestRank = Infinity;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind !== 'relic' || !buyShopItem(shop, i, state.gold).ok) continue;
    const rank = relicRank(item.relicId);
    if (rank < bestRank) {
      bestRank = rank;
      best = i;
    }
  }
  return best;
}

/**
 * Advance a run by exactly ONE deterministic transition using `combatPath` for fights. Every
 * non-combat phase is resolved by a fixed safe choice. Returns the run unchanged once terminal.
 */
export function stepRun(state: RunState, combatPath: (board: Board) => Path, options: RunOptions = {}): RunState {
  const phase = state.phase;
  switch (phase.kind) {
    case 'awaiting_node':
      return enterNode(state, options);
    case 'combat':
      return playEncounterTurn(state, combatPath(phase.encounter.board), options).state;
    case 'draft':
      return resolveDraftPick(state, preferredDraftPick(phase.options)); // survival-first pick
    case 'shop': {
      const buyIdx = shopBuyIndex(state);
      return buyIdx === -1 ? leaveShop(state) : buyFromShop(state, buyIdx).state;
    }
    case 'event':
      return chooseEventOption(state, leaveChoiceIndex(phase.eventId));
    case 'rest':
      return phase.rest.rested ? leaveRest(state) : restAtNode(state);
    case 'awaiting_move':
      return advanceToNode(state, legalNextNodes(state.map, state.mapState)[0]);
    case 'act_transition':
      return advanceAct(state); // the single forced transition into Act 2 (heal + onActStart + map)
    case 'ended':
      return state;
  }
}

/** The outcome of driving a whole run headlessly. */
export interface DriveResult {
  readonly state: RunState;
  readonly steps: number;
  /** True if the run terminated before the safety cap (no wedge / infinite loop). */
  readonly terminated: boolean;
}

/**
 * Drive a run from `start` to a terminal state with `combatPath` (default: greedy). `cap` guards
 * against a hypothetical wedge (a real run terminates far below it). Pure and deterministic.
 */
export function driveRun(
  start: RunState,
  combatPath: (board: Board) => Path = greedyComboPath,
  options: RunOptions = {},
  cap = 4000,
): DriveResult {
  let state = start;
  let steps = 0;
  while (state.status === 'active' && steps < cap) {
    state = stepRun(state, combatPath, options);
    steps++;
  }
  return { state, steps, terminated: state.status !== 'active' };
}
