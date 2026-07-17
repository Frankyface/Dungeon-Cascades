/**
 * The full-run POLICY bot — the deterministic measuring stick the balance sim drives.
 *
 * A run policy resolves every phase of the run state machine. It is built ON the pure
 * run/ layer (run logic is read-only; policies layer above it in sim/), reusing the run
 * engine's own scripted phase resolutions via `stepRun` for shop/event/rest/altar and
 * adding a documented SKILL layer on top at the decision points that matter for the
 * two-act expansion:
 *
 * ── Policy heuristic (verbatim) ────────────────────────────────────────────────────────
 *   • COMBAT: `affinityComboPath` — an AFFINITY-AWARE first-wave scorer (the same objective
 *     sim/'s `greedyCombatBot` maximizes for combat mode), reading the CURRENT enemy's
 *     affinity + the live combat HP straight off the RunState's combat phase. It weights each
 *     damage group by `attackBase × affinity(enemy, color)` and values a heal group only while
 *     the player is at/below `HEAL_HP_FRACTION` max HP. This REPLACES the old color-blind
 *     `greedyComboPath` (which maximized raw match-group count) — that maximizer fed Act-2
 *     biome resist/immune walls (e.g. Red into a Red-immune Slagback Brute = 0 damage), badly
 *     under-measuring a skilled player who targets weaknesses. Deterministic; consumes no RNG.
 *   • DRAFT (this module): survival-first, PLUS the run's known Act-2 biome answer color — when
 *     the draft offers the affinity relic matching the biome's dominant weakness (and no core
 *     mitigation relic is on offer), take it, so the bot arrives in Act 2 built to hit the
 *     biome's tanks. Core mitigation (bulwark/regen/heal-start) still comes first.
 *   • ROUTING (this module): pick the next node by current HP fraction (rest/shop/safety when
 *     hurt, elite when healthy, progress in between). Act 2 uses a HIGHER "hurt" threshold —
 *     the Act-2 boss hits far harder, so the bot banks rest/heal routes earlier to arrive at
 *     the boss healthier ("rest before the Act-2 boss when hurt").
 *   • SHOP / EVENT / REST / ALTAR: delegated to run/'s `stepRun` — heal-when-hurt-else-cheapest
 *     shop, leave events, rest then leave, never sacrifice at the altar.
 *
 * The `trivial` control uses `trivialSwapPath` in combat and run/'s first-legal routing
 * (plain `stepRun` throughout) — a deliberately weak player, the skill floor.
 *
 * PURE ENGINE: no React / React Native imports; deterministic; never mutates input.
 */
import { TILE_COLORS } from '../board';
import type { Board, Path, TileColor } from '../board';
import { DEFAULT_COMBAT_CONFIG, TILE_EFFECTS, affinityMultiplier, getEnemy } from '../combat';
import type { BiomeId, CombatConfig, CombatState, Enemy } from '../combat';
import { advanceToNode, greedyComboPath, legalNextNodes, nodeById, resolveDraftPick, stepRun, trivialSwapPath } from '../run';
import type { NodeType, RunState } from '../run';
import { HEAL_HP_FRACTION } from './combatBots';
import { scoreFirstWave } from './combatScore';
import { searchBestPath } from './pathSearch';
import { DEFAULT_BOT_CONFIG } from './types';
import type { RunBotName } from './runSimTypes';

/** HP fraction at/below which the policy prioritizes healing/safe routes (Act 1). */
export const ROUTE_HURT_HP_FRACTION = 0.4;

/**
 * Act-2 "hurt" threshold — higher than Act 1's. The Act-2 boss burst is far larger, so the
 * policy treats itself as "needs healing" earlier in Act 2 and banks rest/shop/safe routes
 * before reaching the boss (spec §9 biome fairness leans on arriving at the boss healthy).
 */
export const ROUTE_ACT2_HURT_HP_FRACTION = 0.55;

/** HP fraction at/above which the policy prioritizes reward (elite) routes. */
export const ROUTE_HEALTHY_HP_FRACTION = 0.7;

/** Search depth for the affinity combat path — matches the combat sim + board greedy (depth 4). */
const COMBAT_SEARCH_DEPTH = DEFAULT_BOT_CONFIG.greedyMaxDepth;

/** Combat config the run sim fights under (the shipped default — the sim threads no override). */
const COMBAT_CONFIG: CombatConfig = DEFAULT_COMBAT_CONFIG;

/**
 * Each Act-2 biome's ANSWER COLOR — the damage color its biggest HP tank (and most of its kit)
 * is WEAK to, i.e. the color a player should build toward for that biome (content-biomes.md):
 *   • Glacial Crypt   → B (Blue "shatter"; the 220-HP Permafrost Warden is weak Blue)
 *   • Emberworks      → B (the 260-HP Slagback Brute is Red-IMMUNE, Blue-weak)
 *   • Rotwood         → R (Green is the trap color; the 260-HP Mirebark Hulk is weak Red)
 *   • Sunken Catacombs→ Y (Blue is the trap color; the 260-HP Drowned Warden is weak Yellow)
 * The `dungeon` (Act 1) has no single answer color, so it is intentionally absent — the draft
 * heuristic only nudges when the run's Act-2 biome names a clear color.
 */
const BIOME_ANSWER_COLOR: Partial<Record<BiomeId, TileColor>> = {
  'glacial-crypt': 'B',
  emberworks: 'B',
  rotwood: 'R',
  'sunken-catacombs': 'Y',
};

/** The base-12 affinity relic that boosts each damage color (+50% to that color). */
const COLOR_AFFINITY_RELIC: Record<TileColor, string | undefined> = {
  R: 'emberfang',
  G: 'verdant-idol',
  B: 'tidecaller-pearl',
  Y: 'sunspike-medallion',
  P: undefined, // heal color — no damage-affinity relic
};

/**
 * Core mitigation relics, most-preferred first — the survival-first HEAD of the run's shipped
 * draft order (runPolicy's RELIC_PREFERENCE). The biome affinity nudge slots in AFTER these, so
 * the bot never trades away run-long mitigation for raw damage. Kept in sync with run/ by intent.
 */
const DRAFT_MITIGATION_CORE: readonly string[] = [
  'bulwark-rune', // −2 every incoming hit — the biggest run-long mitigation
  'second-wind', // +1 regen per turn
  'phoenix-feather', // +8 HP each fight start
  'rowan-chalice', // ×1.5 heal groups
  'ambushers-cowl', // chip the enemy (shorter fight = less damage taken)
];

/** Combat path chooser for a bot: affinity-aware for `policy`, the weak fixed swap for `trivial`. */
export function combatPathFor(bot: RunBotName): (board: Board) => Path {
  return bot === 'policy' ? greedyComboPath : trivialSwapPath;
}

/**
 * The AFFINITY-AWARE combat move for a single encounter — the shared core of the policy bot's
 * combat play. Mirrors sim/'s `greedyCombatBot` objective exactly: fold the CURRENT enemy's
 * affinity into a per-color base value (heal weighted only when the player is at/below
 * `HEAL_HP_FRACTION`), then search for the path maximizing the board's first-wave combat value.
 * Reused by the run driver AND the Boss-Rush measure. Deterministic; consumes no RNG.
 */
export function affinityCombatPath(enc: CombatState): Path {
  // The CURRENT enemy: the run/boss-rush always supplies the scaled/biome/boss `enemy` override;
  // the registry lookup is a defensive fallback (never hit on an engine-produced encounter).
  const enemy: Enemy = enc.enemy ?? getEnemy(enc.enemyId);
  const healWeight = enc.playerHp <= enc.playerMaxHp * HEAL_HP_FRACTION ? 1 : 0;

  const colorBase = new Float64Array(TILE_COLORS.length);
  for (let code = 0; code < TILE_COLORS.length; code++) {
    const color: TileColor = TILE_COLORS[code];
    if (TILE_EFFECTS[color].kind === 'damage') {
      colorBase[code] = COMBAT_CONFIG.attackBase * affinityMultiplier(enemy.affinity, color);
    } else {
      colorBase[code] = COMBAT_CONFIG.healBase * healWeight;
    }
  }
  const weights = {
    colorBase,
    groupSizeBonus: COMBAT_CONFIG.groupSizeBonus,
    cascadeBonus: COMBAT_CONFIG.cascadeBonus,
  };
  return searchBestPath(enc.board, COMBAT_SEARCH_DEPTH, (codes, cols, rows) =>
    scoreFirstWave(codes, cols, rows, weights),
  );
}

/** The affinity combat move read off the run's current combat phase (requires a `combat` phase). */
export function affinityComboPath(state: RunState): Path {
  if (state.phase.kind !== 'combat') throw new Error('affinityComboPath: not a combat phase');
  return affinityCombatPath(state.phase.encounter);
}

/**
 * Route-preference rank (lower = more preferred) of a node type under the HP regime. A total
 * order over every NodeType so the pick is always unambiguous; `boss` is ranked last but is only
 * ever offered alone (the pre-boss floor funnels into it), so it is forced. The "hurt" threshold
 * is Act-aware — Act 2 seeks safety earlier (see `ROUTE_ACT2_HURT_HP_FRACTION`).
 */
function routeRank(type: NodeType, hpFraction: number, act: number): number {
  const hurtThreshold = act >= 2 ? ROUTE_ACT2_HURT_HP_FRACTION : ROUTE_HURT_HP_FRACTION;
  let order: readonly NodeType[];
  if (hpFraction <= hurtThreshold) {
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
 * The policy's next-node choice from the move phase: the legal node with the best route rank for
 * the current HP fraction (Act-aware), ties broken by the map's natural next-node order. Always
 * returns a legal id (a non-boss move phase always offers ≥1 next node).
 */
export function choosePolicyRoute(state: RunState): string {
  const legal = legalNextNodes(state.map, state.mapState);
  const hpFraction = state.playerMaxHp > 0 ? state.playerHp / state.playerMaxHp : 0;
  let bestId = legal[0];
  let bestRank = routeRank(nodeById(state.map, legal[0]).type, hpFraction, state.act);
  for (let i = 1; i < legal.length; i++) {
    const rank = routeRank(nodeById(state.map, legal[i]).type, hpFraction, state.act);
    if (rank < bestRank) {
      bestRank = rank;
      bestId = legal[i];
    }
  }
  return bestId;
}

/**
 * The policy's DRAFT pick from the offered options, or `null` to defer to run/'s survival-first
 * pick. Rule: (1) if any core mitigation relic is offered, take the most-preferred one (survival
 * first — unchanged from the shipped policy's head); (2) else, if the run's known Act-2 biome
 * names an answer color and its affinity relic is offered, take that (the "draft toward the
 * biome" nudge); (3) else defer (`null`) so `stepRun` applies run/'s tail order.
 */
export function choosePolicyDraft(state: RunState, options: readonly string[]): string | null {
  // (1) survival-first core, in preference order.
  for (const id of DRAFT_MITIGATION_CORE) {
    if (options.includes(id)) return id;
  }
  // (2) biome answer-color affinity relic, when the run's Act-2 biome names one.
  const answerColor = state.act2BiomeId === undefined ? undefined : BIOME_ANSWER_COLOR[state.act2BiomeId];
  const biomeRelic = answerColor === undefined ? undefined : COLOR_AFFINITY_RELIC[answerColor];
  if (biomeRelic !== undefined && options.includes(biomeRelic)) return biomeRelic;
  // (3) defer to run/'s own preference for everything else.
  return null;
}

/**
 * Advance a run by exactly ONE deterministic transition under `bot`. The `policy` bot overrides:
 * the MOVE phase with Act-aware HP routing, the COMBAT phase with the affinity-aware path, and the
 * DRAFT phase with the biome-aware pick; every other phase (and the whole `trivial` bot) is
 * resolved by run/'s own `stepRun`. Returns the run unchanged once terminal.
 */
export function stepRunBot(state: RunState, bot: RunBotName): RunState {
  if (bot === 'policy') {
    if (state.phase.kind === 'awaiting_move') {
      return advanceToNode(state, choosePolicyRoute(state));
    }
    if (state.phase.kind === 'combat') {
      const path = affinityComboPath(state);
      return stepRun(state, () => path);
    }
    if (state.phase.kind === 'draft') {
      const pick = choosePolicyDraft(state, state.phase.options);
      // A concrete pick is applied directly; `null` defers to run/'s survival-first draft.
      if (pick !== null) return resolveDraftPick(state, pick);
    }
  }
  return stepRun(state, combatPathFor(bot));
}
