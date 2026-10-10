/**
 * Headless campaign landing simulation (dev / tests only): the same pure integration, pad and wind samples and
 * touchdown rule as LandingScene, driven by the shared landing autopilot.
 */
import { landingForMission, resolveMission } from "../data/campaign";
import { classifyPadTouchdown, sampleLandingEnvironment } from "../systems/LandingEnvironmentSystem";
import { createLandingState, integrateLandingMovement } from "../systems/LandingSystem";
import type { MissionId } from "../types/campaign";
import { pilotLandingControls } from "./routePilot";

export type LandingSimResult = {
  readonly result: "soft" | "bumpy" | "incident" | "timeout";
  readonly ms: number;
  readonly x: number;
  /** Touchdown metrics in the contact frame (null on timeout). */
  readonly metrics: { readonly onPad: boolean; readonly verticalSpeed: number; readonly horizontalSpeed: number; readonly angleDegrees: number } | null;
};

/**
 * `naive`: the Tea Moon habit (gentle tilt, aim at where the pad is now) that ignores wind and pad motion;
 * phase 4 requires it to fail the twisted landings at least some of the time.
 */
export function simulateLanding(missionId: MissionId, profile: "soft" | "bumpy", clockStartMs = 0, maxMs = 45000, naive = false): LandingSimResult {
  const definition = landingForMission(missionId);
  const authored = resolveMission(missionId).pilotHints.landing;
  const hints = naive ? { ...authored, maximumTiltRadians: 0.3 } : authored;
  const tuning = definition.tuning;
  let state = createLandingState(tuning);
  let controls = { thrust: false, rotateLeft: false, rotateRight: false, stabilizer: false };
  const dt = 1 / 60;
  for (let step = 0; step * dt * 1000 < maxMs; step += 1) {
    const clock = clockStartMs + step * dt * 1000;
    const environment = sampleLandingEnvironment(definition, state, clock);
    if (step % 2 === 0) {
      const decision = pilotLandingControls({
        state,
        pad: { ...environment.pad.pad, velocityX: naive ? 0 : environment.pad.velocity.x },
        wind: naive ? null : { ax: environment.wind.acceleration.x, ay: environment.wind.acceleration.y },
        tuning: { gravity: tuning.gravityAcceleration, shipRadius: tuning.shipRadius },
      }, profile, hints);
      controls = { thrust: decision.thrust, rotateLeft: decision.left, rotateRight: decision.right, stabilizer: decision.brake };
    }
    state = integrateLandingMovement(state, controls, dt, tuning, definition.collisionModel === "legacy-horizontal" ? undefined : environment.wind.acceleration);
    state = { ...state, x: Math.min(Math.max(state.x, tuning.shipRadius), 1280 - tuning.shipRadius), y: Math.max(state.y, tuning.shipRadius) };
    const touchdown = classifyPadTouchdown(definition.collisionModel, state, environment.pad, tuning);
    if (touchdown.kind !== "none") {
      const { onPad, verticalSpeed, horizontalSpeed, angleDegrees } = touchdown;
      return { result: touchdown.kind, ms: Math.round(clock - clockStartMs), x: Math.round(state.x), metrics: { onPad, verticalSpeed, horizontalSpeed, angleDegrees } };
    }
  }
  return { result: "timeout", ms: maxMs, x: Math.round(state.x), metrics: null };
}
