import { describe, expect, it } from "vitest";
import { createArrivalGateState, updateArrivalGate } from "../src/systems/ArrivalGateSystem";
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
});
