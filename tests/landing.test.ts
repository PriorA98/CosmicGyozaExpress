import { fitsTicker } from "../src/ui/layout";
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
import { landingCopy } from "../src/data/landingCopy";
import { landingScenery } from "../src/data/landingScenery";
import { SHIP_ART } from "../src/data/assetManifest";
import {
  buildIncidentReadouts,
  buildLandingReadouts,
  buildSettledReadouts,
  formatDescentReadout,
  formatPadReadout,
  formatDriftReadout,
  formatSpeedNumber,
} from "../src/entities/landing/landingReadouts";
import { landingTouchTiles } from "../src/entities/landing/landingTouchLayout";
import { guideLightRowStrength } from "../src/entities/landing/guideLight";
import { dottedLineCells, filledEllipseSpans, outlineEllipseSpans, snapToGrid } from "../src/entities/landing/pixelShapes";
import { lowestOpaqueRow, shipDisplayScale } from "../src/entities/landing/shipFootprint";
import { stepThrustPower, thrustFlameFrame } from "../src/entities/landing/thrustFlame";

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

describe("landing presentation helpers", () => {
  const thrust = landingScenery.thrust;

  it("ramps thrust power up while held and back down after release, clamped to 0..1", () => {
    let power = 0;
    for (let i = 0; i < 30; i += 1) power = stepThrustPower(power, true, 1 / 60, thrust);
    expect(power).toBe(1);
    power = stepThrustPower(power, false, 1 / 60, thrust);
    expect(power).toBeLessThan(1);
    for (let i = 0; i < 30; i += 1) power = stepThrustPower(power, false, 1 / 60, thrust);
    expect(power).toBe(0);
    expect(stepThrustPower(Number.NaN, true, -1, thrust)).toBe(0);
  });

  it("picks the baked flame frame from thrust power and flickers only between big frames", () => {
    expect(thrustFlameFrame(0, 0, thrust)).toBe(0);
    expect(thrustFlameFrame(thrust.litPower, 0, thrust)).toBe(1);
    expect(thrustFlameFrame(thrust.fly2Power, 0, thrust)).toBe(2);
    const frames = new Set<number>();
    for (let t = 0; t < 2000; t += 10) frames.add(thrustFlameFrame(1, t, thrust));
    expect([...frames].every((frame) => frame === 2 || frame === 3)).toBe(true);
    expect(frames.has(3)).toBe(true);
  });

  it("formats friendly descent readouts with one shared number for the HUD and the gauge", () => {
    const ppm = landingScenery.readouts.pixelsPerMeter;
    expect(formatSpeedNumber(ppm * 2)).toBe("2.0");
    expect(formatSpeedNumber(-0.01)).toBe("0.0");

    const gentle = formatDescentReadout(landingTuning.safeVerticalSpeed - 1);
    expect(gentle.word).toBe(landingCopy.descentWords.soft);
    expect(gentle.text).toContain(gentle.number);
    expect(gentle.text).not.toContain("px");

    const fast = formatDescentReadout(landingTuning.bumpyVerticalSpeed + 10);
    expect(fast.zone).toBe("rough");
    expect(fast.word).toBe(landingCopy.descentWords.rough);

    const rising = formatDescentReadout(-60);
    expect(rising.word).toBe(landingCopy.risingWord);
    expect(rising.zone).toBe("soft");

    expect(formatDriftReadout(40).text).toContain(landingCopy.driftArrows.right);
    expect(formatDriftReadout(-40).text).toContain(landingCopy.driftArrows.left);
    expect(formatDriftReadout(0).text).not.toMatch(/[←→]/);
  });

  it("builds one readout bundle whose gauge chip names the limiting reading", () => {
    const pad = createTeaMoonLandingPad();
    const state: LandingKinematicState = { ...createLandingState(), velocityY: landingTuning.bumpyVerticalSpeed + 30 };
    const readouts = buildLandingReadouts(readLandingZone(state, pad), state.velocityX, state.velocityY);
    expect(readouts.overallZone).toBe("rough");
    expect(readouts.chip).toBe(landingCopy.roughBecause.descent);
    expect(readouts.descent.number).toBe(formatSpeedNumber(state.velocityY));

    const offPad: LandingKinematicState = { ...createLandingState(), x: pad.centerX + pad.width };
    const offReadouts = buildLandingReadouts(readLandingZone(offPad, pad), 0, 20);
    expect(offReadouts.overallZone).toBe("rough");
    expect(offReadouts.chip).toBe(landingCopy.offPad);
  });

  it("lays out touch tiles inside the canvas without overlapping each other, the pad, the rabbit, or the tea house", () => {
    const width = 1280;
    const height = 720;
    const tiles = Object.values(landingTouchTiles(width, height));
    const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a): boolean =>
      a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

    for (const tile of tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.y).toBeGreaterThanOrEqual(0);
      expect(tile.x + tile.width).toBeLessThanOrEqual(width);
      expect(tile.y + tile.height).toBeLessThanOrEqual(height);
    }
    tiles.forEach((a, i) => tiles.slice(i + 1).forEach((b) => expect(overlaps(a, b)).toBe(false)));

    const art = 2;
    const padRect = { x: landingTuning.startX - landingTuning.padWidth / 2, y: landingTuning.surfaceY - 40, width: landingTuning.padWidth, height: 80 };
    // Rabbit sprite 24x32 art px and tea house 96x80 art px, bottom-centre anchored on the surface line.
    const rabbit = { x: landingScenery.rabbit.touchX - 12 * art, y: landingTuning.surfaceY - 32 * art, width: 24 * art, height: 32 * art };
    const house = { x: landingScenery.teahouse.touchX - 48 * art, y: landingTuning.surfaceY - 80 * art, width: 96 * art, height: 80 * art };
    for (const tile of tiles) {
      expect(overlaps(tile, padRect)).toBe(false);
      expect(overlaps(tile, rabbit)).toBe(false);
      expect(overlaps(tile, house)).toBe(false);
    }

    // The right tile column keeps a clear gap from the tea house (opaque art spans art x 4..91).
    const houseRight = landingScenery.teahouse.touchX - 48 * art + 92 * art;
    const rightColumn = Math.min(...tiles.map((tile) => tile.x).filter((x) => x > width / 2));
    expect(rightColumn - houseRight).toBeGreaterThanOrEqual(48);
    // ...and the rabbit stands between the right lantern and the tea house without touching either.
    const lanternRight = landingTuning.startX + (176 * art) / 2 + landingScenery.lanterns.outsetFromPadEnd + 12 * art;
    expect(rabbit.x).toBeGreaterThanOrEqual(lanternRight);
    expect(rabbit.x + rabbit.width).toBeLessThanOrEqual(landingScenery.teahouse.touchX - 48 * art + 4 * art + 8);
  });

  it("fits every dashboard chatter line in the wrapped ticker without an ellipsis", () => {
    const hud = landingScenery.hud;
    const lines = [...Object.values(landingCopy.notes), ...Object.values(landingCopy.incidentNotes), landingCopy.retrying];
    for (const line of lines) expect(fitsTicker(line, hud.width, hud.tickerLines), line).toBe(true);
  });

  it("freezes incident and settle readouts to what the resting ship shows", () => {
    const pad = createTeaMoonLandingPad();
    const state: LandingKinematicState = { ...createLandingState(), velocityY: landingTuning.bumpyVerticalSpeed + 40, rotation: 0.08 };
    const touchdown = buildLandingReadouts(readLandingZone(state, pad), 30, state.velocityY);

    const tipped = buildIncidentReadouts(touchdown, "hard-drop");
    expect(tipped.descent.number).toBe(touchdown.descent.number);
    expect(tipped.descent.text.startsWith(landingCopy.restingRows.incident.descentPrefix)).toBe(true);
    expect(tipped.tilt.text).toBe(landingCopy.restingRows.incident.tilt["hard-drop"]);
    expect(tipped.tilt.text).not.toMatch(/level|\d/);
    expect(tipped.pad.text).toBe(landingCopy.padStatus.onBlanket);

    const offPad = buildIncidentReadouts(touchdown, "off-pad");
    expect(offPad.pad.text).toBe(landingCopy.padStatus.offBlanket);
    expect(offPad.altitude.text).toContain(landingCopy.padStatus.offBlanket);
    expect(offPad.altitude.zone).toBe("rough");

    const skid = buildIncidentReadouts(touchdown, "skid", landingCopy.driftArrows.right);
    expect(skid.drift.text).toContain(landingCopy.driftArrows.right);

    const settled = buildSettledReadouts(touchdown);
    expect(settled.tilt.text).toBe(landingCopy.restingRows.settled.tilt);
    expect(settled.drift.text).toBe(landingCopy.restingRows.settled.drift);
    expect(settled.descent.number).toBe(touchdown.descent.number);
  });

  it("names the pad status for the compact HUD", () => {
    expect(formatPadReadout(true).text).toBe(landingCopy.padStatus.onPad);
    const off = formatPadReadout(false);
    expect(off.text).toBe(landingCopy.padStatus.offPad);
    expect(off.zone).toBe("rough");
  });

  it("dissolves the guide light toward the top in hard steps", () => {
    const guide = landingScenery.guideLight;
    expect(guideLightRowStrength(0, guide.fadeStart, guide.fadeSteps)).toBe(1);
    expect(guideLightRowStrength(guide.fadeStart, guide.fadeStart, guide.fadeSteps)).toBe(1);
    expect(guideLightRowStrength(1, guide.fadeStart, guide.fadeSteps)).toBe(0);
    let previous = 1;
    const levels = new Set<number>();
    for (let k = 0; k < 1; k += 0.01) {
      const strength = guideLightRowStrength(k, guide.fadeStart, guide.fadeSteps);
      expect(strength).toBeLessThanOrEqual(previous);
      previous = strength;
      levels.add(strength);
    }
    // Stepped (a handful of levels) and the top row is already faint, so no hard top edge.
    expect(levels.size).toBeLessThanOrEqual(guide.fadeSteps + 1);
    expect(guideLightRowStrength(0.99, guide.fadeStart, guide.fadeSteps)).toBeCloseTo(1 / (guide.fadeSteps + 1), 6);
  });

  it("keeps the landing ship at an integer display scale", () => {
    expect(shipDisplayScale(SHIP_ART.width, SHIP_ART.height)).toBe(SHIP_ART.artScale);
    expect(Number.isInteger(shipDisplayScale(144, 160))).toBe(true);
    expect(shipDisplayScale(144, 160)).toBeGreaterThanOrEqual(1);
  });

  it("finds the lowest opaque row (ship feet) in raw RGBA pixels", () => {
    const width = 2;
    const height = 4;
    const pixels = new Uint8ClampedArray(width * height * 4);
    pixels[(2 * width + 1) * 4 + 3] = 255;
    expect(lowestOpaqueRow(pixels, width, height)).toBe(2);
    expect(lowestOpaqueRow(new Uint8ClampedArray(width * height * 4), width, height)).toBe(-1);
  });

  it("builds pixel shapes from whole cells on the art grid", () => {
    const cell = 2;
    for (const span of [...filledEllipseSpans(30, 8, cell), ...outlineEllipseSpans(30, 8, cell)]) {
      expect(Math.abs(span.x % cell)).toBe(0);
      expect(Math.abs(span.y % cell)).toBe(0);
      expect(span.width % cell).toBe(0);
      expect(span.width).toBeGreaterThan(0);
    }
    expect(snapToGrid(7, cell)).toBe(8);
    const dots = dottedLineCells(0, 40, 10, cell);
    expect(dots).toEqual([0, 10, 20, 30]);
  });
});
