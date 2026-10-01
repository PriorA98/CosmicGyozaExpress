import { arrivalGateTuning } from "../data/tuning";
import type { DockingState } from "../types/flight";
import { clamp } from "../utils/math";

export type ArrivalGateState = {
  readonly readySinceMs: number | undefined;
};

export type ArrivalGateResult = {
  readonly state: ArrivalGateState;
  readonly readyElapsedMs: number;
  /** Landing-window fill, 0 (not holding) to 1 (complete). */
  readonly progress: number;
  readonly complete: boolean;
};

export function createArrivalGateState(): ArrivalGateState {
  return {
    readySinceMs: undefined,
  };
}

export function updateArrivalGate(
  state: ArrivalGateState,
  docking: DockingState,
  timeMs: number,
  stableReadyMs: number = arrivalGateTuning.stableReadyMs,
): ArrivalGateResult {
  if (docking.kind !== "ready") {
    return {
      state: createArrivalGateState(),
      readyElapsedMs: 0,
      progress: 0,
      complete: false,
    };
  }

  const readySinceMs = state.readySinceMs ?? timeMs;
  const readyElapsedMs = Math.max(0, timeMs - readySinceMs);

  return {
    state: {
      readySinceMs,
    },
    readyElapsedMs,
    progress: arrivalProgress(readyElapsedMs, stableReadyMs),
    complete: readyElapsedMs >= stableReadyMs,
  };
}

/** Normalised landing-window progress. A non-positive window counts as already complete. */
export function arrivalProgress(readyElapsedMs: number, stableReadyMs: number): number {
  if (stableReadyMs <= 0) return 1;
  return clamp(readyElapsedMs / stableReadyMs, 0, 1);
}

/**
 * Throttle for `flight:arrival-progress`: emit when the window starts, when it completes,
 * or when at least `intervalMs` has passed since the last emission.
 */
export function shouldEmitArrivalProgress(
  lastEmitMs: number | undefined,
  timeMs: number,
  progress: number,
  intervalMs: number,
): boolean {
  if (lastEmitMs === undefined) return true;
  if (progress >= 1) return true;
  return timeMs - lastEmitMs >= intervalMs;
}
