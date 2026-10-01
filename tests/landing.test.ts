import { describe, expect, it } from "vitest";
import { landingTuning } from "../src/data/landingTuning";
import {
  classifyLandingIncident,
  classifyLandingTouchdown,
  createLandingState,
  createTeaMoonLandingPad,
  descentZone,
  driftZone,
  integrateLandingMovement,
  landingAltitude,
  padAlignment,
  pinStateToLandingPad,
  readLandingZone,
  tiltZone,
} from "../src/systems/LandingSystem";
import type { LandingControls, LandingIncidentTouchdownResult, LandingKinematicState } from "../src/types/landing";

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

  it("classifies landing incidents by failure shape", () => {
    const base: LandingIncidentTouchdownResult = {
      kind: "incident",
      onPad: true,
      verticalSpeed: landingTuning.bumpyVerticalSpeed + 40,
      horizontalSpeed: 10,
      angleDegrees: 0,
    };

    expect(classifyLandingIncident(base)).toBe("hard-drop");
    expect(classifyLandingIncident({ ...base, horizontalSpeed: landingTuning.bumpyHorizontalSpeed + 40 })).toBe("skid");
    expect(classifyLandingIncident({ ...base, angleDegrees: landingTuning.bumpyAngleDegrees + 12 })).toBe("tilt-tip");
    expect(classifyLandingIncident({ ...base, onPad: false })).toBe("off-pad");
  });

  it("gently nudges the ship upright near the pad without input", () => {
    const pad = createTeaMoonLandingPad();
    const nearPad: LandingKinematicState = {
      ...createLandingState(),
      y: pad.surfaceY - landingTuning.shipRadius - landingTuning.uprightAssistAltitude / 2,
      rotation: 0.3,
      angularVelocity: 0,
    };

    const next = integrateLandingMovement(nearPad, idle, 0.03);

    expect(next.angularVelocity).toBeLessThan(0);
  });

  it("does not auto-correct tilt high above the pad or while the player is tilting", () => {
    const high: LandingKinematicState = { ...createLandingState(), rotation: 0.3, angularVelocity: 0 };
    expect(integrateLandingMovement(high, idle, 0.03).angularVelocity).toBe(0);

    const pad = createTeaMoonLandingPad();
    const nearPadTilting: LandingKinematicState = {
      ...high,
      y: pad.surfaceY - landingTuning.shipRadius - 10,
    };
    const tilting = integrateLandingMovement(nearPadTilting, { ...idle, rotateRight: true }, 0.03);
    expect(tilting.angularVelocity).toBeGreaterThan(0);
  });

  it("keeps the soft/bumpy/incident boundaries on the exact tuning thresholds", () => {
    const pad = createTeaMoonLandingPad();
    const base: LandingKinematicState = {
      ...createLandingState(),
      x: pad.centerX,
      y: pad.surfaceY - landingTuning.shipRadius,
      velocityY: landingTuning.safeVerticalSpeed,
    };

    expect(classifyLandingTouchdown(base, pad).kind).toBe("soft");
    expect(classifyLandingTouchdown({ ...base, velocityY: landingTuning.bumpyVerticalSpeed }, pad).kind).toBe("bumpy");
    expect(classifyLandingTouchdown({ ...base, velocityX: landingTuning.safeHorizontalSpeed + 1 }, pad).kind).toBe("bumpy");
    expect(classifyLandingTouchdown({ ...base, y: base.y - 1 }, pad).kind).toBe("none");
  });

  it("live landing zone matches touchdown classification", () => {
    const pad = createTeaMoonLandingPad();
    const above: LandingKinematicState = {
      ...createLandingState(),
      x: pad.centerX,
      y: pad.surfaceY - landingTuning.shipRadius - 200,
    };

    expect(readLandingZone({ ...above, velocityY: 30 }, pad).zone).toBe("soft");
    expect(readLandingZone({ ...above, velocityY: landingTuning.safeVerticalSpeed + 10 }, pad).zone).toBe("bumpy");
    expect(readLandingZone({ ...above, velocityY: landingTuning.bumpyVerticalSpeed + 10 }, pad).zone).toBe("rough");

    for (const velocityY of [10, 90, 160]) {
      const touching = { ...above, y: pad.surfaceY - landingTuning.shipRadius, velocityY };
      const touchdown = classifyLandingTouchdown(touching, pad).kind;
      const zone = readLandingZone(touching, pad).zone;
      expect(zone).toBe(touchdown === "incident" ? "rough" : touchdown);
    }
  });

  it("reports what limits the landing and the altitude above the surface", () => {
    const pad = createTeaMoonLandingPad();
    const state: LandingKinematicState = {
      ...createLandingState(),
      x: pad.centerX,
      y: pad.surfaceY - landingTuning.shipRadius - 120,
      velocityY: 20,
      rotation: (landingTuning.safeAngleDegrees + 4) * (Math.PI / 180),
    };

    const tilted = readLandingZone(state, pad);
    expect(tilted.limiting).toBe("tilt");
    expect(tilted.zone).toBe("bumpy");
    expect(tilted.altitude).toBeCloseTo(120);
    expect(landingAltitude({ ...state, y: pad.surfaceY }, pad)).toBe(0);

    expect(readLandingZone({ ...state, rotation: 0, velocityX: 100 }, pad).limiting).toBe("drift");
    expect(readLandingZone({ ...state, x: pad.centerX + pad.width }, pad).limiting).toBe("pad");
    expect(readLandingZone({ ...state, x: pad.centerX + pad.width }, pad).zone).toBe("rough");
  });

  it("maps descent speed to gauge position and zone, treating rising as safe", () => {
    const pad = createTeaMoonLandingPad();
    const state = createLandingState();

    expect(readLandingZone({ ...state, velocityY: -50 }, pad).descentGauge).toBe(0);
    expect(readLandingZone({ ...state, velocityY: landingTuning.descentGaugeMaxSpeed * 3 }, pad).descentGauge).toBe(1);
    expect(descentZone(-40)).toBe("soft");
    expect(descentZone(landingTuning.safeVerticalSpeed + 1)).toBe("bumpy");
    expect(descentZone(landingTuning.bumpyVerticalSpeed + 1)).toBe("rough");
    expect(driftZone(-landingTuning.safeHorizontalSpeed)).toBe("soft");
    expect(driftZone(landingTuning.bumpyHorizontalSpeed + 1)).toBe("rough");
    expect(tiltZone(landingTuning.safeAngleDegrees + 1)).toBe("bumpy");
  });

  it("reports pad alignment and the direction back to the pad", () => {
    const pad = createTeaMoonLandingPad();
    const state = createLandingState();

    expect(padAlignment({ ...state, x: pad.centerX }, pad)).toEqual({ offset: 0, onPad: true, directionToPad: 0 });
    expect(padAlignment({ ...state, x: pad.centerX + pad.width }, pad).directionToPad).toBe(-1);
    expect(padAlignment({ ...state, x: pad.centerX - pad.width }, pad).directionToPad).toBe(1);
    expect(padAlignment({ ...state, x: pad.centerX + pad.width / 2 }, pad).onPad).toBe(true);
  });

  it("settles on the pad where it touched down instead of snapping to the centre", () => {
    const pad = createTeaMoonLandingPad();
    const touching: LandingKinematicState = {
      ...createLandingState(),
      x: pad.centerX + 90,
      y: pad.surfaceY - landingTuning.shipRadius + 4,
      rotation: 0.2,
      velocityX: 30,
      velocityY: 60,
      angularVelocity: 0.4,
    };

    const pinned = pinStateToLandingPad(touching, pad);
    expect(pinned).toEqual({
      x: pad.centerX + 90,
      y: pad.surfaceY - landingTuning.shipRadius,
      rotation: 0,
      velocityX: 0,
      velocityY: 0,
      angularVelocity: 0,
    });
    expect(pinStateToLandingPad({ ...touching, x: pad.centerX + pad.width }, pad).x).toBe(pad.centerX + pad.width / 2);
  });

  it("keeps the four incident shapes distinct for sideways and steep drops", () => {
    const base: LandingIncidentTouchdownResult = {
      kind: "incident",
      onPad: true,
      verticalSpeed: 300,
      horizontalSpeed: landingTuning.bumpyHorizontalSpeed + 10,
      angleDegrees: 0,
    };

    // Fast sideways but falling much faster still reads as a hard drop.
    expect(classifyLandingIncident(base)).toBe("hard-drop");
    expect(classifyLandingIncident({ ...base, horizontalSpeed: 300 * landingTuning.skidHorizontalToVerticalRatio + 1 })).toBe(
      "skid",
    );
    // Off-pad wins over every other shape.
    expect(classifyLandingIncident({ ...base, onPad: false, angleDegrees: 80 })).toBe("off-pad");
  });
});
