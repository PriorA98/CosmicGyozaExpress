import { describe, expect, it } from "vitest";
import { shipTuning } from "../src/data/tuning";
import { integrateShipMovement, shipSpeed } from "../src/systems/ShipMovementSystem";
import type { ShipControls, ShipKinematicState } from "../src/types/flight";

const idleControls: ShipControls = {
  thrust: false,
  brake: false,
  rotateLeft: false,
  rotateRight: false,
};

const originState: ShipKinematicState = {
  x: 0,
  y: 0,
  rotation: 0,
  velocityX: 0,
  velocityY: 0,
};

describe("ship movement integration", () => {
  it("adds thrust in the ship-facing direction", () => {
    const next = integrateShipMovement(originState, { ...idleControls, thrust: true }, 1 / 10);

    expect(next.velocityX).toBeCloseTo(0);
    expect(next.velocityY).toBeLessThan(0);
    expect(next.y).toBeLessThan(0);
  });

  it("keeps drifting when thrust is released", () => {
    const drifting: ShipKinematicState = {
      ...originState,
      velocityX: 100,
      velocityY: 0,
    };

    const next = integrateShipMovement(drifting, idleControls, 1 / 10);

    expect(next.velocityX).toBeGreaterThan(0);
    expect(next.x).toBeGreaterThan(0);
  });

  it("brakes against current velocity without reversing instantly", () => {
    const moving: ShipKinematicState = {
      ...originState,
      velocityX: 160,
      velocityY: 0,
    };

    const next = integrateShipMovement(moving, { ...idleControls, brake: true }, 1 / 10);

    expect(next.velocityX).toBeGreaterThanOrEqual(0);
    expect(next.velocityX).toBeLessThan(moving.velocityX);
  });

  it("soft-caps overspeed gradually", () => {
    const overspeed: ShipKinematicState = {
      ...originState,
      velocityX: shipTuning.maxSoftSpeed * 2,
      velocityY: 0,
    };

    const next = integrateShipMovement(overspeed, idleControls, 1 / 10);

    expect(shipSpeed(next)).toBeLessThan(shipSpeed(overspeed));
    expect(shipSpeed(next)).toBeGreaterThan(shipTuning.maxSoftSpeed);
  });

  it("clamps unusually large deltas", () => {
    const next = integrateShipMovement(originState, { ...idleControls, thrust: true }, 10);
    const expectedVelocity = shipTuning.thrustAcceleration * shipTuning.maxDeltaSeconds;

    expect(Math.abs(next.velocityY)).toBeCloseTo(expectedVelocity, 0);
  });
});
