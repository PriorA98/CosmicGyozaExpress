import { describe, expect, it } from "vitest";
import { landingTuning } from "../src/data/tuning";
import {
  classifyLandingTouchdown,
  createLandingState,
  createTeaMoonLandingPad,
  integrateLandingMovement,
} from "../src/systems/LandingSystem";
import type { LandingControls, LandingKinematicState } from "../src/types/landing";

const idle: LandingControls = {
  thrust: false,
  rotateLeft: false,
  rotateRight: false,
  stabilizer: false,
};

describe("landing system", () => {
  it("applies gravity downward", () => {
    const state = createLandingState();
    const next = integrateLandingMovement(state, idle, 0.1);

    expect(next.velocityY).toBeGreaterThan(state.velocityY);
  });

  it("upright thrust slows descent", () => {
    const state: LandingKinematicState = {
      ...createLandingState(),
      velocityY: 80,
    };

    const next = integrateLandingMovement(state, { ...idle, thrust: true }, 0.1);

    expect(next.velocityY).toBeLessThan(state.velocityY);
  });

  it("tilted thrust adds horizontal velocity", () => {
    const state: LandingKinematicState = {
      ...createLandingState(),
      rotation: Math.PI / 6,
      velocityY: 80,
    };

    const next = integrateLandingMovement(state, { ...idle, thrust: true }, 0.1);

    expect(next.velocityX).toBeGreaterThan(0);
  });

  it("stabilizer nudges angular motion toward upright", () => {
    const state: LandingKinematicState = {
      ...createLandingState(),
      rotation: 0.35,
      angularVelocity: 0.8,
    };

    const next = integrateLandingMovement(state, { ...idle, stabilizer: true }, 0.1);

    expect(next.angularVelocity).toBeLessThan(state.angularVelocity);
  });

  it("classifies soft, bumpy, and incident touchdowns", () => {
    const pad = createTeaMoonLandingPad();
    const base: LandingKinematicState = {
      ...createLandingState(),
      x: pad.centerX,
      y: pad.surfaceY - landingTuning.shipRadius,
      rotation: 0,
      velocityX: 0,
      velocityY: 0,
      angularVelocity: 0,
    };

    expect(classifyLandingTouchdown({ ...base, velocityY: 40 }, pad).kind).toBe("soft");
    expect(classifyLandingTouchdown({ ...base, velocityY: landingTuning.safeVerticalSpeed + 20 }, pad).kind).toBe(
      "bumpy",
    );
    expect(classifyLandingTouchdown({ ...base, velocityY: landingTuning.bumpyVerticalSpeed + 20 }, pad).kind).toBe(
      "incident",
    );
  });

  it("classifies off-pad contact as an incident", () => {
    const pad = createTeaMoonLandingPad();
    const state: LandingKinematicState = {
      ...createLandingState(),
      x: pad.centerX + pad.width,
      y: pad.surfaceY - landingTuning.shipRadius,
      velocityY: 20,
    };

    expect(classifyLandingTouchdown(state, pad).kind).toBe("incident");
  });
});
