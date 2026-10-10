/**
 * Campaign autopilot (dev / test only). One controller drives both the pure route simulation (tests) and the
 * real-keyboard e2e playtest, which transpiles this file in Node. Imports must stay relative and pure.
 *
 * Beyond waypoint cruising it understands the phase-4 hints:
 *  - `hold`: park at the waypoint and wait until the straight crossing to the next waypoint is predicted
 *    clear of moving rocks and strong gusts (rocks and gust cycles are pure functions of sim time);
 *  - `quiet`: keep thrust in short taps so tea-koi stay asleep.
 */
import { landingTuning, type LandingTuning } from "../data/landingTuning";
import type { FlightRouteDefinition, MissionPilotHints, PilotWaypoint } from "../types/campaign";
import type { Point, ShipKinematicState } from "../types/flight";
import { sampleForceZone } from "../systems/ForceFieldSystem";
import { sampleMotionPath } from "../systems/MotionPathSystem";

export type PilotObstacle = { readonly id: string; readonly x: number; readonly y: number; readonly vx: number; readonly vy: number; readonly radius: number };

export type PilotFlightInput = {
  readonly ship: ShipKinematicState;
  readonly simTimeMs: number;
  readonly environment: { readonly ax: number; readonly ay: number } | null;
  readonly movingObstacles: readonly PilotObstacle[];
  readonly seekers: readonly (PilotObstacle & { readonly mode: string })[];
  readonly destination: FlightRouteDefinition["destination"];
};

export type PilotProgress = {
  waypoint: number;
  dock: boolean;
  /** Waypoint indexes whose hold has been released. */
  released: Set<number>;
  /** Pilot-side leaky thrust meter for quiet legs (ms). */
  noiseMs: number;
  lastSimMs: number | null;
  holding: boolean;
};

export type PilotControls = {
  readonly thrust: boolean;
  readonly brake: boolean;
  readonly left: boolean;
  readonly right: boolean;
  readonly phase: "dock" | "hold" | "cruise" | "avoid";
  readonly waypoint: number;
};

export const pilotTuning = {
  shipRadius: 42,
  avoidClearancePx: 32,
  holdSpeed: 24,
  /** Crossing prediction: clearance kept from every rock along the whole crossing (px). */
  crossingMarginPx: 46,
  /** A gust push above this (px/s²) anywhere on the crossing blocks it. */
  crossingGustLimit: 70,
  crossingSampleMs: 80,
  /** Effective acceleration while setting off (thrust minus turning losses), px/s². */
  crossingAcceleration: 360,
  reactionMs: 120,
  crossingTailMs: 700,
  /** Quiet legs: thrust only while the pilot's own meter is below this (ms); it drains at half speed. */
  quietBudgetMs: 200,
  quietDrain: 0.33,
} as const;

export function createPilotProgress(): PilotProgress {
  return { waypoint: 0, dock: false, released: new Set(), noiseMs: 0, lastSimMs: null, holding: false };
}

const wrapAngle = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle));
const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));

function closestApproach(ship: ShipKinematicState, obstacle: PilotObstacle, horizon: number) {
  const dx = obstacle.x - ship.x;
  const dy = obstacle.y - ship.y;
  const vx = obstacle.vx - ship.velocityX;
  const vy = obstacle.vy - ship.velocityY;
  const t = clamp(-(dx * vx + dy * vy) / Math.max(1, vx * vx + vy * vy), 0, horizon);
  return { t, dx: dx + vx * t, dy: dy + vy * t, clearance: Math.hypot(dx + vx * t, dy + vy * t) - pilotTuning.shipRadius - obstacle.radius };
}

/**
 * Predicts a straight crossing from `from` to `to`, cruising at `speed`: the ship first turns (`headingError`
 * rad at the flight rotation speed), then accelerates at `crossingAcceleration`. True when every moving rock
 * keeps `crossingMarginPx` all along, and no gust pushes harder than `crossingGustLimit`, including a short
 * tail after arrival.
 */
export function crossingClear(route: FlightRouteDefinition, from: Point, to: Point, speed: number, simTimeMs: number, headingError = 0): boolean {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const cruise = Math.max(30, speed);
  const turnMs = (Math.abs(headingError) / 3.7) * 1000 + pilotTuning.reactionMs;
  const accelMs = (cruise / pilotTuning.crossingAcceleration) * 1000;
  const accelDistance = 0.5 * pilotTuning.crossingAcceleration * (accelMs / 1000) ** 2;
  const travelMs = accelDistance >= length
    ? Math.sqrt((2 * length) / pilotTuning.crossingAcceleration) * 1000
    : accelMs + ((length - accelDistance) / cruise) * 1000;
  const durationMs = turnMs + travelMs + pilotTuning.crossingTailMs;
  const along = (t: number): number => {
    const moving = Math.max(0, t - turnMs) / 1000;
    const d = moving <= accelMs / 1000 ? 0.5 * pilotTuning.crossingAcceleration * moving * moving : accelDistance + (moving - accelMs / 1000) * cruise;
    return clamp(d / Math.max(1, length), 0, 1);
  };
  for (let t = 0; t <= durationMs; t += pilotTuning.crossingSampleMs) {
    const u = along(t);
    const p = { x: from.x + (to.x - from.x) * u, y: from.y + (to.y - from.y) * u };
    const at = simTimeMs + t;
    for (const rock of route.movingObstacles) {
      const sample = sampleMotionPath(rock.path, at);
      if (Math.hypot(sample.position.x - p.x, sample.position.y - p.y) - rock.radius - pilotTuning.shipRadius < pilotTuning.crossingMarginPx) return false;
    }
    for (const zone of route.forceZones) {
      if (zone.kind !== "gust") continue;
      const push = sampleForceZone(zone, p, at).acceleration;
      if (Math.hypot(push.x, push.y) > pilotTuning.crossingGustLimit) return false;
    }
  }
  return true;
}

function waypointAt(hints: MissionPilotHints, index: number): PilotWaypoint | undefined {
  return hints.waypoints[index];
}

export function pilotFlightControls(s: PilotFlightInput, route: FlightRouteDefinition, hints: MissionPilotHints, progress: PilotProgress): PilotControls {
  const ship = s.ship;
  const dtMs = progress.lastSimMs === null ? 0 : Math.max(0, s.simTimeMs - progress.lastSimMs);
  progress.lastSimMs = s.simTimeMs;
  const speed = Math.hypot(ship.velocityX, ship.velocityY);
  const dockDistance = Math.hypot(s.destination.x - ship.x, s.destination.y - ship.y);
  const waypoints = hints.waypoints;

  // Advance past reached waypoints; a hold waypoint only advances once its crossing is released.
  for (;;) {
    const current = waypointAt(hints, progress.waypoint);
    if (!current || progress.waypoint >= waypoints.length - 1) break;
    if (Math.hypot(current.position.x - ship.x, current.position.y - ship.y) >= current.radius) break;
    if (current.hold && !progress.released.has(progress.waypoint)) {
      const next = waypointAt(hints, progress.waypoint + 1);
      const settled = speed < pilotTuning.holdSpeed * 1.6;
      const heading = next ? wrapAngle(Math.atan2(next.position.x - ship.x, -(next.position.y - ship.y)) - ship.rotation) : 0;
      if (!next || !settled || !crossingClear(route, ship, next.position, next.targetSpeed, s.simTimeMs, heading)) break;
      progress.released.add(progress.waypoint);
    }
    progress.waypoint += 1;
  }
  const waypoint = waypointAt(hints, progress.waypoint);
  if (!waypoint) return { thrust: false, brake: true, left: false, right: false, phase: "hold", waypoint: progress.waypoint };

  if (dockDistance < s.destination.radius * 0.78) progress.dock = true;
  if (dockDistance > s.destination.radius * 0.94) progress.dock = false;
  if (progress.dock) {
    const error = wrapAngle(s.destination.requiredBottomFacingRadians - Math.PI - ship.rotation);
    return { right: error > 0.065, left: error < -0.065, thrust: false, brake: speed > 5, phase: "dock", waypoint: progress.waypoint };
  }

  const dx = waypoint.position.x - ship.x;
  const dy = waypoint.position.y - ship.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const holdingHere = Boolean(waypoint.hold) && !progress.released.has(progress.waypoint) && distance < waypoint.radius;
  progress.holding = holdingHere;
  let limit = holdingHere ? Math.min(pilotTuning.holdSpeed, distance * 0.6) : Math.min(waypoint.targetSpeed, Math.max(15, distance * 0.75));
  if (waypoint.hold && !holdingHere) limit = Math.min(waypoint.targetSpeed, Math.max(30, distance * 2.2));
  if (progress.waypoint === waypoints.length - 1) limit = Math.min(limit, Math.max(18, (dockDistance - s.destination.radius + 40) * 0.5));
  let desiredX = (dx / distance) * limit;
  let desiredY = (dy / distance) * limit;

  const threats: PilotObstacle[] = [
    ...s.movingObstacles,
    ...route.obstacles.map((o) => ({ id: o.id, x: o.x, y: o.y, vx: 0, vy: 0, radius: o.radius })),
    ...s.seekers.filter((koi) => koi.mode !== "returning"),
  ];
  let avoiding = false;
  for (const obstacle of threats) {
    const approach = closestApproach(ship, obstacle, hints.obstacleLookaheadSeconds);
    if (approach.clearance >= pilotTuning.avoidClearancePx) continue;
    const length = Math.max(1, Math.hypot(approach.dx, approach.dy));
    desiredX = desiredX * 0.5 - (approach.dx / length) * 65;
    desiredY = desiredY * 0.5 - (approach.dy / length) * 65;
    avoiding = true;
  }

  const ax = (desiredX - ship.velocityX) * 1.8 - (s.environment?.ax ?? 0);
  const ay = (desiredY - ship.velocityY) * 1.8 - (s.environment?.ay ?? 0);
  const magnitude = Math.hypot(ax, ay);
  let error = wrapAngle(Math.atan2(ax, -ay) - ship.rotation);
  const next = waypointAt(hints, progress.waypoint + 1);
  if (holdingHere && next && magnitude < 60 && !avoiding) {
    // Parked in calm air: pre-aim at the crossing so the release is a straight burn.
    error = wrapAngle(Math.atan2(next.position.x - ship.x, -(next.position.y - ship.y)) - ship.rotation);
    return { right: error > 0.065, left: error < -0.065, thrust: false, brake: speed > 4, phase: "hold", waypoint: progress.waypoint };
  }
  const desiredSpeed = Math.hypot(desiredX, desiredY);
  const brake = speed > desiredSpeed + 10 || (Math.abs(error) > 0.65 && speed > 35);
  let thrust = !brake && magnitude > 28 && Math.abs(error) < 0.24;

  const quiet = Boolean(waypoint.quiet);
  if (quiet && thrust && progress.noiseMs >= pilotTuning.quietBudgetMs) thrust = false;
  progress.noiseMs = clamp(progress.noiseMs + (thrust ? dtMs : -dtMs * pilotTuning.quietDrain), 0, pilotTuning.quietBudgetMs * 2);

  return {
    right: error > 0.065,
    left: error < -0.065,
    thrust,
    brake,
    phase: holdingHere ? "hold" : avoiding ? "avoid" : "cruise",
    waypoint: progress.waypoint,
  };
}

// --- Landing --------------------------------------------------------------------------------------

export type PilotLandingInput = {
  readonly state: { readonly x: number; readonly y: number; readonly rotation: number; readonly velocityX: number; readonly velocityY: number; readonly angularVelocity: number };
  readonly pad: { readonly centerX: number; readonly surfaceY: number; readonly width: number; readonly velocityX?: number };
  readonly wind: { readonly ax: number; readonly ay: number } | null;
  readonly tuning: { readonly gravity: number; readonly shipRadius: number } & Partial<LandingTuning>;
  /** Mechanic-blind simulation uses reduced feedback gain. */
  readonly feedbackScale?: number;
  readonly zone?: { readonly altitude: number } | null;
};

export type PilotLandingControls = { readonly thrust: boolean; readonly brake: boolean; readonly left: boolean; readonly right: boolean; readonly altitude: number; readonly desiredTilt: number; readonly desiredVy: number };

/** Direct side-puffer PD tracking with wind/drag feed-forward; W meters descent and S helps only near matching. */
export function pilotLandingControls(s: PilotLandingInput, profile: "soft" | "bumpy", hints: MissionPilotHints["landing"]): PilotLandingControls {
  const t = { ...landingTuning, ...s.tuning };
  const st = s.state;
  const altitude = Math.max(0, s.zone?.altitude ?? (s.pad.surfaceY - st.y - s.tuning.shipRadius));
  const padVx = s.pad.velocityX ?? 0;
  const dx = s.pad.centerX + hints.targetTangentOffset - st.x;
  const ax = (dx * t.pilotPositionGain + (padVx - st.velocityX) * t.pilotVelocityGain
    - (s.wind?.ax ?? 0) + st.velocityX * t.lateralDrag) * (s.feedbackScale ?? 1);
  const target = profile === "bumpy" ? t.pilotBumpyDescent : hints.targetRelativeDescent;
  const offTarget = Math.abs(dx) > s.pad.width * t.pilotCorrectionPadShare && altitude < t.pilotCorrectionAltitude;
  const desiredVy = offTarget ? Math.min(target, t.pilotCorrectionDescent)
    : Math.min(profile === "bumpy" ? t.pilotBumpyCruiseDescent : t.pilotSoftCruiseDescent, target + altitude * t.pilotDescentAltitudeGain);
  const left = ax < -t.pilotAccelerationDeadband;
  const right = ax > t.pilotAccelerationDeadband;
  return {
    left, right,
    brake: !left && !right && Math.abs(dx) < t.pilotSteadyPositionTolerance
      && Math.abs(st.velocityX - padVx) < t.pilotSteadyVelocityTolerance,
    thrust: st.velocityY > desiredVy,
    altitude,
    // Kept for probe/e2e compatibility; now reports desired lateral acceleration.
    desiredTilt: ax,
    desiredVy,
  };
}
