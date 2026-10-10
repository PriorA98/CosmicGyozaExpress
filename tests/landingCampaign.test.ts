import { describe, expect, it } from "vitest";
import { landingForMission } from "../src/data/campaign";
import { landingTuning } from "../src/data/landingTuning";
import { buildLandingReadouts } from "../src/entities/landing/landingReadouts";
import { layoutBerthTiles } from "../src/entities/landing/berthTiles";
import {
  acceptedPadOffset, campaignLandingNote, classifyPadTouchdown, landingContactState,
  readPadLandingZone, rideLandingPad, sampleLandingEnvironment, sampleLandingPad,
  sampleLandingWind, windsockFrameFor,
} from "../src/systems/LandingEnvironmentSystem";
import { classifyLandingTouchdown, createLandingState, integrateLandingMovement } from "../src/systems/LandingSystem";
import type { LandingKinematicState } from "../src/types/landing";

const idle = { thrust: false, rotateLeft: false, rotateRight: false, stabilizer: false };

it("tiles campaign berths at their exact collision width with cropped centres and intact caps", () => {
  for (const width of [340, 360, 480]) {
    const tiles = layoutBerthTiles(width, 32, 2);
    expect(tiles[0]).toEqual({ frame: 0, x: 0, artWidth: 32 });
    expect(tiles.at(-1)).toEqual({ frame: 2, x: width - 64, artWidth: 32 });
    expect(tiles.reduce((sum, tile) => sum + tile.artWidth * 2, 0)).toBe(width);
    for (let i = 1; i < tiles.length; i += 1) {
      expect(tiles[i]?.x).toBe((tiles[i - 1]?.x ?? 0) + (tiles[i - 1]?.artWidth ?? 0) * 2);
    }
  }
});

describe("campaign pad contact", () => {
  const definition = landingForMission("bento-belt");
  const pad = sampleLandingPad(definition, 3000);
  const contact: LandingKinematicState = {
    ...createLandingState(definition.tuning), x: pad.pad.centerX,
    y: pad.pad.surfaceY - definition.tuning.shipRadius,
    velocityX: pad.velocity.x + definition.tuning.safeHorizontalSpeed,
    velocityY: definition.tuning.safeVerticalSpeed,
  };

  it("classifies pad-relative drift and uses the same metrics in the gauges", () => {
    expect(classifyPadTouchdown("relative-pad", contact, pad, definition.tuning).kind).toBe("soft");
    expect(classifyPadTouchdown("legacy-horizontal", contact, pad, definition.tuning).kind).not.toBe("soft");
    const relative = landingContactState("relative-pad", contact, pad);
    const zone = readPadLandingZone("relative-pad", contact, pad, definition.tuning);
    const readouts = buildLandingReadouts(zone, relative.velocityX, relative.velocityY, undefined, definition.tuning);
    expect(zone.horizontalSpeed).toBeCloseTo(definition.tuning.safeHorizontalSpeed);
    expect(readouts.drift.zone).toBe("soft");
    expect(readouts.overallZone).toBe("soft");
  });

  it("keeps soft, bumpy, and incident outcomes reachable throughout the pad path", () => {
    for (const time of [0, 3000, 6000, 9000]) {
      const sample = sampleLandingPad(definition, time);
      for (const [speed, outcome] of [[38, "soft"], [110, "bumpy"], [170, "incident"]] as const) {
        const state = { ...contact, x: sample.pad.centerX, velocityX: sample.velocity.x, velocityY: speed };
        expect(classifyPadTouchdown("relative-pad", state, sample, definition.tuning).kind).toBe(outcome);
      }
    }
  });

  it("rides the moving berth at the accepted offset without slipping or snapping to its centre", () => {
    const offset = acceptedPadOffset({ ...contact, x: pad.pad.centerX + 80 }, pad.pad);
    const later = sampleLandingPad(definition, 4500);
    const resting = rideLandingPad(offset, later.pad, definition.tuning);
    expect(resting.x - later.pad.centerX).toBe(80);
    expect(resting.y + definition.tuning.shipRadius).toBe(later.pad.surfaceY);
    expect(acceptedPadOffset({ ...contact, x: 5000 }, pad.pad)).toBe(pad.pad.width / 2);
  });

  it("preserves Tea Moon world-frame arithmetic and touchdown rules", () => {
    const tea = landingForMission("tea-moon");
    const state = { ...contact, x: tea.pad.centerX, velocityX: 0, velocityY: 38 };
    const sample = sampleLandingEnvironment(tea, state, 3000);
    expect(landingContactState(tea.collisionModel, state, sample.pad)).toBe(state);
    expect(classifyPadTouchdown(tea.collisionModel, state, sample.pad, tea.tuning))
      .toEqual(classifyLandingTouchdown(state, tea.pad));
    expect(integrateLandingMovement(state, idle, 1 / 60, tea.tuning))
      .toEqual(integrateLandingMovement(state, idle, 1 / 60));
  });

  it("injects mission thresholds into every numeric readout, including tilt", () => {
    const tuning = { ...landingTuning, safeVerticalSpeed: 20, safeHorizontalSpeed: 10, safeAngleDegrees: 5 };
    const state = { ...contact, velocityX: pad.velocity.x + 15, velocityY: 25, rotation: Math.PI / 18 };
    const relative = landingContactState("relative-pad", state, pad);
    const zone = readPadLandingZone("relative-pad", state, pad, tuning);
    const readouts = buildLandingReadouts(zone, relative.velocityX, relative.velocityY, undefined, tuning);
    expect([readouts.descent.zone, readouts.drift.zone, readouts.tilt.zone]).toEqual(["bumpy", "bumpy", "bumpy"]);
  });
});

describe("campaign wind and shelter", () => {
  const gust = landingForMission("im-fine");

  it("starts with the full warning and telegraphs the force using the sampled envelope", () => {
    for (const time of [0, 1499]) {
      const sample = sampleLandingWind(gust.wind, 200, time);
      expect(sample.phase).toBe("warning");
      expect(sample.acceleration).toEqual({ x: 0, y: 0 });
      expect(windsockFrameFor(sample, 120)).toBe("warning");
    }
    const active = sampleLandingWind(gust.wind, 200, 3000);
    expect(active.acceleration.x).toBe(120);
    expect(windsockFrameFor(active, 120)).toBe("strong");
  });

  it("blends shelter between 60 and 150 pixels and keeps the lower sock calm even during warning", () => {
    expect(sampleLandingWind(gust.wind, 105, 3000).acceleration.x).toBe(60);
    for (const time of [0, 3000, 7000]) {
      const sample = sampleLandingWind(gust.wind, 60, time);
      expect(sample.exposure).toBe(0);
      expect(sample.acceleration.x).toBeCloseTo(0);
      expect(windsockFrameFor(sample, 120)).toBe("calm");
    }
  });

  it("applies steady crosswind and mission gravity without changing stabilizer semantics", () => {
    const matcha = landingForMission("matcha-nebula");
    const state = createLandingState(matcha.tuning);
    const sample = sampleLandingEnvironment(matcha, state, 0);
    const calm = integrateLandingMovement(state, idle, 1 / 60, matcha.tuning);
    const windy = integrateLandingMovement(state, idle, 1 / 60, matcha.tuning, sample.wind.acceleration);
    expect(windy.velocityX).toBeGreaterThan(calm.velocityX);
    expect(windy.velocityY).toBe(calm.velocityY);
    expect(windy.angularVelocity).toBe(calm.angularVelocity);
    const bakery = landingForMission("black-hole-bakery");
    const bakeryState = createLandingState(bakery.tuning);
    expect(bakeryState.velocityY).toBe(14);
    expect(integrateLandingMovement(bakeryState, idle, 1 / 60, bakery.tuning).velocityY - bakeryState.velocityY)
      .toBeLessThan(calm.velocityY - state.velocityY);
  });
});

describe("campaign landing notes", () => {
  function note(id: string, time: number, altitude: number) {
    const definition = landingForMission(id);
    return campaignLandingNote({ definition, clockMs: time, altitude,
      wind: sampleLandingWind(definition.wind, altitude, time), introNoteMs: 2000, calmAltitude: 100 });
  }

  it("prioritizes shelter, warning, and active gust in the player's current context", () => {
    expect(note("im-fine", 0, 200)).toBe("gustWarning");
    expect(note("im-fine", 0, 50)).toBe("landingCalm");
    expect(note("im-fine", 3000, 200)).toBe("landingTwist");
    expect(note("im-fine", 3000, 50)).toBe("landingCalm");
    const definition = landingForMission("im-fine");
    expect(campaignLandingNote({ definition, clockMs: 2100, altitude: 200,
      wind: sampleLandingWind(definition.wind, 200, 2100), introNoteMs: 3600, calmAltitude: 100,
    })).toBe("landingTwist");
  });

  it("teaches moving pads, steady wind, and light gravity from mission data", () => {
    expect(note("bento-belt", 0, 200)).toBe("landingIntro");
    expect(note("bento-belt", 3000, 200)).toBe("landingTwist");
    expect(note("matcha-nebula", 3000, 200)).toBe("landingTwist");
    expect(note("black-hole-bakery", 3000, 50)).toBe("landingTwist");
  });
});
