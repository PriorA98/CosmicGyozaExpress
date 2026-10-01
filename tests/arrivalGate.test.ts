import { describe, expect, it } from "vitest";
import {
  arrivalProgress,
  createArrivalGateState,
  shouldEmitArrivalProgress,
  updateArrivalGate,
} from "../src/systems/ArrivalGateSystem";
import type { DockingState } from "../src/types/flight";

function docking(kind: DockingState["kind"]): DockingState {
  return {
    kind,
    distance: 0,
    speed: 0,
    angleDeltaRadians: 0,
    angleDeltaDegrees: 0,
    inApproachRange: true,
    inDeliveryZone: true,
  };
}

describe("arrival gate", () => {
  it("accumulates ready time until complete", () => {
    const first = updateArrivalGate(createArrivalGateState(), docking("ready"), 1000, 500);
    const second = updateArrivalGate(first.state, docking("ready"), 1290, 500);
    const third = updateArrivalGate(second.state, docking("ready"), 1510, 500);

    expect(first.complete).toBe(false);
    expect(second.readyElapsedMs).toBe(290);
    expect(second.complete).toBe(false);
    expect(third.complete).toBe(true);
  });

  it("resets when docking is no longer ready", () => {
    const ready = updateArrivalGate(createArrivalGateState(), docking("ready"), 1000, 500);
    const reset = updateArrivalGate(ready.state, docking("slow-down"), 1400, 500);

    expect(reset.readyElapsedMs).toBe(0);
    expect(reset.state.readySinceMs).toBeUndefined();
  });

  it("reports landing-window progress from 0 to 1", () => {
    const first = updateArrivalGate(createArrivalGateState(), docking("ready"), 1000, 500);
    const mid = updateArrivalGate(first.state, docking("ready"), 1250, 500);
    const done = updateArrivalGate(mid.state, docking("ready"), 1700, 500);
    const broken = updateArrivalGate(mid.state, docking("align"), 1300, 500);

    expect(first.progress).toBe(0);
    expect(mid.progress).toBeCloseTo(0.5);
    expect(done.progress).toBe(1);
    expect(broken.progress).toBe(0);
  });

  it("clamps progress and treats an empty window as complete", () => {
    expect(arrivalProgress(-20, 500)).toBe(0);
    expect(arrivalProgress(900, 500)).toBe(1);
    expect(arrivalProgress(0, 0)).toBe(1);
  });

  it("throttles progress events to the interval but always reports start and completion", () => {
    expect(shouldEmitArrivalProgress(undefined, 1000, 0, 100)).toBe(true);
    expect(shouldEmitArrivalProgress(1000, 1050, 0.1, 100)).toBe(false);
    expect(shouldEmitArrivalProgress(1000, 1100, 0.2, 100)).toBe(true);
    expect(shouldEmitArrivalProgress(1000, 1010, 1, 100)).toBe(true);
  });
});
