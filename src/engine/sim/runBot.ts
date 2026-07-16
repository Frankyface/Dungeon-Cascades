/**
 * The full-run POLICY bot — the deterministic measuring stick the balance sim drives.
 *
 * A run policy resolves every phase of the run state machine. It is built ON the pure
 * run/ layer (run logic is read-only; policies layer above it in sim/), reusing the run
 * engine's own scripted phase resolutions via `stepRun` for combat/draft/shop/event/rest
 * and adding one thing on top: an HP-AWARE ROUTING heuristic at the branch points. This
 * keeps the combat/draft/shop heuristics identical to the ones the run engine ships
 * (DRY — the survival-first draft order and heal-when-hurt shop logic live in run/), while
 * giving the policy a documented route-selection skill that the trivial control lacks.
 *
 * ── Policy heuristic (verbatim) ────────────────────────────────────────────────────────
 *   • COMBAT: `greedyComboPath` (depth 4) — the run engine's own combat policy, which
 *     maximizes a move's immediate match groups (the proven Stage-2 skill proxy). Chosen
 *     over sim/'s affinity-aware `greedyCombatBot` because greedyComboPath is the exact
 *     policy the run engine's `driveRun` ships and the feature log's ≈34% reference was
 *     measured with, so the sim measures the shipped policy, not a stronger proxy; it also
 *     needs no CombatBotContext/RNG threading, staying a pure `(board) => Path`.
 *   • ROUTING (this module): pick the next node by current HP fraction —
 *       – HURT   (HP ≤ 40% max): rest > shop > event > fight > elite  (seek healing/safety)
 *       – HEALTHY (HP ≥ 70% max): elite > fight > shop > event > rest  (bank the 2× reward)
 *       – MID     (otherwise):    fight > shop > event > rest > elite  (progress, dodge risk)
 *     Ties break by the map's natural next-node order (deterministic).
 *   • DRAFT / SHOP / EVENT / REST: delegated to run/'s `stepRun` — survival-first relic
 *     pick, heal-when-hurt-else-cheapest-relic shop, leave events, rest then leave.
 *
 * The `trivial` control uses `trivialSwapPath` in combat and run/'s first-legal routing
 * (plain `stepRun` throughout) — a deliberately weak player, the skill floor.
 *
 * PURE ENGINE: no React / React Native imports; deterministic; never mutates input.
 */
import { advanceToNode, greedyComboPath, legalNextNodes, nodeById, stepRun, trivialSwapPath } from '../run';
import type { Board, Path } from '../board';
import type { NodeType, RunState } from '../run';
import type { RunBotName } from './runSimTypes';

/** HP fraction at/below which the policy prioritizes healing/safe routes. */
export const ROUTE_HURT_HP_FRACTION = 0.4;

/** HP fraction at/above which the policy prioritizes reward (elite) routes. */
export const ROUTE_HEALTHY_HP_FRACTION = 0.7;

/** Combat path chooser for a bot: greedy for `policy`, the weak fixed swap for `trivial`. */
export function combatPathFor(bot: RunBotName): (board: Board) => Path {
  return bot === 'policy' ? greedyComboPath : trivialSwapPath;
}

/**
 * Route-preference rank (lower = more preferred) of a node type under the HP regime. A
 * total order over every NodeType so the pick is always unambiguous; `boss` is ranked last
 * but is only ever offered alone (the pre-boss floor funnels into it), so it is forced.
 */
function routeRank(type: NodeType, hpFraction: number): number {
  let order: readonly NodeType[];
  if (hpFraction <= ROUTE_HURT_HP_FRACTION) {
    order = ['rest', 'shop', 'event', 'fight', 'elite', 'boss']; // hurt: heal/safety first
  } else if (hpFraction >= ROUTE_HEALTHY_HP_FRACTION) {
    order = ['elite', 'fight', 'shop', 'event', 'rest', 'boss']; // healthy: bank the reward
  } else {
    order = ['fight', 'shop', 'event', 'rest', 'elite', 'boss']; // mid: progress, dodge risk
  }
  const i = order.indexOf(type);
  return i === -1 ? order.length : i;
}

/**
 * The policy's next-node choice from the move phase: the legal node with the best route
 * rank for the current HP fraction, ties broken by the map's natural next-node order.
 * Always returns a legal id (a non-boss move phase always offers ≥1 next node).
 */
export function choosePolicyRoute(state: RunState): string {
  const legal = legalNextNodes(state.map, state.mapState);
  const hpFraction = state.playerMaxHp > 0 ? state.playerHp / state.playerMaxHp : 0;
  let bestId = legal[0];
  let bestRank = routeRank(nodeById(state.map, legal[0]).type, hpFraction);
  for (let i = 1; i < legal.length; i++) {
    const rank = routeRank(nodeById(state.map, legal[i]).type, hpFraction);
    if (rank < bestRank) {
      bestRank = rank;
      bestId = legal[i];
    }
  }
  return bestId;
}

/**
 * Advance a run by exactly ONE deterministic transition under `bot`. The `policy` bot
 * overrides the move phase with HP-aware routing and fights greedily; every other phase
 * (and the whole `trivial` bot) is resolved by run/'s own `stepRun`. Returns the run
 * unchanged once terminal.
 */
export function stepRunBot(state: RunState, bot: RunBotName): RunState {
  if (bot === 'policy' && state.phase.kind === 'awaiting_move') {
    return advanceToNode(state, choosePolicyRoute(state));
  }
  return stepRun(state, combatPathFor(bot));
}
