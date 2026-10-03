import { describe, expect, it } from "vitest";
import { CAMPAIGN_WINDSOCK_FRAME } from "../src/data/assetManifest";
import { advanceSimClock, simulationSteps, windsockFrame, quarterTurnRotation, octantIndex, wrap, zoneBounds, pickRockTexture, flowCueBases, cueIsClear, clearIndicatorPosition } from "../src/entities/flight/flightCueMath";

describe("campaign flight clock", () => {
  it("consumes at most 50 ms, split into steps no larger than 1/120 s", () => {
    const steps = simulationSteps(4000, 50, 1000 / 120);
    expect(steps.length).toBe(6);
    expect(steps.reduce((total, step) => total + step, 0)).toBeCloseTo(50);
    expect(steps.every((step) => step > 0 && step <= 1000 / 120)).toBe(true);
    expect(advanceSimClock(1200, 4000, 50)).toBe(1250);
  });

  it("does not advance for a paused or invalid frame and preserves fractional frames", () => {
    for (const delta of [0, -30, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(simulationSteps(delta, 50, 1000 / 120)).toEqual([]);
      expect(advanceSimClock(1200, delta, 50)).toBe(1200);
    }
    expect(simulationSteps(9, 50, 1000 / 120).reduce((total, step) => total + step, 0)).toBe(9);
  });
});

describe("destination indicator keep-out", () => {
  const footprint = { x: -70, y: -44, width: 140, height: 132 };
  it("slides the complete pin and label clear of an envelope, rock and lantern glow", () => {
    for (const radius of [44, 84, 80]) {
      const obstacles = [{ x: 1180, y: 250, radius }];
      const point = clearIndicatorPosition({ x: 1180, y: 250 }, true, 110, 550, footprint, obstacles, []);
      expect(point.x).toBe(1180);
      expect(point.y).toBeGreaterThanOrEqual(110);
      expect(point.y).toBeLessThanOrEqual(550);
      const top = point.y + footprint.y;
      const bottom = top + footprint.height;
      expect(Math.max(top - 250, 250 - bottom)).toBeGreaterThan(radius + 8);
    }
  });
  it("preserves a clear position and slides along horizontal edges without entering HUD panels", () => {
    const original = { x: 600, y: 110 };
    expect(clearIndicatorPosition(original, false, 100, 1180, footprint, [], [])).toEqual(original);
    const panel = { x: 500, y: 0, width: 200, height: 200 };
    const shifted = clearIndicatorPosition(original, false, 100, 1180, footprint, [], [panel]);
    expect(shifted.y).toBe(110);
    expect(shifted.x + 70 <= panel.x || shifted.x - 70 >= panel.x + panel.width).toBe(true);
  });
});

describe("force telegraphs", () => {
  it("uses three lanes and hides cues near the ship or HUD", () => {
    const bases = flowCueBases({ x: 100, y: 200, width: 600, height: 900 }, true, 300);
    expect(new Set(bases.map((p) => p.x))).toEqual(new Set([100, 400, 700]));
    const point = { x: 500, y: 300 };
    expect(cueIsClear(point, point, point, 1280, 720, [])).toBe(false);
    expect(cueIsClear(point, { x: 900, y: 400 }, { x: 500, y: 40 }, 1280, 720, [])).toBe(false);
    expect(cueIsClear(point, { x: 900, y: 400 }, point, 1280, 720, [{ x: 480, y: 270, width: 100, height: 100 }])).toBe(false);
    expect(cueIsClear(point, { x: 900, y: 400 }, point, 1280, 720, [])).toBe(true);
  });
  it("shows warning before force, strong at sustain, and settles on release", () => {
    expect(windsockFrame("warning", 0)).toBe(CAMPAIGN_WINDSOCK_FRAME.warning);
    expect(windsockFrame("calm", 0)).toBe(CAMPAIGN_WINDSOCK_FRAME.calm);
    expect(windsockFrame("sustain", 1)).toBe(CAMPAIGN_WINDSOCK_FRAME.strong);
    expect(windsockFrame("attack", 0.3)).toBe(CAMPAIGN_WINDSOCK_FRAME.medium);
    expect(windsockFrame("release", 0.1)).toBe(CAMPAIGN_WINDSOCK_FRAME.calm);
  });

  it("keeps cardinal arrows and diagonal HUD directions aligned to the push", () => {
    expect(quarterTurnRotation(0, 0)).toBe(0);
    expect(quarterTurnRotation(0, 38)).toBe(Math.PI / 2);
    expect(quarterTurnRotation(0, -58)).toBe(-Math.PI / 2);
    expect(octantIndex(1, 1)).toBe(1);
    expect(octantIndex(1, -1)).toBe(7);
    expect(octantIndex(-1, 0)).toBe(4);
    expect(wrap(-1, 200)).toBe(199);
    expect(wrap(201, 200)).toBe(1);
  });

  it("bounds circular cue fields and chooses authored rocks deterministically", () => {
    expect(zoneBounds({ kind: "circle", center: { x: 100, y: 200 }, radius: 50 })).toEqual({ x: 50, y: 150, width: 100, height: 100 });
    const rocks = [{ key: "large", canvasArtPx: 100 }, { key: "small", canvasArtPx: 66 }, { key: "medium", canvasArtPx: 76 }];
    expect(pickRockTexture(rocks, 68, 0)).toBe("small");
    expect(pickRockTexture(rocks, 68, 1)).toBe("medium");
    expect(pickRockTexture(rocks, 68, 2)).toBe("small");
  });
});
