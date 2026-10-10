/**
 * Phase-4 ignorability check (rule R7), shared by tests and the tuning script:
 *  - `hinted`: the campaign autopilot with the mission's pilot hints (holds, quiet legs, waypoints);
 *  - `naive`: follows the same path but ignores the mechanic: never waits (no holds), never goes quiet, never
 *    dodges moving things, and, like a person, notices forces late (`NAIVE_REACTION_MS`), only partly
 *    (`NAIVE_CORRECTION`), and presses thrust in bursts of at least `NAIVE_BURST_MS`.
 * A redesigned route must be completed by `hinted` and must defeat `naive`.
 */
import { routeForMission, resolveMission } from "../data/campaign";
import type { MissionId, MissionPilotHints } from "../types/campaign";
import { createPilotProgress, pilotFlightControls } from "./routePilot";
import { simulateRoute, type RouteSimResult } from "./routeSim";

export function runHintedPilot(missionId: MissionId, maxSimMs = 300000): RouteSimResult {
  const route = routeForMission(missionId);
  const hints = resolveMission(missionId).pilotHints;
  const progress = createPilotProgress();
  return simulateRoute(route, (input) => pilotFlightControls(input, route, hints, progress), { maxSimMs });
}

export const NAIVE_REACTION_MS = 350;
export const NAIVE_CORRECTION = 0.8;
export const NAIVE_BURST_MS = 450;

export function runNaivePilot(missionId: MissionId, maxSimMs = 180000): RouteSimResult {
  const route = routeForMission(missionId);
  const base = resolveMission(missionId).pilotHints;
  const hints: MissionPilotHints = { ...base, waypoints: base.waypoints.map((w) => ({ position: w.position, radius: Math.max(w.radius, 120), targetSpeed: Math.max(w.targetSpeed, 180) })) };
  const blind = { ...route, movingObstacles: [] };
  const progress = createPilotProgress();
  const felt: { readonly atMs: number; readonly ax: number; readonly ay: number }[] = [];
  let burstUntilMs = -1;
  return simulateRoute(route, (input) => {
    felt.push({ atMs: input.simTimeMs, ax: input.environment?.ax ?? 0, ay: input.environment?.ay ?? 0 });
    while (felt.length > 1 && (felt[1]?.atMs ?? Infinity) <= input.simTimeMs - NAIVE_REACTION_MS) felt.shift();
    const late = felt[0] ?? { ax: 0, ay: 0 };
    const environment = { ax: late.ax * NAIVE_CORRECTION, ay: late.ay * NAIVE_CORRECTION };
    const controls = pilotFlightControls({ ...input, environment, movingObstacles: [], seekers: [] }, blind, hints, progress);
    if (controls.thrust && input.simTimeMs >= burstUntilMs) burstUntilMs = input.simTimeMs + NAIVE_BURST_MS;
    const bursting = input.simTimeMs < burstUntilMs && controls.phase !== "dock";
    return bursting ? { ...controls, thrust: true, brake: false } : controls;
  }, { maxSimMs });
}

/** A naive run "fails" when it cannot arrive or arrives only after an incident, a warp, or repeated hard bumps. */
export function naiveDefeated(result: RouteSimResult): boolean {
  return !result.arrived || result.incidents > 0 || result.warps > 0 || result.bumps >= 2;
}
