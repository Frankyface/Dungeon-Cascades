/**
 * The two combat bots that bracket player skill in the balance sim.
 *
 * - `randomCombatBot` — the null model. It reuses the board `randomBot`'s honest
 *   random-walk path policy verbatim (it knows nothing about the enemy or matches),
 *   so it is the "just wiggle a tile" floor that skill must beat.
 *
 * - `greedyCombatBot` — the skilled model. It TARGETS this enemy: it searches (the
 *   same bounded exhaustive DFS the board-greedy uses) for the path that maximizes
 *   the enemy's first-wave combat value, weighting each match group by the enemy's
 *   affinity so it naturally hits weaknesses, and valuing a heal group only while the
 *   player is hurt. Deterministic; consumes no decision RNG.
 *
 * ── greedyCombatBot objective (exact) ────────────────────────────────────────────
 *   For a candidate post-swap board, over its FIRST-WAVE match groups (skyfall
 *   cascades excluded — refill-dependent, not skill, per docs/decisions.md):
 *
 *     score = [ Σ_groups base(color) × (1 + groupSizeBonus × (size − 3)) ]
 *             × (1 + cascadeBonus × (combos − 1))
 *
 *     base(damage color c) = attackBase × affinity(enemy, c)   // weakness targeting
 *     base(heal color P)   = healBase   × healWeight
 *     healWeight           = 1 if playerHp ≤ playerMaxHp × HEAL_HP_FRACTION, else 0
 *
 *   This mirrors the engine's real damage/heal curve (config.ts) restricted to the
 *   visible board, so the bot optimizes the same quantity the encounter rewards.
 *   Heal groups ALWAYS count toward `combos` (they feed the cascade multiplier in
 *   real combat too); they only add VALUE when the player is at/below half HP, so a
 *   healthy bot never wastes a turn healing but a hurt bot will top up when that is
 *   the strongest move available. The path maximizing `score` wins; ties break
 *   first-found in canonical order (see searchBestPath).
 */
import { TILE_COLORS } from '../board';
import type { TileColor } from '../board';
import { TILE_EFFECTS, affinityMultiplier } from '../combat';
import { randomBot } from './randomBot';
import { searchBestPath } from './pathSearch';
import { scoreFirstWave } from './combatScore';
import type { CombatBot } from './combatTypes';

/**
 * Player-HP fraction at/below which the greedy bot starts valuing heal groups. At
 * 0.5, a hurt bot treats a heal group's rolled HP as worth an equal-size normal
 * damage group; above half HP it ignores healing entirely and maximizes damage.
 */
export const HEAL_HP_FRACTION = 0.5;

/** randomCombatBot — reuse the board random-walk policy unchanged (enemy-agnostic). */
export const randomCombatBot: CombatBot = (board, rngState, ctx) =>
  randomBot(board, rngState, ctx.botConfig);

/** greedyCombatBot — search for the path maximizing this enemy's first-wave combat value. */
export const greedyCombatBot: CombatBot = (board, rngState, ctx) => {
  const { enemy, combatConfig, botConfig, playerHp, playerMaxHp } = ctx;
  const healWeight = playerHp <= playerMaxHp * HEAL_HP_FRACTION ? 1 : 0;

  // Fold affinity (damage) / heal weight into one base value per color CODE.
  const colorBase = new Float64Array(TILE_COLORS.length);
  for (let code = 0; code < TILE_COLORS.length; code++) {
    const color: TileColor = TILE_COLORS[code];
    if (TILE_EFFECTS[color].kind === 'damage') {
      colorBase[code] = combatConfig.attackBase * affinityMultiplier(enemy.affinity, color);
    } else {
      colorBase[code] = combatConfig.healBase * healWeight;
    }
  }

  const weights = {
    colorBase,
    groupSizeBonus: combatConfig.groupSizeBonus,
    cascadeBonus: combatConfig.cascadeBonus,
  };
  const path = searchBestPath(board, botConfig.greedyMaxDepth, (codes, cols, rows) =>
    scoreFirstWave(codes, cols, rows, weights),
  );
  return { path, rngState };
};
