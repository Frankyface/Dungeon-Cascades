/**
 * The run session provider: the single owner of the live `RunState` across every run screen
 * (mounted once in `app/run/_layout.tsx`, so it survives child-route navigation). Every mutator
 * calls a PURE engine flow (via `applyRunAction` / `playEncounterTurn`), then persists the result
 * and re-routes by the run's phase (`routeForRunState`). ZERO game rules live here — the screens
 * render engine state and the provider threads it. A run drives itself off its own phase, not the
 * navigation stack, so a mid-run resume lands on exactly the right screen.
 */
import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import type { Path } from '../../engine/board';
import type { TurnResolution } from '../../engine/combat';
import { abandonRun, buyFromShop, playEncounterTurn, startRun } from '../../engine/run';
import type { BuyResult, RunState } from '../../engine/run';
import { applyRunAction, persistRun, safeApplyRunAction } from './runSession';
import { routeForRunState } from './runRoute';
import { makeRunSeed, runStore, takeStagedRun } from './runController';

/** The actions the run screens call. Combat turns go through `resolveEncounterTurn`. */
export interface RunContextValue {
  /** The live run, or null when none is staged/saved (screens redirect to the menu). */
  readonly state: RunState | null;
  /** Latest run synchronously (for callbacks that must not read a stale render closure). */
  getState(): RunState | null;
  /** Map: enter the current (unresolved) node. */
  enterCurrentNode(): void;
  /** Map: travel to a legal next node (move + enter in one step). */
  travelTo(nodeId: string): void;
  /** Draft: pick a relic (id) or skip (null). */
  pickRelic(relicId: string | null): void;
  /** Shop: buy slot `index`; returns the engine's buy result (for rejection feedback). */
  buy(index: number): BuyResult;
  /** Shop: leave. */
  leaveShopNode(): void;
  /** Event: choose option `index`. */
  chooseEvent(index: number): void;
  /** Rest: heal here (stays on the rest screen). */
  restHere(): void;
  /** Rest: leave. */
  leaveRestNode(): void;
  /** Combat: resolve one turn (relic-aware), update the run, return the animatable resolution. */
  resolveEncounterTurn(path: Path): TurnResolution;
  /** Combat: after the win/lose animation, route to the next screen by the run's new phase. */
  finishEncounter(): void;
  /** Give up the run (immediate defeat). */
  abandon(): void;
  /** Start a brand-new run in place (from a victory/defeat screen). */
  startNewRun(): void;
  /** Leave the run for the main menu (the run stays saved and resumable). */
  goToMenu(): void;
}

const RunContext = createContext<RunContextValue | null>(null);

/** Access the run session. Throws if used outside `RunProvider` (a wiring bug). */
export function useRun(): RunContextValue {
  const value = useContext(RunContext);
  if (value === null) {
    throw new Error('useRun must be used within a RunProvider');
  }
  return value;
}

export function RunProvider({ children }: { readonly children: ReactNode }) {
  const router = useRouter();
  const store = runStore();
  const [state, setState] = useState<RunState | null>(() => takeStagedRun());
  const stateRef = useRef<RunState | null>(state);
  stateRef.current = state;

  const value = useMemo<RunContextValue>(() => {
    /** Commit a new run state: update React state, keep the ref current, and persist. */
    const commit = (next: RunState): void => {
      stateRef.current = next;
      setState(next);
      persistRun(store, next);
    };
    /** Commit and re-route to the screen the new phase implies. */
    const commitAndRoute = (next: RunState): void => {
      commit(next);
      router.replace(routeForRunState(next));
    };
    /**
     * Apply a non-combat UI action to the current run, then route. Illegal actions — chiefly a
     * double-tapped button whose first tap already changed the phase — are silently ignored:
     * `safeApplyRunAction` catches the engine's phase-guard throw and reports `rejected`.
     */
    const dispatch = (action: Parameters<typeof applyRunAction>[1]): void => {
      const cur = stateRef.current;
      if (cur === null) return;
      const { state: next, rejected } = safeApplyRunAction(cur, action);
      if (rejected) return;
      commitAndRoute(next);
    };

    return {
      state,
      getState: () => stateRef.current,
      enterCurrentNode: () => dispatch({ type: 'enter' }),
      travelTo: (nodeId) => dispatch({ type: 'travel', nodeId }),
      pickRelic: (relicId) => dispatch({ type: 'draftPick', relicId }),
      buy: (index) => {
        const cur = stateRef.current;
        if (cur === null) {
          return { ok: false, reason: 'out-of-range' };
        }
        const { state: next, result } = buyFromShop(cur, index);
        if (result.ok) {
          commit(next); // a successful buy stays in the shop — no re-route
        }
        return result;
      },
      leaveShopNode: () => dispatch({ type: 'shopLeave' }),
      chooseEvent: (index) => dispatch({ type: 'eventChoice', index }),
      restHere: () => {
        const cur = stateRef.current;
        if (cur === null) return;
        // A successful rest stays on the rest screen; a double-tapped rest (already rested) is a
        // rejected no-op — the engine throws on a second rest, which safeApplyRunAction swallows.
        const { state: next, rejected } = safeApplyRunAction(cur, { type: 'rest' });
        if (!rejected) commit(next);
      },
      leaveRestNode: () => dispatch({ type: 'restLeave' }),
      resolveEncounterTurn: (path) => {
        const cur = stateRef.current;
        if (cur === null || cur.phase.kind !== 'combat') {
          throw new Error('resolveEncounterTurn called outside a combat phase');
        }
        const { state: next, resolution } = playEncounterTurn(cur, path);
        commit(next); // update HP/gold/phase now; navigation waits for finishEncounter
        return resolution;
      },
      finishEncounter: () => {
        const cur = stateRef.current;
        if (cur !== null) {
          router.replace(routeForRunState(cur));
        }
      },
      abandon: () => {
        const cur = stateRef.current;
        if (cur === null) return;
        commitAndRoute(abandonRun(cur));
      },
      startNewRun: () => {
        const fresh = startRun(makeRunSeed());
        commit(fresh);
        router.replace('/run');
      },
      goToMenu: () => router.replace('/'),
    };
  }, [state, store, router]);

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>;
}
