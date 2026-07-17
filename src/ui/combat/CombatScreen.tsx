/**
 * The combat screen container: the Stage-1 board (reused canvas + drag + ~5s timer +
 * shared cascade animator) plus the enemy/player panels, turn feedback, and win/lose
 * overlays. It calls the engine's `playTurn` and renders/animates the returned
 * `TurnResolution` — ZERO combat rules are re-implemented here.
 *
 * Turn animation sequence (mirrors the engine's turn order):
 *   drag released → beginResolve (input locks) → playWaves replays the board cascade
 *   (combo readout) → boardResolved (settled board shown) → PLAYER-MOVE beat (enemy
 *   HP drops by damage, player HP rises by heal, weakness callout) → ENEMY beat (the
 *   telegraphed action fires, animating the player HP change) → turnSettled →
 *   idle / won / lost. Terminal phases lock input and show the overlay.
 */
import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue, withTiming } from 'react-native-reanimated';
import { indexOf, tileAt } from '../../engine/board';
import type { Path } from '../../engine/board';
import { playTurn } from '../../engine/combat';
import type { AffinityTable, CombatState, EnemyId, TurnResolution } from '../../engine/combat';
import { ANIM, MOVE_TIMER_MS, PICKUP_SCALE } from '../board/constants';
import { computeBoardLayout, cellCenter, pixelToCell } from '../board/layout';
import { resolveCommitDirection } from '../board/hysteresis';
import {
  appendStep,
  beginPath,
  canAppendStep,
  displayBoard,
  hasSteps,
  heldPosition,
  toEnginePath,
  type DragPath,
} from '../board/pathBuilder';
import { SkiaBoard, type BoardFrame } from '../board/SkiaBoard';
import { MoveTimerBar } from '../board/MoveTimerBar';
import { useWaveAnimator } from '../board/useWaveAnimator';
import { combatReducer, initCombatState } from './combatReducer';
import { COMBAT_COLORS } from './combatColors';
import { IMPACT_BEAT_MS, ENEMY_BEAT_MS, ROT_BEAT_MS } from './combatConstants';
import { buildImpactFeedback, enemyName, formatEnemyAction, rotSeepText } from './combatFormat';
import { enemyActSnapshot, playerMoveSnapshot, rotTickSnapshot, type HpSnapshot } from './turnAnimation';
import { EnemyPanel } from './EnemyPanel';
import { CombatStatusChips } from './CombatStatusChips';
import { PlayerPanel } from './PlayerPanel';
import { TurnFeedback, type FeedbackContent } from './TurnFeedback';
import { CombatOverlay } from './CombatOverlay';

const EMPTY_CELLS: ReadonlySet<number> = new Set<number>();
const IDLE_FEEDBACK: FeedbackContent = {
  main: 'Drag a tile — match the weakness color to hit harder',
  tone: 'neutral',
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A fresh UI-side seed for each encounter / retry (entropy for the pure engine). */
function makeSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff) >>> 0;
}

interface CombatScreenProps {
  readonly enemyId: EnemyId;
  /** Navigate back to the menu (Back-to-menu / mid-fight exit). */
  readonly onExit: () => void;
  /**
   * Seed the fight from an EXTERNALLY-MANAGED encounter (the run layer's scaled/boss enemy
   * with relic combat-start effects already applied). Omit for a standalone `/combat/[enemy]`.
   */
  readonly initialCombat?: CombatState;
  /**
   * How a released drag resolves into a turn. Defaults to the pure combat `playTurn`; the run
   * layer injects a resolver that threads relic modifiers + boss phase via `playEncounterTurn`
   * and updates the owning run state — so drafted relics visibly change the damage/heal numbers.
   */
  readonly resolveTurn?: (combat: CombatState, path: Path) => TurnResolution;
  /** Fired once when the encounter reaches a terminal phase (run layer owns the outcome flow). */
  readonly onEncounterEnd?: (status: 'won' | 'lost', finalCombat: CombatState) => void;
  /** Suppress the built-in Retry/Menu overlay (run mode renders its own victory/defeat flow). */
  readonly hideOverlay?: boolean;
  /** Enemy display overrides for the run layer (boss name/glyph, live per-phase affinity). */
  readonly enemyNameOverride?: string;
  readonly enemyGlyphOverride?: string;
  readonly enemyAffinityOverride?: AffinityTable;
  /** A run HUD strip rendered at the top of the fight (HP/gold/relics stay visible in a run). */
  readonly hudSlot?: ReactNode;
}

export function CombatScreen({
  enemyId,
  onExit,
  initialCombat,
  resolveTurn,
  onEncounterEnd,
  hideOverlay,
  enemyNameOverride,
  enemyGlyphOverride,
  enemyAffinityOverride,
  hudSlot,
}: CombatScreenProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = useMemo(() => computeBoardLayout(width), [width]);

  const seedRef = useRef(makeSeed());
  const [state, dispatch] = useReducer(
    combatReducer,
    seedRef.current,
    (seed) => initCombatState(enemyId, seed, initialCombat),
  );

  // Notify the run layer exactly once when the fight ends (won/lost); it owns what happens next.
  const endedRef = useRef(false);
  useEffect(() => {
    if (endedRef.current) return;
    if (state.phase === 'won' || state.phase === 'lost') {
      endedRef.current = true;
      onEncounterEnd?.(state.phase, state.combat);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  // Shared cascade-animation player (frame + combo + clock) — same as the board.
  const { animFrame, activeCombo, progress, playWaves, reset } = useWaveAnimator(layout);

  // Drag-specific animation shared values.
  const fingerX = useSharedValue(0);
  const fingerY = useSharedValue(0);
  const heldScale = useSharedValue(1);

  const [timerRunNonce, setTimerRunNonce] = useState(0);
  // HP to show while the enemy-acting beats play (null = read live combat HP).
  const [actingHp, setActingHp] = useState<HpSnapshot | null>(null);
  const [feedback, setFeedback] = useState<FeedbackContent>(IDLE_FEEDBACK);

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

  // Start/stop the ~5s move-timeout when the timer status flips (board convention).
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
    for (let guard = 0; guard < 8; guard++) {
      const center = cellCenter(layoutRef.current, heldPosition(d));
      const dir = resolveCommitDirection(center, { x, y }, layoutRef.current.pitch);
      if (!dir || !canAppendStep(s.combat.board, d, dir)) break;
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

  // --- Turn resolution + enemy-action animation ---

  function runResolve(d: DragPath) {
    const s = stateRef.current;
    dispatch({ type: 'beginResolve' });
    const postSwap = displayBoard(s.combat.board, d);
    const resolve = resolveTurn ?? ((combat, path) => playTurn(combat, path));
    const resolution = resolve(s.combat, toEnginePath(d));
    void animateTurn(resolution, postSwap);
  }

  async function animateTurn(resolution: TurnResolution, postSwap: Parameters<typeof playWaves>[0]) {
    // 1. Replay the board cascade (combo readout shows via activeCombo).
    await playWaves(postSwap, resolution.move);
    if (!mountedRef.current) return;

    // 2. Settled board on screen; the enemy-action beats begin.
    dispatch({ type: 'boardResolved', resolution });
    reset();

    // 2a. ROT beat (Rotwood): the turn-start DoT ticks the player down on its own line, BEFORE the
    //     move's heal/damage lands — so the rot channel is never invisible. Skipped when rot is 0.
    if (resolution.rotTick > 0) {
      setActingHp(rotTickSnapshot(resolution));
      setFeedback({ main: rotSeepText(resolution.rotTick), tone: 'enemy' });
      await delay(ROT_BEAT_MS);
      if (!mountedRef.current) return;
    }

    // 2b. PLAYER-MOVE beat: enemy takes the EFFECTIVE (post shield/armor) damage, player gains the
    //     EFFECTIVE (post curse) heal, with mitigation + weakness callouts.
    setActingHp(playerMoveSnapshot(resolution));
    setFeedback(buildImpactFeedback(resolution));
    await delay(IMPACT_BEAT_MS);
    if (!mountedRef.current) return;

    // 3. ENEMY beat: the telegraphed action fires, animating the player HP change
    //    (or the enemy self-heal). Skipped when the enemy died (no action).
    if (resolution.enemyAction) {
      setActingHp(enemyActSnapshot(resolution));
      setFeedback({ main: formatEnemyAction(enemyId, resolution.enemyAction), tone: 'enemy' });
      await delay(ENEMY_BEAT_MS);
      if (!mountedRef.current) return;
    }

    // 4. Commit the engine's next state; rest at idle / won / lost.
    dispatch({ type: 'turnSettled' });
    setActingHp(null);
    setFeedback(IDLE_FEEDBACK);
  }

  function handleRetry() {
    clearMoveTimeout();
    dragRef.current = null;
    reset();
    heldScale.value = 1;
    setActingHp(null);
    setFeedback(IDLE_FEEDBACK);
    seedRef.current = makeSeed();
    dispatch({ type: 'restart', seed: seedRef.current });
  }

  // --- Derived render data ---

  let heldColor = null as ReturnType<typeof tileAt> | null;
  let hiddenCell: number | null = null;
  if (state.phase === 'dragging' && state.drag) {
    const held = heldPosition(state.drag);
    heldColor = tileAt(state.display, held);
    hiddenCell = indexOf(state.combat.board, held);
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

  const acting = state.phase === 'enemyActing' && actingHp !== null;
  const shownPlayerHp = acting ? actingHp!.player : state.combat.playerHp;
  const shownEnemyHp = acting ? actingHp!.enemy : state.combat.enemyHp;

  const shownFeedback: FeedbackContent =
    state.phase === 'resolving'
      ? { main: activeCombo > 0 ? `Combo ×${activeCombo}` : 'Resolving…', tone: 'combo' }
      : feedback;

  const isOver = state.phase === 'won' || state.phase === 'lost';

  // The non-board chrome scrolls so a small phone (SE/mini class) can't clip the telegraph (top)
  // or the player HP (bottom). Gesture precedence — how the board drag beats the scroll:
  //   1. The board's Pan uses `minDistance(0)`, so it activates on the very first touch move,
  //      before the ScrollView reaches its own (~10pt) scroll threshold — the pan wins the touch.
  //   2. That first touch flips the phase to 'dragging' (onBegin → pickUp), which sets
  //      `scrollEnabled={false}` here, so the ScrollView cannot start scrolling mid-drag either.
  // Touches OUTSIDE an active drag (idle/resolving) leave scrolling enabled, so clipped content
  // stays reachable. Disabling scroll mid-touch does not cancel the independent Pan gesture.
  const scrollEnabled = state.phase !== 'dragging';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <View style={styles.screen}>
      <Pressable onPress={onExit} hitSlop={12} style={[styles.menuLink, { top: insets.top + 6 }]}>
        <Text style={styles.menuLinkText}>‹ Menu</Text>
      </Pressable>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 44, paddingBottom: insets.bottom + 20 },
        ]}
        scrollEnabled={scrollEnabled}
        showsVerticalScrollIndicator={false}
      >
        {hudSlot ? <View style={[styles.hudSlot, { width: layout.width }]}>{hudSlot}</View> : null}

        <EnemyPanel
          enemyId={state.enemyId}
          hp={shownEnemyHp}
          maxHp={state.combat.enemyMaxHp}
          telegraph={state.combat.telegraph}
          width={layout.width}
          nameOverride={enemyNameOverride}
          glyphOverride={enemyGlyphOverride}
          affinityOverride={enemyAffinityOverride ?? state.combat.enemy?.affinity}
        />

        <CombatStatusChips combat={state.combat} width={layout.width} />

        <TurnFeedback content={shownFeedback} />

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

        <View style={[styles.hud, { width: layout.width }]}>
          <MoveTimerBar
            width={layout.width}
            durationMs={MOVE_TIMER_MS}
            runNonce={timerRunNonce}
            running={state.timer.status === 'running'}
          />
          <PlayerPanel hp={shownPlayerHp} maxHp={state.combat.playerMaxHp} width={layout.width} />
        </View>
      </ScrollView>

      {isOver && !hideOverlay ? (
        <CombatOverlay
          status={state.phase === 'won' ? 'won' : 'lost'}
          enemyName={enemyNameOverride ?? enemyName(state.enemyId)}
          turns={state.combat.turn}
          onRetry={handleRetry}
          onMenu={onExit}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COMBAT_COLORS.screenBg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    // flexGrow + centering keeps the current centered look when content fits, and lets it scroll
    // (top-and-bottom padding via safe-area insets) when it would otherwise clip on small phones.
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  menuLink: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  menuLinkText: {
    color: COMBAT_COLORS.subtle,
    fontSize: 15,
    fontWeight: '700',
  },
  hud: {
    gap: 10,
  },
  hudSlot: {
    marginTop: -8,
  },
});
