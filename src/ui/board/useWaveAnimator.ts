/**
 * Shared cascade-animation player, extracted from `BoardScreen` so BOTH the naked
 * board and the combat screen replay a resolved move identically (no forked wave
 * loop). It owns the per-wave render frame + running combo count + the 0..1
 * animation clock, and exposes `playWaves` which drives the clear→fall phases wave
 * by wave and resolves when the whole move has finished animating.
 *
 * It only REPLAYS what the engine already declared (via `buildWaveViews`); it never
 * touches match/gravity/combat rules. Presentational state only — the caller wires
 * `frame`/`progress` into `SkiaBoard` and decides what happens after the promise.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';
import { indexOf, type Board, type MoveResolution } from '../../engine/board';
import { ANIM } from './constants';
import { buildWaveViews } from './resolutionModel';
import type { BoardFrame } from './SkiaBoard';
import type { BoardLayout } from './layout';

const EMPTY_CELLS: ReadonlySet<number> = new Set<number>();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface WaveAnimator {
  /** The current per-wave frame while a move animates, or `null` at rest. */
  readonly animFrame: BoardFrame | null;
  /** Running combo count during resolution (drives the combo readout). */
  readonly activeCombo: number;
  /** The 0..1 clock the tiles read; wire straight into `SkiaBoard`. */
  readonly progress: ReturnType<typeof useSharedValue<number>>;
  /** Play a resolved move's cascade waves; resolves when the animation completes. */
  readonly playWaves: (postSwapBoard: Board, resolution: MoveResolution) => Promise<void>;
  /** Clear the animation frame/combo and park the clock at rest (progress = 1). */
  readonly reset: () => void;
}

export function useWaveAnimator(layout: BoardLayout): WaveAnimator {
  const progress = useSharedValue(1);
  const [animFrame, setAnimFrame] = useState<BoardFrame | null>(null);
  const [activeCombo, setActiveCombo] = useState(0);

  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const mountedRef = useRef(true);
  const zeroDy = useMemo(() => new Array<number>(layout.cols * layout.rows).fill(0), [layout]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function runProgress(durationMs: number, easing: (t: number) => number) {
    progress.value = 0;
    progress.value = withTiming(1, { duration: durationMs, easing });
  }

  async function playWaves(postSwapBoard: Board, resolution: MoveResolution): Promise<void> {
    const views = buildWaveViews(postSwapBoard, resolution);
    if (views.length === 0) {
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
  }

  function reset() {
    setAnimFrame(null);
    setActiveCombo(0);
    progress.value = 1;
  }

  return { animFrame, activeCombo, progress, playWaves, reset };
}
