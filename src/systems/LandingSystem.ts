import { landingTuning, type LandingTuning } from "../data/landingTuning";
import type {
  LandingIncidentKind,
  LandingIncidentTouchdownResult,
  LandingControls,
  LandingKinematicState,
  LandingPadDefinition,
  LandingTouchdownMetrics,
  LandingTouchdownResult,
} from "../types/landing";
import {
  absoluteAngleDifferenceRadians,
  applyDamping,
  clamp,
  radiansToDegrees,
} from "../utils/math";

/** Colour band the landing aids show for "if you touched down right now". */
export type LandingZone = "soft" | "bumpy" | "rough";

/** Which touchdown metric is closest to (or past) its limit; `pad` means the ship is not over the pad. */
export type LandingLimitingFactor = "descent" | "drift" | "tilt" | "pad";

export type LandingZoneReading = {
  readonly zone: LandingZone;
  readonly limiting: LandingLimitingFactor;
  readonly onPad: boolean;
  readonly altitude: number;
  readonly verticalSpeed: number;
  readonly horizontalSpeed: number;
  readonly angleDegrees: number;
  /** Descent speed mapped to 0 (hovering/rising) … 1 (gauge max) for the in-world descent gauge. */
  readonly descentGauge: number;
};

export type LandingPadAlignment = {
  /** Horizontal offset from the pad centre in half-pad units: 0 centred, ±1 at the pad edges. */
  readonly offset: number;
  readonly onPad: boolean;
  /** -1 when the pad is to the left of the ship, 1 when it is to the right, 0 when over the pad. */
  readonly directionToPad: -1 | 0 | 1;
};

export function createLandingState(tuning: LandingTuning = landingTuning): LandingKinematicState {
  return {
    x: tuning.startX,
    y: tuning.startY,
    rotation: 0,
    velocityX: 0,
    velocityY: tuning.startVelocityY,
    angularVelocity: 0,
  };
}

export function createTeaMoonLandingPad(tuning: LandingTuning = landingTuning): LandingPadDefinition {
  return {
    centerX: tuning.startX,
    surfaceY: tuning.surfaceY,
    width: tuning.padWidth,
  };
}

/** Pixels between the ship's landing feet and the surface (never negative). */
export function landingAltitude(
  state: LandingKinematicState,
  pad: LandingPadDefinition,
  tuning: LandingTuning = landingTuning,
): number {
  return Math.max(0, pad.surfaceY - (state.y + tuning.shipRadius));
}

export function integrateLandingMovement(
  state: LandingKinematicState,
  controls: LandingControls,
  deltaSeconds: number,
  tuning: LandingTuning = landingTuning,
  /** World-space wind acceleration (px/s^2), sampled by the scene. */
  wind?: { readonly x: number; readonly y: number },
  /** Moving pad velocity (px/s) for the S steady assist. */
  padVelocityX = 0,
): LandingKinematicState {
  const dt = clamp(deltaSeconds, 0, tuning.maxDeltaSeconds);
  if (dt === 0) return state;
  const direction = Number(controls.right) - Number(controls.left);
  const targetLean = controls.stabilizer ? 0 : direction * tuning.maxLeanRadians;
  const rotation = clamp(state.rotation + clamp(targetLean - state.rotation, -tuning.leanRate * dt, tuning.leanRate * dt),
    -tuning.maxLeanRadians, tuning.maxLeanRadians);

  // Incoming relative velocity keeps steady from reversing drift in a calm frame.
  const steady = controls.stabilizer
    ? clamp((padVelocityX - state.velocityX) / dt, -tuning.steadyAcceleration, tuning.steadyAcceleration)
    : 0;
  const velocityX = applyDamping(state.velocityX + (direction * tuning.lateralAcceleration + steady + (wind?.x ?? 0)) * dt,
    tuning.lateralDrag, dt);
  const velocityY = applyDamping(state.velocityY + (tuning.gravityAcceleration + (wind?.y ?? 0)
    - Number(controls.thrust) * tuning.thrusterAcceleration) * dt, tuning.linearDamping, dt);

  return {
    x: state.x + velocityX * dt,
    y: state.y + velocityY * dt,
    rotation,
    velocityX,
    velocityY,
    angularVelocity: 0,
  };
}

export function measureTouchdown(
  state: LandingKinematicState,
  pad: LandingPadDefinition,
): LandingTouchdownMetrics {
  return {
    onPad: Math.abs(state.x - pad.centerX) <= pad.width / 2,
    verticalSpeed: Math.abs(state.velocityY),
    horizontalSpeed: Math.abs(state.velocityX),
    angleDegrees: radiansToDegrees(absoluteAngleDifferenceRadians(state.rotation, 0)),
  };
}

/** Shared soft / bumpy / incident rule used by both touchdown classification and the live landing aids. */
export function classifyTouchdownMetrics(
  metrics: LandingTouchdownMetrics,
  tuning: LandingTuning = landingTuning,
): "soft" | "bumpy" | "incident" {
  if (!metrics.onPad) return "incident";

  if (
    metrics.verticalSpeed <= tuning.safeVerticalSpeed &&
    metrics.horizontalSpeed <= tuning.safeHorizontalSpeed &&
    metrics.angleDegrees <= tuning.safeAngleDegrees
  ) {
    return "soft";
  }

  if (
    metrics.verticalSpeed <= tuning.bumpyVerticalSpeed &&
    metrics.horizontalSpeed <= tuning.bumpyHorizontalSpeed &&
    metrics.angleDegrees <= tuning.bumpyAngleDegrees
  ) {
    return "bumpy";
  }

  return "incident";
}

export function classifyLandingTouchdown(
  state: LandingKinematicState,
  pad: LandingPadDefinition,
  tuning: LandingTuning = landingTuning,
): LandingTouchdownResult {
  const bottomY = state.y + tuning.shipRadius;
  if (bottomY < pad.surfaceY) {
    return { kind: "none" };
  }

  const metrics = measureTouchdown(state, pad);
  const kind = classifyTouchdownMetrics(metrics, tuning);
  if (kind === "incident") return { kind, ...metrics };
  return { kind, ...metrics };
}

export function classifyLandingIncident(
  touchdown: LandingIncidentTouchdownResult,
  tuning: LandingTuning = landingTuning,
): LandingIncidentKind {
  if (!touchdown.onPad) return "off-pad";
  if (touchdown.angleDegrees > tuning.bumpyAngleDegrees) return "tilt-tip";

  const isMostlySideways =
    touchdown.horizontalSpeed > tuning.bumpyHorizontalSpeed &&
    touchdown.horizontalSpeed >= touchdown.verticalSpeed * tuning.skidHorizontalToVerticalRatio;

  if (isMostlySideways) return "skid";

  return "hard-drop";
}

/**
 * Live "what would happen if we touched down now" reading for the in-world landing aids.
 * Uses exactly the same thresholds as `classifyLandingTouchdown`, so the colours never lie.
 */
export function readLandingZone(
  state: LandingKinematicState,
  pad: LandingPadDefinition,
  tuning: LandingTuning = landingTuning,
): LandingZoneReading {
  const metrics = measureTouchdown(state, pad);
  const classification = classifyTouchdownMetrics(metrics, tuning);
  const zone: LandingZone = classification === "incident" ? "rough" : classification;
  // Only a downward speed counts as descent; rising is always safe.
  const descending = Math.max(0, state.velocityY);

  return {
    zone,
    limiting: limitingFactor(metrics, tuning),
    onPad: metrics.onPad,
    altitude: landingAltitude(state, pad, tuning),
    verticalSpeed: metrics.verticalSpeed,
    horizontalSpeed: metrics.horizontalSpeed,
    angleDegrees: metrics.angleDegrees,
    descentGauge: clamp(descending / tuning.descentGaugeMaxSpeed, 0, 1),
  };
}

function limitingFactor(metrics: LandingTouchdownMetrics, tuning: LandingTuning): LandingLimitingFactor {
  if (!metrics.onPad) return "pad";

  const descent = metrics.verticalSpeed / tuning.safeVerticalSpeed;
  const drift = metrics.horizontalSpeed / tuning.safeHorizontalSpeed;
  const tilt = metrics.angleDegrees / tuning.safeAngleDegrees;

  if (tilt >= descent && tilt >= drift) return "tilt";
  if (drift >= descent) return "drift";
  return "descent";
}

/** Zone for one metric against its soft and bumpy limits (inclusive, like touchdown classification). */
export function thresholdZone(value: number, softLimit: number, bumpyLimit: number): LandingZone {
  if (value <= softLimit) return "soft";
  if (value <= bumpyLimit) return "bumpy";
  return "rough";
}

/** Descent-only zone; rising (negative velocityY) is always soft. */
export function descentZone(verticalSpeed: number, tuning: LandingTuning = landingTuning): LandingZone {
  return thresholdZone(Math.max(0, verticalSpeed), tuning.safeVerticalSpeed, tuning.bumpyVerticalSpeed);
}

export function driftZone(horizontalSpeed: number, tuning: LandingTuning = landingTuning): LandingZone {
  return thresholdZone(Math.abs(horizontalSpeed), tuning.safeHorizontalSpeed, tuning.bumpyHorizontalSpeed);
}

export function tiltZone(angleDegrees: number, tuning: LandingTuning = landingTuning): LandingZone {
  return thresholdZone(Math.abs(angleDegrees), tuning.safeAngleDegrees, tuning.bumpyAngleDegrees);
}

export function padAlignment(state: LandingKinematicState, pad: LandingPadDefinition): LandingPadAlignment {
  const halfWidth = pad.width / 2;
  const offset = halfWidth > 0 ? (state.x - pad.centerX) / halfWidth : 0;
  const onPad = Math.abs(offset) <= 1;
  return {
    offset,
    onPad,
    directionToPad: onPad ? 0 : offset > 0 ? -1 : 1,
  };
}

/**
 * Rests the ship on the pad after a soft/bumpy touchdown. The ship keeps its contact point (clamped onto
 * the pad) so the settle reads as one continuous motion instead of snapping to the pad centre.
 */
export function pinStateToLandingPad(
  state: LandingKinematicState,
  pad: LandingPadDefinition,
  tuning: LandingTuning = landingTuning,
): LandingKinematicState {
  const halfWidth = pad.width / 2;
  return {
    ...state,
    x: clamp(state.x, pad.centerX - halfWidth, pad.centerX + halfWidth),
    y: pad.surfaceY - tuning.shipRadius,
    rotation: 0,
    velocityX: 0,
    velocityY: 0,
    angularVelocity: 0,
  };
}
