/** Level 2 — Asteroid Bento Belt: read predictable motion (plan §2). */
import { ASSET } from "../assetManifest";
import type { FlightRouteDefinition, LandingDefinition, MissionDefinitionV2 } from "../../types/campaign";
import {
  CAMPAIGN_DESTINATION,
  CAMPAIGN_MAX_ENVIRONMENT_ACCELERATION,
  PILOT_DEFAULTS,
  campaignLandingTuning,
  expandResultLines,
  framingNear,
  pilotHints,
  rest,
  waypoint,
} from "./campaignHelpers";

const destination = { x: 3260, y: 900 } as const;

export const bentoBeltRoute: FlightRouteDefinition = {
  id: "bento-belt-route",
  label: "Asteroid Bento Belt",
  themeId: "bentoBelt",
  world: { width: 3600, height: 1800 },
  start: rest(320, 900),
  checkpoint: rest(320, 900),
  destination: { id: "bento-belt-dock", label: "Mallow's lunch dock", ...destination, ...CAMPAIGN_DESTINATION },
  obstacles: [
    { id: "bento-static-01", label: "rice ball rock", x: 800, y: 600, radius: 70 },
    { id: "bento-static-02", label: "pickle pebble", x: 920, y: 1130, radius: 64 },
    { id: "bento-static-03", label: "chopstick rest", x: 2740, y: 650, radius: 62 },
  ],
  movingObstacles: [
    {
      id: "bento-moving-a",
      label: "lunch-tray rock",
      radius: 68,
      textureKey: ASSET.asteroidMochi,
      path: { kind: "ping-pong", from: { x: 1300, y: 650 }, to: { x: 1300, y: 1150 }, periodMs: 26000, phaseOffsetMs: 0 },
    },
    {
      id: "bento-moving-b",
      label: "tamago tumbler",
      radius: 76,
      textureKey: ASSET.asteroidRice,
      path: { kind: "ping-pong", from: { x: 2080, y: 850 }, to: { x: 2440, y: 850 }, periodMs: 24000, phaseOffsetMs: 0 },
    },
    {
      id: "bento-orbit-c",
      label: "orbiting umeboshi",
      radius: 56,
      textureKey: ASSET.asteroidCrumb,
      path: { kind: "orbit", center: { x: 2500, y: 560 }, radiusX: 130, radiusY: 130, periodMs: 22000, phaseRadians: 0, clockwise: true },
    },
  ],
  forceZones: [],
  collectibles: [
    {
      id: "postcard-bento",
      kind: "postcard",
      position: { x: 1800, y: 480 },
      radius: 36,
      memoryId: "collectible-bento-postcard",
      textureKey: ASSET.campaignPickups,
      frame: 0,
    },
  ],
  visibility: { kind: "clear" },
  checkpoints: [{ id: "bento-checkpoint", activation: { kind: "rect", x: 2780, y: 0, width: 240, height: 1800 }, respawn: rest(2860, 1380) }],
  beacons: [],
  cameraFraming: framingNear(destination),
  maxEnvironmentAcceleration: CAMPAIGN_MAX_ENVIRONMENT_ACCELERATION,
};

export const bentoBeltLanding: LandingDefinition = {
  id: "bento-belt-landing",
  themeId: "bentoBelt",
  tuning: campaignLandingTuning({ padWidth: 360 }),
  pad: { centerX: 576, surfaceY: 612, width: 360 },
  // Slides 576 ↔ 704 over 12 s (peak ≈ 34 px/s), starting at the left endpoint.
  padMotion: {
    kind: "path",
    path: { kind: "ping-pong", from: { x: 576, y: 612 }, to: { x: 704, y: 612 }, periodMs: 12000, phaseOffsetMs: 0 },
  },
  surfaceTiltRadians: 0,
  wind: { kind: "none" },
  collisionModel: "relative-pad",
};

export const bentoBeltMission: MissionDefinitionV2 = {
  id: "bento-belt",
  order: 2,
  title: "Asteroid Bento Belt",
  shortTitle: "Bento Belt",
  senderId: "mallow",
  routeId: "bento-belt-route",
  landingId: "bento-belt-landing",
  themeId: "bentoBelt",
  recipientName: "Mallow, the lunch-break mechanic",
  deliveryItemName: "a three-tier asteroid bento",
  requestText: "The lunch platform keeps drifting away from my chair. Could you bring lunch to whichever one arrives first?",
  memoryRewardId: "memory-bento-belt-postcard",
  unlocksMissionIds: ["matcha-nebula"],
  resultLines: expandResultLines(
    "Every compartment is still enjoying its own lunch.",
    "The side dishes have introduced themselves.",
    "Mallow calls it a sharing platter and means it.",
  ),
  landingLines: {
    soft: "lunch arrived in step",
    bumpy: "a little platform percussion, lunch welcome",
    incident: "lunch reassembled on a moving table",
  },
  dashboard: {
    routeStart: "Lunch run. The belt rocks follow tracks.",
    mechanicIntro: "Those rocks follow tracks. Watch one pass, then choose your gap.",
    mechanicActive: "The long way still arrives at lunch.",
    checkpoint: "Route remembered.",
    bump: "The bento has requested a seating chart.",
    collectible: "Postcard tucked into the lunch lid.",
    landingIntro: "Match the platform's drift. The rail shows where it goes.",
    landingTwist: "Drift with the platform, then drop.",
    gustWarning: "Drift with the platform, then drop.",
    landingCalm: "Riding along nicely. Ease down.",
    afterTouchdown: "Lunch is served, mid-slide.",
  },
  pilotHints: pilotHints([
    waypoint({ x: 720, y: 1400 }),
    waypoint({ x: 1500, y: 1420 }, PILOT_DEFAULTS.crossingSpeed),
    waypoint({ x: 2450, y: 1420 }, PILOT_DEFAULTS.crossingSpeed),
    waypoint({ x: 2860, y: 1300 }),
    waypoint(destination, PILOT_DEFAULTS.crossingSpeed),
  ]),
  closingLine: null,
};
