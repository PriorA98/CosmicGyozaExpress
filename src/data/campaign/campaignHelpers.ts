import type { LandingTuning } from "../landingTuning";
import { landingTuning } from "../landingTuning";
import type { MissionPilotHints, PilotWaypoint } from "../../types/campaign";
import type { PackageConditionLabel, Point } from "../../types/flight";

/**
 * Plan §2 mapping: three authored result lines expand into the seven package-condition labels.
 * Careful → Perfect/Slightly shaken; Tumbled → Emotionally rotated/Warm but confused/Still delicious;
 * Rearranged → Dramatically rearranged/Basically fine.
 */
export function expandResultLines(careful: string, tumbled: string, rearranged: string): Record<PackageConditionLabel, string> {
  return {
    Perfect: careful,
    "Slightly shaken": careful,
    "Emotionally rotated": tumbled,
    "Warm but confused": tumbled,
    "Still delicious": tumbled,
    "Dramatically rearranged": rearranged,
    "Basically fine": rearranged,
  };
}

/** Landing tuning for a campaign landing: the Tea Moon feel with authored overrides. */
export function campaignLandingTuning(overrides: Partial<LandingTuning>): LandingTuning {
  return { ...landingTuning, ...overrides };
}

export const PILOT_DEFAULTS = {
  waypointRadius: 140,
  cruiseSpeed: 180,
  crossingSpeed: 110,
  arrivalSpeed: 40,
  obstacleLookaheadSeconds: 1.5,
  landing: { targetRelativeDescent: 38, targetTangentOffset: 0, maximumTiltRadians: 0.3 },
} as const;

export function waypoint(position: Point, targetSpeed: number = PILOT_DEFAULTS.cruiseSpeed): PilotWaypoint {
  return { position, radius: PILOT_DEFAULTS.waypointRadius, targetSpeed };
}

export function pilotHints(waypoints: readonly PilotWaypoint[]): MissionPilotHints {
  return {
    waypoints,
    arrivalSpeed: PILOT_DEFAULTS.arrivalSpeed,
    obstacleLookaheadSeconds: PILOT_DEFAULTS.obstacleLookaheadSeconds,
    landing: PILOT_DEFAULTS.landing,
  };
}

/** Default destination framing: blend the camera toward a point just before the dock. */
export function framingNear(destination: Point) {
  return { point: { x: destination.x - 200, y: destination.y }, radius: 1000, maxBlendX: 0.85, maxBlendY: 0.6 } as const;
}

export const CAMPAIGN_MAX_ENVIRONMENT_ACCELERATION = 110;

/** Every new destination's landing-gate geometry (plan §1 common rules). */
export const CAMPAIGN_DESTINATION = { radius: 150, approachRadius: 430, requiredBottomFacingRadians: Math.PI / 2 } as const;

export function rest(x: number, y: number) {
  return { x, y, rotation: Math.PI / 2, velocityX: 0, velocityY: 0 } as const;
}
