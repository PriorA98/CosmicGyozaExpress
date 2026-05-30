import { describe, expect, it } from "vitest";
import { dockingTuning } from "../src/data/tuning";
import { evaluateDocking } from "../src/systems/DockingSystem";
import type { FlightDestinationDefinition, ShipKinematicState } from "../src/types/flight";

const destination: FlightDestinationDefinition = {
  id: "test-dock",
  label: "Test dock",
  x: 100,
  y: 100,
  radius: 50,
  approachRadius: 150,
  requiredFacingRadians: Math.PI / 2,
};

function ship(overrides: Partial<ShipKinematicState>): ShipKinematicState {
  return {
    x: 100,
    y: 100,
    rotation: Math.PI / 2,
    velocityX: 0,
    velocityY: 0,
    ...overrides,
  };
}

describe("docking readiness", () => {
  it("reports too far outside the approach radius", () => {
    expect(evaluateDocking(ship({ x: 400 }), destination).kind).toBe("too-far");
  });

  it("reports approaching inside approach radius but outside the delivery zone", () => {
    expect(evaluateDocking(ship({ x: 220 }), destination).kind).toBe("approaching");
  });

  it("reports slow down inside the delivery zone when speed is high", () => {
    expect(evaluateDocking(ship({ velocityX: dockingTuning.maxSpeed + 1 }), destination).kind).toBe("slow-down");
  });

  it("reports align inside the delivery zone when facing is outside tolerance", () => {
    expect(evaluateDocking(ship({ rotation: Math.PI }), destination).kind).toBe("align");
  });

  it("reports ready when distance, speed, and angle are valid", () => {
    expect(evaluateDocking(ship({}), destination).kind).toBe("ready");
  });

  it("handles angle wraparound around zero", () => {
    const wrapDestination: FlightDestinationDefinition = {
      ...destination,
      requiredFacingRadians: 0,
    };

    expect(evaluateDocking(ship({ rotation: Math.PI * 2 - 0.05 }), wrapDestination).kind).toBe("ready");
  });
});
