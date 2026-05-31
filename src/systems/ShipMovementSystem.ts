import { shipTuning } from "../data/tuning";
import type { ShipControls, ShipKinematicState } from "../types/flight";
import { applyDamping, clamp, vectorLength } from "../utils/math";

export function createShipState(x: number, y: number, rotation = 0): ShipKinematicState {
  return {
    x,
    y,
    rotation,
    velocityX: 0,
    velocityY: 0,
  };
}

export function shipSpeed(state: ShipKinematicState): number {
  return vectorLength(state.velocityX, state.velocityY);
}

export function directionVector(rotation: number): { readonly x: number; readonly y: number } {
  return {
    x: Math.sin(rotation),
    y: -Math.cos(rotation),
  };
}

export function thrustVector(rotation: number): { readonly x: number; readonly y: number } {
  return directionVector(rotation);
}

export function bottomFacingRadians(rotation: number): number {
  return rotation + Math.PI;
}

export function bottomVector(rotation: number): { readonly x: number; readonly y: number } {
  return directionVector(bottomFacingRadians(rotation));
}

export function integrateShipMovement(
  state: ShipKinematicState,
  controls: ShipControls,
  deltaSeconds: number,
  tuning = shipTuning,
): ShipKinematicState {
  const dt = clamp(deltaSeconds, 0, tuning.maxDeltaSeconds);
  const rotateDirection = Number(controls.rotateRight) - Number(controls.rotateLeft);
  const rotation = state.rotation + rotateDirection * tuning.rotationSpeed * dt;
  const thrust = thrustVector(rotation);

  let velocityX = state.velocityX;
  let velocityY = state.velocityY;

  if (controls.thrust) {
    velocityX += thrust.x * tuning.thrustAcceleration * dt;
    velocityY += thrust.y * tuning.thrustAcceleration * dt;
  }

  if (controls.brake) {
    const speed = vectorLength(velocityX, velocityY);
    if (speed > 0.001) {
      const nextSpeed = Math.max(0, speed - tuning.brakeAcceleration * dt);
      const scale = nextSpeed / speed;
      velocityX *= scale;
      velocityY *= scale;
    }
  }

  velocityX = applyDamping(velocityX, tuning.linearDamping, dt);
  velocityY = applyDamping(velocityY, tuning.linearDamping, dt);

  const speed = vectorLength(velocityX, velocityY);
  if (speed > tuning.maxSoftSpeed) {
    const overspeed = clamp((speed - tuning.maxSoftSpeed) / tuning.maxSoftSpeed, 0, 1);
    const dragScale = Math.max(0, 1 - overspeed * tuning.overspeedDrag * dt);
    velocityX *= dragScale;
    velocityY *= dragScale;
  }

  return {
    x: state.x + velocityX * dt,
    y: state.y + velocityY * dt,
    rotation,
    velocityX,
    velocityY,
  };
}
