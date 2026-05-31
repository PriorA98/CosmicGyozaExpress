import { landingTuning } from "../data/tuning";
import type {
  LandingIncidentKind,
  LandingIncidentTouchdownResult,
  LandingControls,
  LandingKinematicState,
  LandingPadDefinition,
  LandingTouchdownResult,
} from "../types/landing";
import {
  absoluteAngleDifferenceRadians,
  applyDamping,
  clamp,
  radiansToDegrees,
  shortestAngleDifferenceRadians,
} from "../utils/math";
import { thrustVector } from "./ShipMovementSystem";

export function createLandingState(
  tuning = landingTuning,
): LandingKinematicState {
  return {
    x: tuning.startX,
    y: tuning.startY,
    rotation: 0,
    velocityX: 0,
    velocityY: tuning.startVelocityY,
    angularVelocity: 0,
  };
}

export function createTeaMoonLandingPad(tuning = landingTuning): LandingPadDefinition {
  return {
    centerX: tuning.startX,
    surfaceY: tuning.surfaceY,
    width: tuning.padWidth,
  };
}

export function integrateLandingMovement(
  state: LandingKinematicState,
  controls: LandingControls,
  deltaSeconds: number,
  tuning = landingTuning,
): LandingKinematicState {
  const dt = clamp(deltaSeconds, 0, tuning.maxDeltaSeconds);
  const rotateDirection = Number(controls.rotateRight) - Number(controls.rotateLeft);

  let angularVelocity = state.angularVelocity + rotateDirection * tuning.rotationAcceleration * dt;

  if (controls.stabilizer) {
    const uprightCorrection = shortestAngleDifferenceRadians(0, state.rotation);
    angularVelocity += uprightCorrection * tuning.stabilizerUprightStrength * dt;
    angularVelocity = applyDamping(angularVelocity, tuning.stabilizerAngularDamping, dt);
  }

  angularVelocity = applyDamping(angularVelocity, tuning.angularDamping, dt);
  const rotation = state.rotation + angularVelocity * dt;

  let velocityX = state.velocityX;
  let velocityY = state.velocityY + tuning.gravityAcceleration * dt;

  if (controls.thrust) {
    const thrust = thrustVector(rotation);
    velocityX += thrust.x * tuning.thrusterAcceleration * dt;
    velocityY += thrust.y * tuning.thrusterAcceleration * dt;
  }

  velocityX = applyDamping(velocityX, tuning.linearDamping, dt);
  velocityY = applyDamping(velocityY, tuning.linearDamping, dt);

  return {
    x: state.x + velocityX * dt,
    y: state.y + velocityY * dt,
    rotation,
    velocityX,
    velocityY,
    angularVelocity,
  };
}

export function classifyLandingTouchdown(
  state: LandingKinematicState,
  pad: LandingPadDefinition,
  tuning = landingTuning,
): LandingTouchdownResult {
  const bottomY = state.y + tuning.shipRadius;
  if (bottomY < pad.surfaceY) {
    return { kind: "none" };
  }

  const halfPad = pad.width / 2;
  const onPad = Math.abs(state.x - pad.centerX) <= halfPad;
  const verticalSpeed = Math.abs(state.velocityY);
  const horizontalSpeed = Math.abs(state.velocityX);
  const angleDegrees = radiansToDegrees(absoluteAngleDifferenceRadians(state.rotation, 0));

  if (
    onPad &&
    verticalSpeed <= tuning.safeVerticalSpeed &&
    horizontalSpeed <= tuning.safeHorizontalSpeed &&
    angleDegrees <= tuning.safeAngleDegrees
  ) {
    return {
      kind: "soft",
      onPad,
      verticalSpeed,
      horizontalSpeed,
      angleDegrees,
    };
  }

  if (
    onPad &&
    verticalSpeed <= tuning.bumpyVerticalSpeed &&
    horizontalSpeed <= tuning.bumpyHorizontalSpeed &&
    angleDegrees <= tuning.bumpyAngleDegrees
  ) {
    return {
      kind: "bumpy",
      onPad,
      verticalSpeed,
      horizontalSpeed,
      angleDegrees,
    };
  }

  return {
    kind: "incident",
    onPad,
    verticalSpeed,
    horizontalSpeed,
    angleDegrees,
  };
}

export function classifyLandingIncident(
  touchdown: LandingIncidentTouchdownResult,
  tuning = landingTuning,
): LandingIncidentKind {
  if (!touchdown.onPad) return "off-pad";
  if (touchdown.angleDegrees > tuning.bumpyAngleDegrees) return "tilt-tip";

  const isMostlySideways =
    touchdown.horizontalSpeed > tuning.bumpyHorizontalSpeed &&
    touchdown.horizontalSpeed >= touchdown.verticalSpeed * 0.58;

  if (isMostlySideways) return "skid";

  return "hard-drop";
}

export function pinStateToLandingPad(
  state: LandingKinematicState,
  pad: LandingPadDefinition,
  tuning = landingTuning,
): LandingKinematicState {
  return {
    ...state,
    x: pad.centerX,
    y: pad.surfaceY - tuning.shipRadius,
    rotation: 0,
    velocityX: 0,
    velocityY: 0,
    angularVelocity: 0,
  };
}
