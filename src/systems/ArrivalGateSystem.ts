import { arrivalGateTuning } from "../data/tuning";
import type { DockingState } from "../types/flight";

export type ArrivalGateState = {
  readonly readySinceMs: number | undefined;
};

export type ArrivalGateResult = {
  readonly state: ArrivalGateState;
  readonly readyElapsedMs: number;
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
    complete: readyElapsedMs >= stableReadyMs,
  };
}
