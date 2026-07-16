/**
 * First-wave combat value scorer — the objective the combat-greedy bot maximizes.
 *
 * Given a candidate post-swap board (as color CODES) and a per-color base-value
 * table, it computes the combat VALUE of that board's FIRST WAVE of matches, exactly
 * mirroring the engine's damage/heal curve but restricted to the immediately-visible
 * groups (no skyfall cascades — those are refill-dependent, not skill, per
 * docs/decisions.md; identical rationale to the board-greedy bot):
 *
 *     value  = Σ_groups  colorBase[color] × (1 + groupSizeBonus × (size − 3))
 *     score  = value × (1 + cascadeBonus × (combos − 1))          (combos = #groups)
 *
 * `colorBase[c]` folds the enemy's affinity (for damage colors) and the heal weight
 * (for the heal color) into one number per color code, so this hot loop stays a
 * plain multiply-add. Group detection matches `findMatches` EXACTLY (mark runs ≥
 * MATCH_MIN in either axis, then count orthogonally-connected same-color
 * components — a cross/L/T is ONE group).
 *
 * Isolation note: this deliberately carries its own marking + flood-fill (a copy of
 * matchCount's, adapted to accumulate per-group color + size) rather than sharing
 * matchCount's buffers, so the byte-locked board-greedy path (matchCount →
 * Stage-1 3.4309 baseline) is never perturbed by combat changes.
 *
 * Purity: module-level scratch buffers are internal working memory, fully reset on
 * every call — each call is a pure mapping from (codes, weights) to a score. No
 * external observable state, no time, no randomness.
 */
import { MATCH_MIN } from '../board';

/** Weights that fold enemy affinity + heal preference into one base value per color code. */
export interface ColorWeights {
  /** Per-color pre-size, pre-cascade base value, indexed by color code (TILE_COLORS order). */
  readonly colorBase: Float64Array;
  readonly groupSizeBonus: number;
  readonly cascadeBonus: number;
}

// Reusable scratch, grown on demand and reset (fill) each call.
let matched: Uint8Array = new Uint8Array(0);
let visited: Uint8Array = new Uint8Array(0);
let stack: Int32Array = new Int32Array(0);

function ensureCapacity(size: number): void {
  if (matched.length < size) {
    matched = new Uint8Array(size);
    visited = new Uint8Array(size);
    stack = new Int32Array(size);
  }
}

/**
 * Score the first-wave combat value of a board of color codes under `weights`.
 * Returns `value × cascadeMultiplier`; 0 when the board has no matches.
 */
export function scoreFirstWave(
  codes: Uint8Array,
  cols: number,
  rows: number,
  weights: ColorWeights,
): number {
  const size = cols * rows;
  ensureCapacity(size);
  matched.fill(0, 0, size);

  // Mark horizontal runs of >= MATCH_MIN same color.
  for (let r = 0; r < rows; r++) {
    let runStart = 0;
    let runLen = 1;
    for (let c = 1; c <= cols; c++) {
      const same = c < cols && codes[r * cols + c] === codes[r * cols + c - 1];
      if (same) {
        runLen++;
      } else {
        if (runLen >= MATCH_MIN) {
          for (let k = 0; k < runLen; k++) {
            matched[r * cols + runStart + k] = 1;
          }
        }
        runStart = c;
        runLen = 1;
      }
    }
  }

  // Mark vertical runs of >= MATCH_MIN same color.
  for (let c = 0; c < cols; c++) {
    let runStart = 0;
    let runLen = 1;
    for (let r = 1; r <= rows; r++) {
      const same = r < rows && codes[r * cols + c] === codes[(r - 1) * cols + c];
      if (same) {
        runLen++;
      } else {
        if (runLen >= MATCH_MIN) {
          for (let k = 0; k < runLen; k++) {
            matched[(runStart + k) * cols + c] = 1;
          }
        }
        runStart = r;
        runLen = 1;
      }
    }
  }

  // Walk connected same-color components of marked cells, accumulating value + combos.
  visited.fill(0, 0, size);
  const { colorBase, groupSizeBonus, cascadeBonus } = weights;
  let combos = 0;
  let value = 0;
  for (let index = 0; index < size; index++) {
    if (matched[index] === 0 || visited[index] === 1) {
      continue;
    }
    combos++;
    const color = codes[index];
    let groupSize = 0;
    let top = 0;
    stack[top++] = index;
    visited[index] = 1;
    while (top > 0) {
      const cell = stack[--top];
      groupSize++;
      const col = cell % cols;
      const row = (cell - col) / cols;
      if (row > 0) {
        const n = cell - cols;
        if (matched[n] === 1 && visited[n] === 0 && codes[n] === color) {
          visited[n] = 1;
          stack[top++] = n;
        }
      }
      if (row < rows - 1) {
        const n = cell + cols;
        if (matched[n] === 1 && visited[n] === 0 && codes[n] === color) {
          visited[n] = 1;
          stack[top++] = n;
        }
      }
      if (col > 0) {
        const n = cell - 1;
        if (matched[n] === 1 && visited[n] === 0 && codes[n] === color) {
          visited[n] = 1;
          stack[top++] = n;
        }
      }
      if (col < cols - 1) {
        const n = cell + 1;
        if (matched[n] === 1 && visited[n] === 0 && codes[n] === color) {
          visited[n] = 1;
          stack[top++] = n;
        }
      }
    }
    value += colorBase[color] * (1 + groupSizeBonus * (groupSize - MATCH_MIN));
  }

  if (combos === 0) {
    return 0;
  }
  return value * (1 + cascadeBonus * (combos - 1));
}
