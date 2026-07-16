/**
 * The playable naked board: seeds the engine, renders the Skia board, turns finger
 * drags into a validated engine path, runs the move timer, and plays the cascade
 * resolution wave-by-wave. This is the container — all reusable/pure pieces live in
 * sibling modules; this file only wires them to React + gestures + Reanimated.
 *
 * Input is locked during resolution (phase `resolving`): touches are ignored until
 * the waves finish and the board settles back to `idle`.
 */
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  Easing,
  runOnJS,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  indexOf,
  resolveMove,
  tileAt,
  type Board,
  type MoveResolution,
} from '../../engine/board';
import { ANIM, MOVE_TIMER_MS, PICKUP_SCALE } from './constants';
import { BOARD_COLORS } from './colors';
import { computeBoardLayout, cellCenter, pixelToCell } from './layout';
import { resolveCommitDirection } from './hysteresis';
import {
  appendStep,
  beginPath,
  canAppendStep,
  displayBoard,
  hasSteps,
  heldPosition,
  toEnginePath,
  type DragPath,
} from './pathBuilder';
import { buildWaveViews } from './resolutionModel';
import { gameReducer, initGameState } from './gameReducer';
import { SkiaBoard, type BoardFrame } from './SkiaBoard';
import { MoveTimerBar } from './MoveTimerBar';

const DEV_SEED = 1337;
const EMPTY_CELLS: ReadonlySet<number> = new Set<number>();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function BoardScreen() {
  const { width } = useWindowDimensions();
  const layout = useMemo(() => computeBoardLayout(width), [width]);

  const [state, dispatch] = useReducer(gameReducer, DEV_SEED, initGameState);

  // Animation shared values.
  const progress = useSharedValue(1);
  const fingerX = useSharedValue(0);
  const fingerY = useSharedValue(0);
  const heldScale = useSharedValue(1);

  // Per-wave render frame + combo readout while resolving.
  const [animFrame, setAnimFrame] = useState<BoardFrame | null>(null);
  const [activeCombo, setActiveCombo] = useState(0);
  const [timerRunNonce, setTimerRunNonce] = useState(0);

  // Refs the gesture/timeout callbacks read (they run outside React's render).
  const stateRef = useRef(state);
  stateRef.current = state;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const dragRef = useRef<DragPath | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const zeroDy = useMemo(() => new Array<number>(layout.cols * layout.rows).fill(0), [layout]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function clearMoveTimeout() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  // Start/stop the ~5s move-timeout when the timer status flips. The timer starts
  // once (on the first committed step) and is never restarted by later steps.
  useEffect(() => {
    if (state.timer.status === 'running') {
      setTimerRunNonce((n) => n + 1);
      clearMoveTimeout();
      timeoutRef.current = setTimeout(onTimeout, MOVE_TIMER_MS);
    } else {
      clearMoveTimeout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.timer.status]);

  // --- Gesture handlers (JS thread) ---

  function handleDown(x: number, y: number) {
    const s = stateRef.current;
    if (s.phase !== 'idle') return;
    const cell = pixelToCell(layoutRef.current, x, y);
    if (!cell) return;
    dragRef.current = beginPath(cell);
    heldScale.value = withTiming(PICKUP_SCALE, { duration: ANIM.pickupMs });
    dispatch({ type: 'pickUp', cell });
  }

  function handleMove(x: number, y: number) {
    const s = stateRef.current;
    let d = dragRef.current;
    if (s.phase !== 'dragging' || !d) return;
    // Catch-up loop: commit steps while the finger stays past the threshold from
    // the (advancing) held centre, so a fast flick still traces the full orthogonal
    // path instead of losing cells. The ref advances synchronously so a burst of
    // gesture events before the next React render cannot double-commit a step, and
    // the loop naturally stops once the finger is inside the current dead-zone.
    // The guard is a belt-and-braces bound; `canAppendStep` (MAX_PATH_STEPS) is the
    // real cap.
    for (let guard = 0; guard < 8; guard++) {
      const center = cellCenter(layoutRef.current, heldPosition(d));
      const dir = resolveCommitDirection(center, { x, y }, layoutRef.current.pitch);
      if (!dir || !canAppendStep(s.board, d, dir)) break;
      d = appendStep(d, dir);
      dragRef.current = d;
      dispatch({ type: 'commit', dir });
    }
  }

  function handleUp() {
    const s = stateRef.current;
    heldScale.value = withTiming(1, { duration: ANIM.pickupMs });
    if (s.phase !== 'dragging') {
      dragRef.current = null;
      return;
    }
    const d = dragRef.current;
    dragRef.current = null;
    clearMoveTimeout();
    if (!d || !hasSteps(d)) {
      dispatch({ type: 'cancelDrag' });
      return;
    }
    runResolve(d);
  }

  function onTimeout() {
    const s = stateRef.current;
    if (s.phase !== 'dragging') return;
    const d = dragRef.current;
    dragRef.current = null;
    heldScale.value = withTiming(1, { duration: ANIM.pickupMs });
    if (!d || !hasSteps(d)) {
      dispatch({ type: 'cancelDrag' });
      return;
    }
    runResolve(d);
  }

  // --- Resolution ---

  function runResolve(d: DragPath) {
    const s = stateRef.current;
    dispatch({ type: 'beginResolve' });
    const postSwap = displayBoard(s.board, d);
    const resolution = resolveMove(s.board, toEnginePath(d), s.rng);
    void playResolution(resolution, postSwap);
  }

  function runProgress(durationMs: number, easing: (t: number) => number) {
    progress.value = 0;
    progress.value = withTiming(1, { duration: durationMs, easing });
  }

  async function playResolution(resolution: MoveResolution, postSwap: Board) {
    const views = buildWaveViews(postSwap, resolution);
    if (views.length === 0) {
      finishResolve(resolution);
      return;
    }

    for (const view of views) {
      if (!mountedRef.current) return;

      // Clear phase: show the pre-wave board, fade the cleared group.
      const clearing = new Set<number>(view.clearedCells.map((p) => indexOf(view.boardBefore, p)));
      setAnimFrame({
        colors: view.boardBefore.tiles,
        clearing,
        startDy: zeroDy,
        hiddenCell: null,
      });
      runProgress(ANIM.clearMs, Easing.linear);
      await delay(ANIM.clearMs);
      if (!mountedRef.current) return;

      setActiveCombo(view.cumulativeCombos);

      // Fall phase: show the post-wave board, drop falls + spawns into place.
      const startDy = new Array<number>(layoutRef.current.cols * layoutRef.current.rows).fill(0);
      for (const drop of view.drops) {
        startDy[drop.cell] = drop.dyCells * layoutRef.current.pitch;
      }
      setAnimFrame({
        colors: view.boardAfter.tiles,
        clearing: EMPTY_CELLS,
        startDy,
        hiddenCell: null,
      });
      runProgress(ANIM.fallMs, Easing.out(Easing.cubic));
      await delay(ANIM.fallMs + ANIM.waveGapMs);
    }

    finishResolve(resolution);
  }

  function finishResolve(resolution: MoveResolution) {
    dispatch({ type: 'settle', resolution });
    setAnimFrame(null);
    progress.value = 1;
  }

  function handleNewBoard() {
    if (state.phase === 'resolving') return;
    clearMoveTimeout();
    dragRef.current = null;
    setAnimFrame(null);
    setActiveCombo(0);
    progress.value = 1;
    heldScale.value = 1;
    dispatch({ type: 'newBoard', seed: state.seed + 1 });
  }

  // --- Derived render data ---

  let heldColor = null as ReturnType<typeof tileAt> | null;
  let hiddenCell: number | null = null;
  if (state.phase === 'dragging' && state.drag) {
    const held = heldPosition(state.drag);
    heldColor = tileAt(state.display, held);
    hiddenCell = indexOf(state.board, held);
  }

  const frame: BoardFrame =
    state.phase === 'resolving' && animFrame
      ? animFrame
      : {
          colors: state.display.tiles,
          clearing: EMPTY_CELLS,
          startDy: zeroDy,
          hiddenCell,
        };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin((e) => {
          'worklet';
          fingerX.value = e.x;
          fingerY.value = e.y;
          runOnJS(handleDown)(e.x, e.y);
        })
        .onUpdate((e) => {
          'worklet';
          fingerX.value = e.x;
          fingerY.value = e.y;
          runOnJS(handleMove)(e.x, e.y);
        })
        .onFinalize(() => {
          'worklet';
          runOnJS(handleUp)();
        }),
    // Handlers read refs, so a stable gesture is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const comboLabel = comboText(state.phase, activeCombo, state.lastTotalCombos);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Dungeon Cascades</Text>
        <Text style={styles.subtitle}>Stage 1 · Naked Board</Text>
      </View>

      <View style={[styles.hud, { width: layout.width }]}>
        <Text style={styles.combo}>{comboLabel}</Text>
        <MoveTimerBar
          width={layout.width}
          durationMs={MOVE_TIMER_MS}
          runNonce={timerRunNonce}
          running={state.timer.status === 'running'}
        />
      </View>

      <GestureDetector gesture={pan}>
        <View style={{ width: layout.width, height: layout.height }}>
          <SkiaBoard
            layout={layout}
            frame={frame}
            progress={progress}
            fingerX={fingerX}
            fingerY={fingerY}
            heldColor={heldColor}
            heldScale={heldScale}
          />
        </View>
      </GestureDetector>

      <Pressable
        onPress={handleNewBoard}
        disabled={state.phase === 'resolving'}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          state.phase === 'resolving' && styles.buttonDisabled,
        ]}
      >
        <Text style={styles.buttonText}>New board</Text>
      </Pressable>
    </View>
  );
}

function comboText(
  phase: string,
  activeCombo: number,
  lastTotalCombos: number | null,
): string {
  if (phase === 'resolving') {
    return activeCombo > 0 ? `Combo ×${activeCombo}` : 'Resolving…';
  }
  if (lastTotalCombos !== null) {
    if (lastTotalCombos === 0) return 'No match — try engineering a cascade';
    return `Last move: ${lastTotalCombos} combo${lastTotalCombos === 1 ? '' : 's'}`;
  }
  return 'Drag a tile to start a move';
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BOARD_COLORS.screenBg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 56,
    paddingBottom: 24,
    gap: 18,
  },
  header: {
    alignItems: 'center',
    gap: 2,
  },
  title: {
    color: BOARD_COLORS.hudText,
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: BOARD_COLORS.hudSubtle,
    fontSize: 13,
    fontWeight: '500',
  },
  hud: {
    gap: 8,
  },
  combo: {
    color: BOARD_COLORS.comboText,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    minHeight: 24,
  },
  button: {
    backgroundColor: '#2a2c46',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 14,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: BOARD_COLORS.hudText,
    fontSize: 16,
    fontWeight: '600',
  },
});
