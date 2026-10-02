/**
 * Landing twists as pure samples: moving pad position/velocity and wind (steady / gust with shelter).
 * LandingScene and the landing aids consume the same sample, so gauges never disagree with physics.
 */
import type { GustPhase, LandingDefinition, LandingWindDefinition, Vector2 } from "../types/campaign";
import type { LandingKinematicState, LandingPadDefinition } from "../types/landing";
import { clamp } from "../utils/math";
import { sampleGustCycle } from "./ForceFieldSystem";
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
};

export type LandingEnvironmentSample = {
  readonly pad: LandingPadSample;
  readonly wind: LandingWindSample;
};

const CALM_WIND: LandingWindSample = { acceleration: { x: 0, y: 0 }, phase: "calm", envelope: 0, exposure: 1, msUntilGust: 0 };

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
  if (wind.kind === "steady") return { acceleration: wind.acceleration, phase: "sustain", envelope: 1, exposure: 1, msUntilGust: 0 };
  const gust = sampleGustCycle(wind.cycle, timeMs);
  const exposure = shelterExposure(wind, altitude);
  const scale = gust.envelope * exposure;
  return {
    acceleration: { x: wind.peakAcceleration.x * scale, y: wind.peakAcceleration.y * scale },
    phase: gust.phase,
    envelope: gust.envelope,
    exposure,
    msUntilGust: gust.msUntilGust,
  };
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
