import { describe, expect, it } from "vitest";
import { CAMPAIGN_WINDSOCK_FRAME } from "../src/data/assetManifest";
import { campaignLandingDecor, campaignLandingScenery } from "../src/data/landingScenery";
import { campaignGaugeY, flourPosition, gustWarningAlpha, windsockPlacement } from "../src/entities/landing/campaignPresentation";
import { windsockFrameFor, type LandingWindSample } from "../src/systems/LandingEnvironmentSystem";

const wind: LandingWindSample = { acceleration: { x: 0, y: 0 }, phase: "calm", envelope: 0, exposure: 1, msUntilGust: 0 };

describe("landing windsock sheet semantics", () => {
  it("keeps all final-art pole centres fixed on the mast, including mirrored wind", () => {
    const config = campaignLandingScenery.windsock;
    for (let frame = 0; frame < 4; frame += 1) {
      const poleX = config.poleArtX[frame];
      const poleY = config.poleTopArtY[frame];
      if (poleX === undefined || poleY === undefined) throw new Error("missing windsock anchor");
      for (const direction of [-1, 1]) {
        const placement = windsockPlacement(frame, direction, 568, 648);
        const artX = direction < 0 ? config.frameArtWidth - poleX : poleX;
        expect((artX - placement.originX * config.frameArtWidth) * config.sockScale).toBeCloseTo(0);
        expect((poleY - placement.originY * config.frameArtHeight) * config.sockScale).toBe(0);
        expect(568 + (placement.cropRows - poleY) * config.sockScale).toBe(648);
      }
    }
  });
  it("progresses from limp calm through warning and medium to straight-out strong", () => {
    const samples: readonly LandingWindSample[] = [
      wind,
      { ...wind, phase: "warning" },
      { ...wind, phase: "attack", envelope: 0.4, acceleration: { x: 10, y: 0 } },
      { ...wind, phase: "sustain", envelope: 1, acceleration: { x: 26, y: 0 } },
    ];
    expect(samples.map((sample) => windsockFrameFor(sample, 26))).toEqual(["calm", "warning", "medium", "strong"]);
    expect(samples.map((sample) => CAMPAIGN_WINDSOCK_FRAME[windsockFrameFor(sample, 26)])).toEqual([0, 1, 2, 3]);
  });

  it("stays limp inside the shelter even during a warning or peak gust", () => {
    expect(windsockFrameFor({ ...wind, phase: "warning", exposure: 0 }, 26)).toBe("calm");
    expect(windsockFrameFor({ ...wind, phase: "sustain", exposure: 0, acceleration: { x: 0, y: 0 } }, 26)).toBe("calm");
  });
});

it("keeps the complete descent gauge visible at high spawn and low approach on desktop and phone", () => {
  for (const scale of [1, 1.6, 1.9]) {
    for (const shipY of [-50, 70, 150, 590]) {
      const y = campaignGaugeY(shipY, scale, 612, 102);
      expect(y - 80 * scale).toBeGreaterThanOrEqual(18);
      expect(y + 102 * scale).toBeLessThanOrEqual(604);
    }
  }
});

it("highlights warnings with a gentle pulse and a static reduced-motion cue", () => {
  expect(gustWarningAlpha(0, false)).toBe(1);
  expect(gustWarningAlpha(600, false)).toBeCloseTo(0.78);
  expect(gustWarningAlpha(600, true)).toBe(1);
});

it("flour rises and sways in the apron band, rather than occupying the starfield", () => {
  const start = flourPosition(200, 0.1, 1, 0);
  const later = flourPosition(200, 0.1, 1, 2000);
  expect(later.y).toBeLessThan(start.y);
  expect(later.x).not.toBe(start.x);
  for (const time of [0, 4000, 15000, 100000]) {
    const point = flourPosition(200, 0.1, 1, time);
    expect(point.y).toBeGreaterThanOrEqual(campaignLandingScenery.flour.topY);
    expect(point.y).toBeLessThanOrEqual(campaignLandingScenery.groundTopY);
  }
  expect(campaignLandingDecor.blackHoleBakery.flour).toBe(true);
  expect(campaignLandingDecor.home.flour).toBe(false);
});

it("provides distinct foreground sets and layered terrain for every campaign destination", () => {
  const sets = Object.values(campaignLandingDecor).map((decor) => {
    expect(decor.nearHills.length).toBeGreaterThan(5);
    expect(decor.rocks.length).toBeGreaterThan(2);
    return [...new Set(decor.props.map((prop) => prop.kind))].sort().join(",");
  });
  expect(new Set(sets).size).toBe(5);
  expect(campaignLandingDecor.imFine.windsocks[0]?.mount).toBe("ridge");
});
