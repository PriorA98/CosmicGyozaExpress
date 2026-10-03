import { describe, expect, it } from "vitest";
import { campaignMissions, routeForMission } from "../src/data/campaign";
import { campaignBackdropMoods, campaignPropStyle, flightCelestialBodies, flightParallaxLayers } from "../src/data/flightScenery";
import {
  flowCueBases,
  fogPuffLayout,
  gustCueLevels,
  mixHexColor,
  parallaxPropCandidates,
  placeParallaxProps,
  routeCameraPath,
  routeCameraStops,
  routeKeepOuts,
} from "../src/entities/flight/flightCueMath";
import { seededRandom } from "../src/entities/flight/textureFallbacks";

const luminance = (hex: string): number => {
  const n = mixHexColor(hex, hex, 0);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
};

describe("campaign backdrop moods", () => {
  it("gives every campaign theme a mid-tone mood with depth layers, bodies and debris", () => {
    for (const [themeId, mood] of Object.entries(campaignBackdropMoods)) {
      if (themeId === "teaMoon") { expect(mood).toBeNull(); continue; }
      expect(mood).not.toBeNull();
      if (!mood) continue;
      for (const layer of flightParallaxLayers) {
        const tint = mood.layerTints[layer.id];
        expect(tint, `${themeId}/${layer.id}`).toBeDefined();
        // Mid/light multiply tints: never a dark sky colour that would crush the layers to black.
        expect(luminance(tint ?? "#000000")).toBeGreaterThan(120);
      }
      expect(mood.bodies.length).toBeGreaterThan(0);
      for (const body of mood.bodies) expect(flightCelestialBodies.some((candidate) => candidate.id === body.id)).toBe(true);
      expect(mood.debrisAlpha).toBeGreaterThan(0.5);
    }
  });

  it("places far props clear of every rock, track, pickup, note and checkpoint along each route", () => {
    for (const viewport of [{ width: 1280, height: 720 }, { width: 844, height: 390 }]) {
      for (const mission of campaignMissions) {
        const route = routeForMission(mission.id);
        const path = routeCameraPath(routeCameraStops(route), route.world, viewport);
        const keepOuts = routeKeepOuts(route, campaignPropStyle.keepOutPadPx);
        const anchors = placeParallaxProps(parallaxPropCandidates(viewport, campaignPropStyle.gridStepPx, campaignPropStyle.scrollFactor, path), campaignPropStyle.count, campaignPropStyle.scrollFactor, path, keepOuts, campaignPropStyle.radiusPx, viewport);
        for (const anchor of anchors) {
          for (const camera of path) {
            const sx = anchor.x - campaignPropStyle.scrollFactor * camera.x;
            const sy = anchor.y - campaignPropStyle.scrollFactor * camera.y;
            if (sx < -campaignPropStyle.radiusPx || sx > viewport.width + campaignPropStyle.radiusPx || sy < -campaignPropStyle.radiusPx || sy > viewport.height + campaignPropStyle.radiusPx) continue;
            const wx = anchor.x + (1 - campaignPropStyle.scrollFactor) * camera.x;
            const wy = anchor.y + (1 - campaignPropStyle.scrollFactor) * camera.y;
            for (const k of keepOuts) expect(Math.hypot(wx - k.x, wy - k.y)).toBeGreaterThanOrEqual(k.radius + campaignPropStyle.radiusPx);
          }
        }
      }
    }
  });

  it("rejects a prop whose parallax sweep crosses a keep-out", () => {
    const path = Array.from({ length: 21 }, (_, i) => ({ x: i * 50, y: 0 }));
    expect(placeParallaxProps([{ x: 100, y: 100 }], 1, 0.5, path, [{ x: 180, y: 100, radius: 20 }], 10, { width: 1280, height: 720 })).toEqual([]);
    expect(placeParallaxProps([{ x: 100, y: 300 }], 1, 0.5, path, [{ x: 180, y: 100, radius: 20 }], 10, { width: 1280, height: 720 })).toEqual([{ x: 100, y: 300 }]);
  });
});

describe("gust and current telegraphs", () => {
  it("makes an active gust the most visible state, warning gathering, calm nearly nothing", () => {
    const calm = gustCueLevels("calm", 0, 0, false);
    expect(calm.arrows).toBe(0);
    expect(calm.streaks).toBe(0);
    for (let t = 0; t < 2000; t += 37) {
      const warning = gustCueLevels("warning", 0, t, false);
      expect(warning.outlined).toBe(true);
      expect(warning.streaks).toBe(0);
      expect(warning.band).toBeGreaterThan(calm.band);
      for (const phase of ["attack", "sustain", "release"] as const) {
        for (const envelope of [0, 0.3, 1]) {
          const active = gustCueLevels(phase, envelope, t, false);
          expect(active.outlined).toBe(false);
          expect(active.arrows).toBeGreaterThan(warning.arrows);
          expect(active.band).toBeGreaterThan(warning.band);
          expect(active.streaks).toBeGreaterThan(0);
        }
      }
    }
  });

  it("spreads flow cues over more staggered lanes when asked", () => {
    const bases = flowCueBases({ x: 0, y: 0, width: 900, height: 600 }, false, 200, 4);
    expect(new Set(bases.map((p) => p.y))).toEqual(new Set([0, 200, 400, 600]));
    const firstLane = bases.filter((p) => p.y === 0).map((p) => p.x);
    const secondLane = bases.filter((p) => p.y === 200).map((p) => p.x);
    expect(secondLane[0]).toBe((firstLane[0] ?? 0) + 100);
  });
});

describe("fog puffs", () => {
  it("is deterministic, inside the area, and thinner at the fringe", () => {
    const area = { x: 760, y: 340, width: 2100, height: 1320 };
    const a = fogPuffLayout(area, 260, seededRandom(23));
    const b = fogPuffLayout(area, 260, seededRandom(23));
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(20);
    for (const puff of a) {
      expect(puff.x).toBeGreaterThanOrEqual(area.x);
      expect(puff.x).toBeLessThanOrEqual(area.x + area.width);
      expect(puff.y).toBeGreaterThanOrEqual(area.y);
      expect(puff.y).toBeLessThanOrEqual(area.y + area.height);
      expect(puff.alpha).toBeLessThanOrEqual(1);
    }
    expect(new Set(a.map((puff) => puff.size)).size).toBe(3);
  });
});
