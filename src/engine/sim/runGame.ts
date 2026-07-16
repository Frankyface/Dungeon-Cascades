/**
 * One run game = a whole run driven from `startRun(seed)` to a terminal state by a bot,
 * collecting the balance telemetry the report aggregates.
 *
 * The driver steps the run one transition at a time (via `stepRunBot`) and reads the
 * BEFORE/AFTER phase pair to attribute telemetry deterministically:
 *   • entering a combat phase from a non-combat phase = a new encounter (fight/elite/boss);
 *   • a step taken FROM a combat phase = one combat turn (a "move");
 *   • a transition to `defeat` = a death, attributed to the encounter being fought.
 * It loops until the run is terminal or the safety `stepCap` is hit (recorded as `wedged`).
 * Pure and deterministic: no clock, no ambient randomness — only the seeded run engine.
 *
 * PURE ENGINE: no React / React Native imports; deterministic; never mutates input.
 */
import { currentRunNode, startRun } from '../run';
import type { EncounterKind, RunState } from '../run';
import { stepRunBot } from './runBot';
import type { RunBotName, RunDeath, RunGameResult } from './runSimTypes';

/** The encounter currently being fought — carried so a death can be attributed to it. */
interface ActiveEncounter {
  readonly kind: EncounterKind;
  readonly enemyId: string;
  readonly floor: number;
}

/** Human-readable death cause: `boss`, else `kind:baseEnemyId` (e.g. `fight:slime`). */
function causeLabel(enc: ActiveEncounter): string {
  return enc.kind === 'boss' ? 'boss' : `${enc.kind}:${enc.enemyId}`;
}

/** Drive one run to terminal (or the wedge cap), returning its balance telemetry. */
export function playRun(seed: number, bot: RunBotName, stepCap: number): RunGameResult {
  let state = startRun(seed);
  let steps = 0;
  let encounters = 0; // fights + elites entered (boss tracked separately)
  let moves = 0; // combat turns played
  let bossReached = false;
  let floorReached = 0;
  let active: ActiveEncounter | null = null;
  let death: RunDeath | null = null;

  while (state.status === 'active' && steps < stepCap) {
    const beforeKind = state.phase.kind;
    const node = currentRunNode(state);
    if (node.floor > floorReached) floorReached = node.floor;

    const next = stepRunBot(state, bot);
    steps++;

    // A step taken FROM a combat phase is one combat turn (win, loss, or ongoing).
    if (beforeKind === 'combat') moves++;

    // Entering combat from a non-combat phase = a fresh encounter.
    if (beforeKind !== 'combat' && next.phase.kind === 'combat') {
      const kind = next.phase.encounterKind;
      if (kind === 'boss') bossReached = true;
      else encounters++;
      active = { kind, enemyId: next.phase.encounter.enemyId, floor: node.floor };
    }

    // Death is attributed to the encounter in progress (only combat can kill).
    if (next.status === 'defeat' && active !== null) {
      death = { cause: causeLabel(active), encounterKind: active.kind, floor: active.floor };
    }

    state = next;
  }

  const outcome = state.status === 'victory' ? 'victory' : state.status === 'defeat' ? 'defeat' : 'wedged';

  return {
    seed,
    outcome,
    encounters,
    moves,
    gold: state.gold,
    relics: state.relicIds.length,
    bossReached,
    floorReached,
    steps,
    death,
  };
}
