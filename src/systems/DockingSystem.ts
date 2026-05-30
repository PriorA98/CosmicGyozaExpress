import { dockingTuning } from "../data/tuning";
import type { DockingState, FlightDestinationDefinition, ShipKinematicState } from "../types/flight";
import { absoluteAngleDifferenceRadians, distanceBetween, radiansToDegrees } from "../utils/math";
import { shipSpeed } from "./ShipMovementSystem";

export function evaluateDocking(
  ship: ShipKinematicState,
  destination: FlightDestinationDefinition,
  tuning = dockingTuning,
): DockingState {
  const distance = distanceBetween(ship, destination);
  const speed = shipSpeed(ship);
  const angleDeltaRadians = absoluteAngleDifferenceRadians(ship.rotation, destination.requiredFacingRadians);
  const angleDeltaDegrees = radiansToDegrees(angleDeltaRadians);
  const inApproachRange = distance <= destination.approachRadius;
  const inDeliveryZone = distance <= destination.radius;

  if (!inApproachRange) {
    return {
      kind: "too-far",
      distance,
      speed,
      angleDeltaRadians,
      angleDeltaDegrees,
      inApproachRange,
      inDeliveryZone,
    };
  }

  if (!inDeliveryZone) {
    return {
      kind: "approaching",
      distance,
      speed,
      angleDeltaRadians,
      angleDeltaDegrees,
      inApproachRange,
      inDeliveryZone,
    };
  }

  if (speed > tuning.maxSpeed) {
    return {
      kind: "slow-down",
      distance,
      speed,
      angleDeltaRadians,
      angleDeltaDegrees,
      inApproachRange,
      inDeliveryZone,
    };
  }

  if (angleDeltaDegrees > tuning.maxAngleDegrees) {
    return {
      kind: "align",
      distance,
      speed,
      angleDeltaRadians,
      angleDeltaDegrees,
      inApproachRange,
      inDeliveryZone,
    };
  }

  return {
    kind: "ready",
    distance,
    speed,
    angleDeltaRadians,
    angleDeltaDegrees,
    inApproachRange,
    inDeliveryZone,
  };
}

export function dockingStatusLabel(state: DockingState): string {
  switch (state.kind) {
    case "too-far":
      return "too far";
    case "approaching":
      return "approaching";
    case "slow-down":
      return "slow down";
    case "align":
      return "align";
    case "ready":
      return "ready";
  }
}

export function dockingHint(state: DockingState): string {
  switch (state.kind) {
    case "too-far":
      return "tea moon beacon is waiting";
    case "approaching":
      return "delivery ring ahead";
    case "slow-down":
      return "too spicy for docking";
    case "align":
      return "rotate the dumpling gently";
    case "ready":
      return "dock is ready";
  }
}
