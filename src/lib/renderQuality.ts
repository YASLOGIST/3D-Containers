/**
 * GPU render-target sizing, independent from CAD coordinates and cargo maths.
 * The budget is an upper target for *screen shading*, not export resolution.
 * Print-quality PNG export can temporarily raise DPR and restore it afterward.
 */
export const PIXEL_BUDGET = {
  touch: 1_500_000,
  desktop: 3_200_000,
} as const;

const MAX_DPR = 2;
const MIN_DPR = 0.55;
const MIN_DYNAMIC_SCALE = 0.65;

/** Pixel ratio for an initial viewport, with a bounded physical pixel budget. */
export function pixelRatioForViewport(
  width: number,
  height: number,
  devicePixelRatio: number,
  touchFirst: boolean,
): number {
  const w = Number.isFinite(width) && width > 0 ? width : 1;
  const h = Number.isFinite(height) && height > 0 ? height : 1;
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
    ? devicePixelRatio : 1;
  const budget = touchFirst ? PIXEL_BUDGET.touch : PIXEL_BUDGET.desktop;
  const maxFromBudget = Math.sqrt(budget / (w * h));
  // Never let a huge 4K viewport silently allocate a massive GPU buffer.
  return Math.max(MIN_DPR, Math.min(MAX_DPR, dpr, maxFromBudget));
}

export interface ResolutionAdaptation {
  scale: number;
  lowFpsSeconds: number;
  recoveredSeconds: number;
}

/** Hysteretic quality controller; one change per completed perf sample. */
export function stepAdaptiveResolution(
  previous: ResolutionAdaptation,
  fps: number,
  sampleSeconds: number,
): ResolutionAdaptation {
  if (!Number.isFinite(fps) || fps < 0
      || !Number.isFinite(sampleSeconds) || sampleSeconds <= 0) {
    return { ...previous };
  }
  let { scale, lowFpsSeconds, recoveredSeconds } = previous;
  if (fps < 42) {
    lowFpsSeconds += sampleSeconds;
    recoveredSeconds = 0;
  } else if (fps > 55) {
    recoveredSeconds += sampleSeconds;
    lowFpsSeconds = 0;
  } else {
    lowFpsSeconds = 0;
    recoveredSeconds = 0;
  }

  if (lowFpsSeconds > 1.5 && scale > MIN_DYNAMIC_SCALE) {
    scale = Math.max(MIN_DYNAMIC_SCALE, Math.round((scale - 0.15) * 100) / 100);
    lowFpsSeconds = 0;
  } else if (recoveredSeconds > 8 && scale < 1) {
    scale = Math.min(1, Math.round((scale + 0.10) * 100) / 100);
    recoveredSeconds = 0;
  }
  return { scale, lowFpsSeconds, recoveredSeconds };
}
