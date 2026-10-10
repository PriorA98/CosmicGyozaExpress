import { describe, expect, it } from "vitest";
import { campaignMissions, getLanding, getRoute, landingForMission, resolveMission, routeForMission } from "../src/data/campaign";
import { campaignThemes } from "../src/data/campaign/themes";
import { flightPrototypeRoute } from "../src/data/flightPrototypeRoute";
import { landingTuning } from "../src/data/landingTuning";
import { ASSET_MANIFEST } from "../src/data/assetManifest";
import {
  isCampaignComplete,
  missionBoard,
  nextMissionAfter,
  nextSuggestedMission,
  normalizeCampaignProgress,
} from "../src/systems/CampaignSystem";
import { sampleForceField, sampleForceZone, sampleGustCycle, gustCycleLength } from "../src/systems/ForceFieldSystem";
import { motionPathPeakSpeed, sampleMotionPath } from "../src/systems/MotionPathSystem";
import { checkpointAt, collectAlongSegment } from "../src/systems/CollectibleSystem";
import { sampleLandingPad, sampleLandingWind, shelterExposure } from "../src/systems/LandingEnvironmentSystem";
import { integrateShipMovement } from "../src/systems/ShipMovementSystem";
import { integrateLandingMovement, createLandingState } from "../src/systems/LandingSystem";
import { shipTuning } from "../src/data/tuning";
import type { ForceZoneDefinition, MotionPathDefinition, ZoneShape } from "../src/types/campaign";
import { distanceBetween } from "../src/utils/math";

const PACKAGE_LABELS = [
  "Perfect",
  "Slightly shaken",
  "Emotionally rotated",
  "Warm but confused",
  "Still delicious",
  "Dramatically rearranged",
  "Basically fine",
] as const;

function inShape(shape: ZoneShape, p: { x: number; y: number }): boolean {
  return shape.kind === "circle"
    ? distanceBetween(shape.center, p) <= shape.radius
    : p.x >= shape.x && p.x <= shape.x + shape.width && p.y >= shape.y && p.y <= shape.y + shape.height;
}

describe("campaign registry", () => {
  it("lists six missions in board order with resolvable routes, landings and themes", () => {
    expect(campaignMissions.map((m) => m.id)).toEqual(["tea-moon", "bento-belt", "matcha-nebula", "black-hole-bakery", "im-fine", "home-delivery"]);
    campaignMissions.forEach((mission, index) => {
      expect(mission.order).toBe(index + 1);
      expect(getRoute(mission.routeId).id).toBe(mission.routeId);
      expect(getLanding(mission.landingId).id).toBe(mission.landingId);
      expect(campaignThemes[mission.themeId]).toBeDefined();
      for (const label of PACKAGE_LABELS) expect(mission.resultLines[label].length).toBeGreaterThan(0);
    });
  });

  it("chains unlocks linearly and ends at home", () => {
    for (let i = 0; i < campaignMissions.length - 1; i += 1) {
      expect(campaignMissions[i]!.unlocksMissionIds).toEqual([campaignMissions[i + 1]!.id]);
    }
    expect(resolveMission("home-delivery").unlocksMissionIds).toEqual([]);
  });

  it("keeps Tea Moon route and shared hover landing tuning", () => {
    const route = routeForMission("tea-moon");
    expect(route.world).toEqual(flightPrototypeRoute.world);
    expect(route.start).toEqual(flightPrototypeRoute.start);
    expect(route.destination).toEqual(flightPrototypeRoute.destination);
    expect(route.obstacles).toEqual(flightPrototypeRoute.obstacles);
    expect(route.forceZones).toEqual([]);
    expect(route.movingObstacles).toEqual([]);
    expect(landingForMission("tea-moon").tuning).toBe(landingTuning);
    expect(landingForMission("tea-moon").collisionModel).toBe("legacy-horizontal");
    expect(resolveMission("not-a-mission").id).toBe("tea-moon");
  });

  it("every texture key referenced by campaign data exists in the asset manifest", () => {
    const keys = new Set(ASSET_MANIFEST.map((entry) => entry.key));
    for (const mission of campaignMissions) {
      const route = getRoute(mission.routeId);
      for (const rock of route.movingObstacles) expect(keys.has(rock.textureKey), rock.textureKey).toBe(true);
      for (const card of route.collectibles) expect(keys.has(card.textureKey), card.textureKey).toBe(true);
      if (route.visibility.kind === "fog") expect(keys.has(route.visibility.textureKey)).toBe(true);
      const theme = campaignThemes[mission.themeId];
      expect(keys.has(theme.destinationTexture), theme.destinationTexture).toBe(true);
      if (theme.portraitTexture) expect(keys.has(theme.portraitTexture)).toBe(true);
    }
  });
});

describe("authored route validity", () => {
  for (const mission of campaignMissions) {
    const route = getRoute(mission.routeId);
    const landing = getLanding(mission.landingId);
    it(`${mission.id}: positions inside the world, finite, positive periods, safe spawns, calm arrival`, () => {
      const inside = (p: { x: number; y: number }) => p.x > 0 && p.y > 0 && p.x < route.world.width && p.y < route.world.height;
      expect(inside(route.start)).toBe(true);
      expect(inside(route.destination)).toBe(true);
      for (const zone of route.forceZones) {
        // No force at spawn or inside the delivery ring.
        expect(sampleForceZone(zone, route.start, 0).influence).toBe(0);
        for (let t = 0; t < 20000; t += 500) expect(sampleForceZone(zone, route.destination, t).influence).toBe(0);
      }
      // Phase 4: forces stay below thrust and brake, so every spot is escapable.
      expect(route.maxEnvironmentAcceleration).toBeLessThan(shipTuning.thrustAcceleration);
      for (const rock of route.movingObstacles) {
        expect(rock.path.periodMs).toBeGreaterThan(0);
        expect(motionPathPeakSpeed(rock.path)).toBeLessThan(260);
        // Track never comes near spawn, checkpoints or the dock.
        for (let t = 0; t < rock.path.periodMs; t += 250) {
          const p = sampleMotionPath(rock.path, t).position;
          expect(distanceBetween(p, route.start)).toBeGreaterThan(rock.radius + 160);
          expect(distanceBetween(p, route.destination)).toBeGreaterThan(rock.radius + route.destination.approachRadius / 2);
          for (const cp of route.checkpoints) expect(distanceBetween(p, cp.respawn)).toBeGreaterThan(rock.radius + 100);
        }
      }
      for (const cp of route.checkpoints) {
        expect(inShape(cp.activation, cp.respawn) || cp.respawn.x > cp.activation.x).toBe(true);
        // A respawn may sit in a mild pull or a river (which only carries you along), never in a strong pull,
        // a gust, or a koi's hearing.
        const pushing = route.forceZones.filter((zone) => zone.kind !== "directional-current" || zone.flowSpeed === null);
        for (let t = 0; t < 15000; t += 250) {
          expect(sampleForceField(pushing, cp.respawn, t, route.maxEnvironmentAcceleration).magnitude).toBeLessThanOrEqual(shipTuning.thrustAcceleration * 0.25);
        }
        for (const koi of route.seekers) expect(distanceBetween(koi.home, cp.respawn)).toBeGreaterThan(koi.hearingRadius * 0.6);
        for (const rock of route.obstacles) expect(distanceBetween(rock, cp.respawn)).toBeGreaterThan(rock.radius + shipTuning.collisionRadius + 20);
      }
      expect(landing.surfaceTiltRadians).toBe(0);
      expect(landing.tuning.padWidth).toBe(landing.pad.width);
      expect(landing.tuning.surfaceY).toBe(landing.pad.surfaceY);
    });
  }
});

describe("ForceFieldSystem", () => {
  const well: ForceZoneDefinition = { kind: "radial-gravity", id: "w", center: { x: 0, y: 0 }, radius: 900, coreRadius: 180, peakAcceleration: 70, falloff: "flat", edgeBlendPx: 140, warp: null };

  it("radial gravity is finite, zero at the centre and outside, points inward", () => {
    expect(sampleForceZone(well, { x: 0, y: 0 }, 0).acceleration).toEqual({ x: 0, y: 0 });
    expect(sampleForceZone(well, { x: 950, y: 0 }, 0).acceleration).toEqual({ x: 0, y: 0 });
    const mid = sampleForceZone(well, { x: 400, y: 0 }, 0);
    expect(mid.acceleration.x).toBeCloseTo(-70);
    expect(mid.acceleration.y).toBeCloseTo(0);
    const core = sampleForceZone(well, { x: 90, y: 0 }, 0);
    expect(core.acceleration.x).toBeCloseTo(-35);
    for (let d = 0; d <= 900; d += 7) {
      const a = sampleForceZone(well, { x: d, y: 0 }, 0).acceleration.x;
      expect(Number.isFinite(a)).toBe(true);
      expect(Math.abs(a)).toBeLessThanOrEqual(70 + 1e-9);
    }
  });

  it("full thrust always beats the well (escape is always possible)", () => {
    expect(70).toBeLessThan(shipTuning.thrustAcceleration / 4);
  });

  it("current fades in over the edge blend and caps summed fields", () => {
    const current: Extract<ForceZoneDefinition, { kind: "directional-current" }> = { kind: "directional-current", id: "c", area: { kind: "rect", x: 0, y: 0, width: 1000, height: 1000 }, acceleration: { x: 0, y: 38 }, edgeBlendPx: 160, flowSpeed: null };
    expect(sampleForceZone(current, { x: -1, y: 500 }, 0).influence).toBe(0);
    expect(sampleForceZone(current, { x: 80, y: 500 }, 0).acceleration.y).toBeCloseTo(19);
    expect(sampleForceZone(current, { x: 500, y: 500 }, 0).acceleration.y).toBeCloseTo(38);
    const strong: ForceZoneDefinition = { ...current, acceleration: { x: 0, y: 300 } };
    expect(sampleForceField([strong, current], { x: 500, y: 500 }, 0, 110).magnitude).toBeCloseTo(110);
  });

  it("gust cycle: warning pushes nothing and always precedes the attack", () => {
    const cycle = { warningMs: 2000, attackMs: 800, sustainMs: 2000, releaseMs: 1200, calmMs: 4000, phaseOffsetMs: 0, alternate: false };
    expect(gustCycleLength(cycle)).toBe(10000);
    expect(sampleGustCycle(cycle, 0)).toMatchObject({ phase: "warning", envelope: 0, msUntilGust: 2000 });
    expect(sampleGustCycle(cycle, 2400).phase).toBe("attack");
    expect(sampleGustCycle(cycle, 3500)).toMatchObject({ phase: "sustain", envelope: 1 });
    expect(sampleGustCycle(cycle, 5400).phase).toBe("release");
    expect(sampleGustCycle(cycle, 7000)).toMatchObject({ phase: "calm", envelope: 0 });
    expect(sampleGustCycle(cycle, 10000).phase).toBe("warning");
    let previousPhase = sampleGustCycle(cycle, 0).phase;
    for (let t = 10; t < 30000; t += 10) {
      const phase = sampleGustCycle(cycle, t).phase;
      if (phase === "attack" && previousPhase !== "attack") expect(previousPhase).toBe("warning");
      previousPhase = phase;
    }
  });
});

describe("MotionPathSystem", () => {
  const pingPong: MotionPathDefinition = { kind: "ping-pong", from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, periodMs: 10000, phaseOffsetMs: 0 };
  it("ping-pong eases between endpoints and is periodic", () => {
    expect(sampleMotionPath(pingPong, 0).position.x).toBeCloseTo(0);
    expect(sampleMotionPath(pingPong, 5000).position.x).toBeCloseTo(100);
    expect(sampleMotionPath(pingPong, 10000).position.x).toBeCloseTo(0);
    expect(sampleMotionPath(pingPong, 0).velocity.x).toBeCloseTo(0);
  });
  it("analytical velocity matches finite differences", () => {
    const orbit: MotionPathDefinition = { kind: "orbit", center: { x: 0, y: 0 }, radiusX: 130, radiusY: 90, periodMs: 22000, phaseRadians: 0.3, clockwise: true };
    for (const path of [pingPong, orbit]) {
      for (const t of [1234, 4000, 9100]) {
        const a = sampleMotionPath(path, t);
        const b = sampleMotionPath(path, t + 1);
        expect((b.position.x - a.position.x) * 1000).toBeCloseTo(a.velocity.x, 0);
        expect((b.position.y - a.position.y) * 1000).toBeCloseTo(a.velocity.y, 0);
      }
    }
  });
});

describe("collectibles and checkpoints", () => {
  const card = { id: "c", kind: "postcard" as const, position: { x: 100, y: 0 }, radius: 10, memoryId: "m", textureKey: "k", frame: 0 };
  it("swept pickup catches fast passes once", () => {
    const first = collectAlongSegment({ x: 0, y: 0 }, { x: 400, y: 0 }, 42, [card], new Set());
    expect(first.newlyCollected).toHaveLength(1);
    expect(collectAlongSegment({ x: 0, y: 0 }, { x: 400, y: 0 }, 42, [card], first.collectedIds).newlyCollected).toHaveLength(0);
    expect(collectAlongSegment({ x: 0, y: 200 }, { x: 400, y: 200 }, 42, [card], new Set()).newlyCollected).toHaveLength(0);
  });
  it("checkpoint lookup", () => {
    const route = routeForMission("bento-belt");
    expect(checkpointAt(route.checkpoints, { x: 2800, y: 900 })?.id).toBe("bento-checkpoint");
    expect(checkpointAt(route.checkpoints, { x: 1000, y: 900 })).toBeNull();
  });
});

describe("landing environment", () => {
  it("Bento tray slides 480 → 800 and back every 12 s, faster than the sideways limit", () => {
    const landing = landingForMission("bento-belt");
    expect(sampleLandingPad(landing, 0).pad.centerX).toBeCloseTo(480);
    expect(sampleLandingPad(landing, 6000).pad.centerX).toBeCloseTo(800);
    const peak = Math.abs(sampleLandingPad(landing, 3000).velocity.x);
    expect(peak).toBeCloseTo(83.8, 0);
    expect(peak).toBeGreaterThan(landing.tuning.safeHorizontalSpeed);
  });
  it("I'm Fine squall is zero in the last 40 px, full above 110 px, and swaps sides every gust", () => {
    const wind = landingForMission("im-fine").wind;
    expect(shelterExposure(wind, 30)).toBe(0);
    expect(shelterExposure(wind, 75)).toBeCloseTo(0.5);
    expect(shelterExposure(wind, 300)).toBe(1);
    expect(sampleLandingWind(wind, 300, 3000).acceleration.x).toBeCloseTo(140);
    expect(sampleLandingWind(wind, 300, 3000 + 6000).acceleration.x).toBeCloseTo(-140);
    expect(sampleLandingWind(wind, 40, 3000).acceleration.x).toBe(0);
    expect(sampleLandingWind(wind, 300, 0).acceleration.x).toBe(0);
  });
  it("Matcha mist pushes right up high and left near the pad", () => {
    const wind = landingForMission("matcha-nebula").wind;
    expect(sampleLandingWind(wind, 400, 0).acceleration.x).toBeCloseTo(75);
    expect(sampleLandingWind(wind, 100, 0).acceleration.x).toBeCloseTo(-100);
    const middle = sampleLandingWind(wind, 260, 0).acceleration.x;
    expect(middle).toBeGreaterThan(-100);
    expect(middle).toBeLessThan(75);
  });
});

describe("environment integration keeps forces additive", () => {
  it("zero / omitted environment matches the original ship integration", () => {
    const state = { x: 10, y: 20, rotation: 0.4, velocityX: 30, velocityY: -12 };
    const controls = { thrust: true, brake: false, rotateLeft: false, rotateRight: true };
    expect(integrateShipMovement(state, controls, 1 / 60, shipTuning, { x: 0, y: 0 })).toEqual(integrateShipMovement(state, controls, 1 / 60));
    const pushed = integrateShipMovement(state, controls, 1 / 60, shipTuning, { x: 0, y: 60 });
    expect(pushed.velocityY).toBeGreaterThan(integrateShipMovement(state, controls, 1 / 60).velocityY);
  });
  it("landing wind adds lateral velocity, gravity unchanged", () => {
    const state = createLandingState();
    const controls = { thrust: false, left: false, right: false, stabilizer: false };
    expect(integrateLandingMovement(state, controls, 1 / 60, landingTuning, { x: 0, y: 0 })).toEqual(integrateLandingMovement(state, controls, 1 / 60));
    expect(integrateLandingMovement(state, controls, 1 / 60, landingTuning, { x: 14, y: 0 }).velocityX).toBeGreaterThan(0);
  });
});

describe("CampaignSystem", () => {
  it("normalizes untrusted progress and unlocks the next delivery", () => {
    const progress = normalizeCampaignProgress(["tea-moon", "tea-moon", "bogus", 7], ["nope"]);
    expect(progress.completedMissions).toEqual(["tea-moon"]);
    expect(progress.unlockedMissions).toEqual(["tea-moon", "bento-belt"]);
    expect(nextSuggestedMission(progress).id).toBe("bento-belt");
    expect(nextMissionAfter("tea-moon", progress)?.id).toBe("bento-belt");
  });
  it("never infers completion of skipped missions", () => {
    const progress = normalizeCampaignProgress([], ["im-fine"]);
    expect(progress.completedMissions).toEqual([]);
    expect(missionBoard(progress).find((node) => node.mission.id === "im-fine")?.state).toBe("available");
    expect(missionBoard(progress).find((node) => node.mission.id === "bento-belt")?.state).toBe("locked");
  });
  it("board states and completion", () => {
    const all = normalizeCampaignProgress(campaignMissions.map((m) => m.id), []);
    expect(isCampaignComplete(all)).toBe(true);
    expect(missionBoard(all).every((node) => node.state === "completed")).toBe(true);
    expect(nextSuggestedMission(all).id).toBe("home-delivery");
    expect(missionBoard(normalizeCampaignProgress([], [])).find((n) => n.mission.id === "bento-belt")?.unlockedBy?.id).toBe("tea-moon");
  });
});
