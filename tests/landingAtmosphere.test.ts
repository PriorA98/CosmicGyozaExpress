import { describe, expect, it } from "vitest";
import { campaignLandingDecor, campaignLandingScenery, landingScenery } from "../src/data/landingScenery";
import { campaignThemes } from "../src/data/campaign/themes";
import { landingForMission } from "../src/data/campaign";
import { ambientMotePosition, campaignSkyBandColors, resolvePropPosition } from "../src/entities/landing/campaignPresentation";
import { mixHex } from "../src/entities/landing/colorMix";
import { landingTouchTiles } from "../src/entities/landing/landingTouchLayout";

const decors = Object.values(campaignLandingDecor);

describe("campaign landing atmosphere", () => {
  it("gives every destination its own building, berth finish, rocks, ground and tones", () => {
    for (const key of ["porch", "berth", "rockShape", "ground", "tones"] as const) {
      const values = decors.map((decor) => JSON.stringify(key === "porch" ? decor.porch.style : key === "berth" ? [decor.berth.trim, decor.berth.tint] : decor[key]));
      expect(new Set(values).size, key).toBe(decors.length);
    }
    const rockLayouts = decors.map((decor) => decor.rocks.map((rock) => rock.x).join(","));
    expect(new Set(rockLayouts).size).toBe(decors.length);
  });

  it("keeps painted backdrop slots open for the final-art wave (code-drawn fallback today)", () => {
    for (const decor of decors) {
      expect(Object.keys(decor.backdrop).sort()).toEqual(["farHillsTexture", "groundTexture", "skyTexture"]);
    }
  });

  it("builds a vertical sky gradient that ends on the horizon glow", () => {
    const palette = campaignThemes.matchaNebula.palette;
    const bands = campaignSkyBandColors(palette.skyTop, palette.skyBottom, campaignLandingDecor.matchaNebula.tones.horizon, 20);
    expect(bands).toHaveLength(20);
    expect(bands[0]).toBe(mixHex(palette.skyTop, palette.skyTop, 0));
    expect(bands[19]).toBe(mixHex(campaignLandingDecor.matchaNebula.tones.horizon, palette.skyTop, 0));
    expect(new Set(bands).size).toBeGreaterThan(12);
  });

  it("places ground props clear of the touch pads on touch layouts", () => {
    const tiles = landingTouchTiles(1280, 720, landingScenery.touch);
    const leftClear = tiles.rotateRight.x + tiles.rotateRight.width;
    const touchX = campaignLandingScenery.recipient.touchX;
    for (const decor of decors) {
      for (const prop of decor.props) {
        const at = resolvePropPosition(prop, true, touchX);
        if (!at || at.y < tiles.stabilizer.y || prop.kind === "puddle" || prop.kind === "mist") continue;
        expect(at.x, `${prop.kind}@${prop.x}`).toBeGreaterThan(leftClear + 24);
        expect(at.x, `${prop.kind}@${prop.x}`).toBeLessThan(tiles.thrust.x - 24);
      }
      expect(touchX + decor.porch.width / 2 + 16).toBeLessThan(tiles.thrust.x);
    }
    expect(resolvePropPosition({ kind: "crate", x: 146, y: 648 }, false, campaignLandingScenery.recipient.x)).toEqual({ x: 146, y: 648 });
  });

  it("mounts the im-fine high windsock on the roof ridge, exposed to gusts and below its planet", () => {
    const landing = landingForMission("im-fine");
    const sock = campaignLandingDecor.imFine.windsocks.find((entry) => entry.mount === "ridge");
    expect(sock).toBeDefined();
    if (landing.wind.kind !== "gust" || landing.wind.shelter === null || !sock) throw new Error("expected a sheltered gust landing");
    expect(sock.altitude).toBeGreaterThanOrEqual(landing.wind.shelter.fullyExposedAltitude);
    const sockY = landing.pad.surfaceY - sock.altitude;
    // Destination art is 160 art px square at 2x: its planet + ring end well above the sock.
    expect(sockY).toBeGreaterThan(campaignLandingDecor.imFine.landmark.y + 160);
  });

  it("moves ambient motes deterministically: rain slants with the sampled wind, fireflies blink", () => {
    const mote = { x: 400, phase: 0.3, speed: 1 };
    const still = ambientMotePosition("rain", mote, 1000, 0);
    const windy = ambientMotePosition("rain", mote, 1000, 20);
    expect(windy.y).toBe(still.y);
    expect(windy.x).toBeGreaterThan(still.x);
    for (let t = 0; t < 10000; t += 700) {
      const fly = ambientMotePosition("firefly", mote, t, 0);
      expect(fly.alpha).toBeGreaterThanOrEqual(0.2);
      expect(fly.alpha).toBeLessThanOrEqual(1);
      expect(fly.y).toBeLessThan(campaignLandingScenery.groundTopY);
      const dust = ambientMotePosition("drift", mote, t, 0);
      expect(dust.x).toBeGreaterThanOrEqual(-20);
      expect(dust.x).toBeLessThan(1300);
    }
  });
});
