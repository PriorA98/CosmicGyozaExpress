/**
 * Headless campaign landing simulation (dev / tests only): the same pure integration, pad and wind samples and
 * touchdown rule as LandingScene, driven by the shared landing autopilot.
 */
import { landingForMission, resolveMission } from "../data/campaign";
import { classifyPadTouchdown, sampleLandingEnvironment } from "../systems/LandingEnvironmentSystem";
import { createLandingState, integrateLandingMovement } from "../systems/LandingSystem";
import type { LandingControls } from "../types/landing";
import { NAIVE_REACTION_MS, NAIVE_CORRECTION } from "./routeChallenge";
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
 * `naive`: aim at the current pad without wind or motion feed-forward, with 80% feedback gain and side commands delayed by 350 ms;
 * phase 4 requires it to fail the twisted landings at least some of the time.
 */
export function simulateLanding(missionId: MissionId, profile: "soft" | "bumpy", clockStartMs = 0, maxMs = 45000, naive = false): LandingSimResult {
  const definition = landingForMission(missionId);
  const hints = resolveMission(missionId).pilotHints.landing;
  const tuning = definition.tuning;
  let state = createLandingState(tuning);
  let controls: LandingControls = { thrust: false, left: false, right: false, stabilizer: false };
  const dt = 1 / 60;
  const decisions: { atMs: number; left: boolean; right: boolean }[] = [];
  for (let step = 0; step * dt * 1000 < maxMs; step += 1) {
    const clock = clockStartMs + (step + 1) * dt * 1000;
    const environment = sampleLandingEnvironment(definition, state, clock);
    if (step % 2 === 0) {
      const decision = pilotLandingControls({
        state,
        pad: { ...environment.pad.pad, velocityX: naive ? 0 : environment.pad.velocity.x },
        wind: naive ? null : { ax: environment.wind.acceleration.x, ay: environment.wind.acceleration.y },
        tuning: { ...tuning, gravity: tuning.gravityAcceleration },
        feedbackScale: naive ? NAIVE_CORRECTION : 1,
      }, profile, hints);
      decisions.push({ atMs: clock, left: decision.left, right: decision.right });
      while (decisions.length > 1 && (decisions[1]?.atMs ?? Infinity) <= clock - (naive ? NAIVE_REACTION_MS : 0)) decisions.shift();
      const side = decisions[0];
      const ready = side !== undefined && (!naive || side.atMs <= clock - NAIVE_REACTION_MS);
      controls = { thrust: decision.thrust, left: ready && (side?.left ?? false), right: ready && (side?.right ?? false), stabilizer: decision.brake };
    }
    state = integrateLandingMovement(state, controls, dt, tuning, environment.wind.acceleration, environment.pad.velocity.x);
    const x = Math.min(Math.max(state.x, tuning.shipRadius), 1280 - tuning.shipRadius);
    const y = Math.min(Math.max(state.y, tuning.shipRadius), environment.pad.pad.surfaceY - tuning.shipRadius + 18);
    if (x !== state.x || y !== state.y) {
      state = { ...state, x, y, velocityX: x === state.x ? state.velocityX : 0,
        velocityY: y < state.y ? state.velocityY : Math.max(0, state.velocityY) };
    }
    const touchdown = classifyPadTouchdown(definition.collisionModel, state, environment.pad, tuning);
    if (touchdown.kind !== "none") {
      const { onPad, verticalSpeed, horizontalSpeed, angleDegrees } = touchdown;
      return { result: touchdown.kind, ms: Math.round(clock - clockStartMs), x: Math.round(state.x), metrics: { onPad, verticalSpeed, horizontalSpeed, angleDegrees } };
    }
  }
  return { result: "timeout", ms: maxMs, x: Math.round(state.x), metrics: null };
}
