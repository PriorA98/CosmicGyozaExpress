/**
 * Landing twists as pure samples: moving pad position/velocity and wind (steady / gust with shelter).
 * LandingScene and the landing aids consume the same sample, so gauges never disagree with physics.
 */
import type { GustPhase, LandingDefinition, LandingWindDefinition, Vector2 } from "../types/campaign";
import type { LandingTuning } from "../data/landingTuning";
import type { LandingKinematicState, LandingPadDefinition, LandingTouchdownResult } from "../types/landing";
import { clamp } from "../utils/math";
import { classifyLandingTouchdown, readLandingZone, type LandingZoneReading } from "./LandingSystem";
import { sampleGustCycle, smoothstep } from "./ForceFieldSystem";
import { sampleMotionPath } from "./MotionPathSystem";

export type LandingPadSample = {
  readonly pad: LandingPadDefinition;
  /** px/s, world frame. */
  readonly velocity: Vector2;
};

export type LandingWindSample = {
  readonly acceleration: Vector2;
  readonly phase: GustPhase;
  /** 0..1 strength before shelter. */
  readonly envelope: number;
  /** 0 fully sheltered … 1 fully exposed. */
  readonly exposure: number;
  /** ms until the next gust attack (gust wind only, else 0). */
  readonly msUntilGust: number;
  /** Sign of the current (calm: coming) gust for alternating cycles; 1 otherwise. */
  readonly direction: 1 | -1;
};

export type LandingEnvironmentSample = {
  readonly pad: LandingPadSample;
  readonly wind: LandingWindSample;
};

const CALM_WIND: LandingWindSample = { acceleration: { x: 0, y: 0 }, phase: "calm", envelope: 0, exposure: 1, msUntilGust: 0, direction: 1 };

export function sampleLandingPad(definition: LandingDefinition, timeMs: number): LandingPadSample {
  if (definition.padMotion.kind === "fixed") return { pad: definition.pad, velocity: { x: 0, y: 0 } };
  const motion = sampleMotionPath(definition.padMotion.path, timeMs);
  return {
    pad: { centerX: motion.position.x, surfaceY: motion.position.y, width: definition.pad.width },
    velocity: motion.velocity,
  };
}

/** Shelter exposure at `altitude` px above the pad: 0 at/below calmBelow, 1 at/above fullyExposed. */
export function shelterExposure(wind: LandingWindDefinition, altitude: number): number {
  if (wind.kind !== "gust" || wind.shelter === null) return 1;
  const { calmBelowAltitude, fullyExposedAltitude } = wind.shelter;
  if (fullyExposedAltitude <= calmBelowAltitude) return altitude > calmBelowAltitude ? 1 : 0;
  return clamp((altitude - calmBelowAltitude) / (fullyExposedAltitude - calmBelowAltitude), 0, 1);
}

export function sampleLandingWind(wind: LandingWindDefinition, altitude: number, timeMs: number): LandingWindSample {
  if (wind.kind === "none") return CALM_WIND;
  if (wind.kind === "steady") return { acceleration: wind.acceleration, phase: "sustain", envelope: 1, exposure: 1, msUntilGust: 0, direction: 1 };
  if (wind.kind === "bands") {
    const upper = bandsUpperShare(wind, altitude);
    return {
      acceleration: { x: wind.lower.x + (wind.upper.x - wind.lower.x) * upper, y: wind.lower.y + (wind.upper.y - wind.lower.y) * upper },
      phase: "sustain",
      envelope: 1,
      exposure: 1,
      msUntilGust: 0,
      direction: 1,
    };
  }
  const gust = sampleGustCycle(wind.cycle, timeMs);
  const exposure = shelterExposure(wind, altitude);
  const scale = gust.envelope * exposure * gust.direction;
  return {
    acceleration: { x: wind.peakAcceleration.x * scale, y: wind.peakAcceleration.y * scale },
    phase: gust.phase,
    envelope: gust.envelope,
    exposure,
    msUntilGust: gust.msUntilGust,
    direction: gust.direction,
  };
}

/** Banded mist: 0 = fully in the lower layer, 1 = fully in the upper layer (smooth across `blendPx`). */
export function bandsUpperShare(wind: Extract<LandingWindDefinition, { kind: "bands" }>, altitude: number): number {
  const half = Math.max(1, wind.blendPx / 2);
  return smoothstep(wind.splitAltitude - half, wind.splitAltitude + half, altitude);
}

export function sampleLandingEnvironment(
  definition: LandingDefinition,
  state: LandingKinematicState,
  timeMs: number,
): LandingEnvironmentSample {
  const pad = sampleLandingPad(definition, timeMs);
  const altitude = Math.max(0, pad.pad.surfaceY - (state.y + definition.tuning.shipRadius));
  return { pad, wind: sampleLandingWind(definition.wind, altitude, timeMs) };
}

/** Ship state expressed in the pad's frame (velocity minus pad velocity) for relative-pad classification. */
export function padRelativeState(state: LandingKinematicState, pad: LandingPadSample): LandingKinematicState {
  return { ...state, velocityX: state.velocityX - pad.velocity.x, velocityY: state.velocityY - pad.velocity.y };
}

// --- Contact model helpers (plan §3 "Moving collisions and landing contact") -----------------------

/**
 * The ship state the touchdown rules and the landing aids measure. Tea Moon (`legacy-horizontal`) keeps the
 * world-frame state; new landings subtract the sampled pad velocity so drift is judged against the pad.
 */
export function landingContactState(
  model: LandingDefinition["collisionModel"],
  state: LandingKinematicState,
  pad: LandingPadSample,
): LandingKinematicState {
  return model === "legacy-horizontal" ? state : padRelativeState(state, pad);
}

/** Touchdown classification in the contact model's frame (same soft / bumpy / incident thresholds). */
export function classifyPadTouchdown(
  model: LandingDefinition["collisionModel"],
  state: LandingKinematicState,
  pad: LandingPadSample,
  tuning: LandingTuning,
): LandingTouchdownResult {
  return classifyLandingTouchdown(landingContactState(model, state, pad), pad.pad, tuning);
}

/** Live gauge reading from exactly the metrics `classifyPadTouchdown` would use right now. */
export function readPadLandingZone(
  model: LandingDefinition["collisionModel"],
  state: LandingKinematicState,
  pad: LandingPadSample,
  tuning: LandingTuning,
): LandingZoneReading {
  return readLandingZone(landingContactState(model, state, pad), pad.pad, tuning);
}

/** Tangent offset (px from the pad centre) stored when a touchdown is accepted; clamped onto the pad. */
export function acceptedPadOffset(state: LandingKinematicState, pad: LandingPadDefinition): number {
  const half = pad.width / 2;
  return clamp(state.x - pad.centerX, -half, half);
}

/** Settling on a (moving) pad: the resting ship is rebuilt from the sampled pad and the accepted offset. */
export function rideLandingPad(offsetX: number, pad: LandingPadDefinition, tuning: LandingTuning): LandingKinematicState {
  const half = pad.width / 2;
  return {
    x: pad.centerX + clamp(offsetX, -half, half),
    y: pad.surfaceY - tuning.shipRadius,
    rotation: 0,
    velocityX: 0,
    velocityY: 0,
    angularVelocity: 0,
  };
}

/** Windsock strip frame for a wind sample (the sock and the force read the same sample). */
export type WindsockFrame = "calm" | "warning" | "medium" | "strong";

export function windsockFrameFor(wind: LandingWindSample, peakMagnitude: number): WindsockFrame {
  if (wind.exposure <= 0) return "calm";
  const magnitude = Math.hypot(wind.acceleration.x, wind.acceleration.y);
  if (magnitude <= 1e-6) return wind.phase === "warning" ? "warning" : "calm";
  const share = peakMagnitude > 0 ? magnitude / peakMagnitude : 1;
  return share >= 0.55 ? "strong" : "medium";
}

/** Peak wind magnitude a landing can produce (px/s²); 0 for still air. */
export function landingWindPeak(wind: LandingWindDefinition): number {
  if (wind.kind === "none") return 0;
  if (wind.kind === "steady") return Math.hypot(wind.acceleration.x, wind.acceleration.y);
  if (wind.kind === "bands") return Math.max(Math.hypot(wind.upper.x, wind.upper.y), Math.hypot(wind.lower.x, wind.lower.y));
  return Math.hypot(wind.peakAcceleration.x, wind.peakAcceleration.y);
}

/** Which mission dashboard line (MissionDashboardCopy) the landing HUD should show; null = generic chatter. */
export type CampaignLandingNote = "landingIntro" | "landingTwist" | "gustWarning" | "landingCalm";

export function campaignLandingNote(input: {
  readonly definition: LandingDefinition;
  readonly clockMs: number;
  readonly wind: LandingWindSample;
  readonly altitude: number;
  readonly introNoteMs: number;
  readonly calmAltitude: number;
}): CampaignLandingNote | null {
  const { definition, wind } = input;
  if (definition.wind.kind === "gust") {
    if (wind.exposure <= 0) return "landingCalm";
    if (wind.phase === "warning") return "gustWarning";
    if (wind.envelope > 0) return "landingTwist";
    if (input.clockMs < input.introNoteMs) return "landingIntro";
    return null;
  }
  if (input.clockMs < input.introNoteMs) return "landingIntro";
  if (definition.wind.kind === "steady" || definition.wind.kind === "bands" || definition.padMotion.kind === "path") return "landingTwist";
  return input.altitude < input.calmAltitude ? "landingCalm" : "landingTwist";
}
