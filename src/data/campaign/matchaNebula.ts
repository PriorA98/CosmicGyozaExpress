/** Level 3 — Matcha Nebula Drift: account for a steady current (plan §2). */
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

const destination = { x: 3440, y: 820 } as const;

export const matchaNebulaRoute: FlightRouteDefinition = {
  id: "matcha-nebula-route",
  label: "Matcha Nebula Drift",
  themeId: "matchaNebula",
  world: { width: 3800, height: 2000 },
  start: rest(320, 1120),
  checkpoint: rest(320, 1120),
  destination: { id: "matcha-nebula-dock", label: "Nori's listening post", ...destination, ...CAMPAIGN_DESTINATION },
  obstacles: [
    { id: "matcha-static-01", label: "whisk stone", x: 1200, y: 1430, radius: 72 },
    { id: "matcha-static-02", label: "tea-leaf rock", x: 2180, y: 600, radius: 66 },
  ],
  movingObstacles: [
    {
      id: "matcha-orbit-a",
      label: "drifting sencha pebble",
      radius: 58,
      textureKey: ASSET.asteroidTea,
      path: { kind: "orbit", center: { x: 2820, y: 1360 }, radiusX: 90, radiusY: 90, periodMs: 28000, phaseRadians: 0, clockwise: false },
    },
  ],
  forceZones: [
    {
      kind: "directional-current",
      id: "matcha-current",
      area: { kind: "rect", x: 1000, y: 500, width: 1600, height: 1000 },
      acceleration: { x: 0, y: 38 },
      edgeBlendPx: 160,
    },
  ],
  collectibles: [
    {
      id: "postcard-matcha",
      kind: "postcard",
      position: { x: 1900, y: 800 },
      radius: 36,
      memoryId: "collectible-matcha-postcard",
      textureKey: ASSET.campaignPickups,
      frame: 0,
    },
  ],
  visibility: {
    kind: "fog",
    area: { kind: "rect", x: 760, y: 340, width: 2100, height: 1320 },
    textureKey: ASSET.campaignFog,
    maxAlpha: 0.32,
    driftPixelsPerSecond: { x: 6, y: 2 },
  },
  checkpoints: [{ id: "matcha-checkpoint", activation: { kind: "rect", x: 2880, y: 0, width: 200, height: 2000 }, respawn: rest(2940, 820) }],
  beacons: [],
  cameraFraming: framingNear(destination),
  maxEnvironmentAcceleration: CAMPAIGN_MAX_ENVIRONMENT_ACCELERATION,
};

export const matchaNebulaLanding: LandingDefinition = {
  id: "matcha-nebula-landing",
  themeId: "matchaNebula",
  tuning: campaignLandingTuning({ padWidth: 340 }),
  pad: { centerX: 640, surfaceY: 612, width: 340 },
  padMotion: { kind: "fixed" },
  surfaceTiltRadians: 0,
  // Constant crosswind from the left; a windsock shows it before descent begins.
  wind: { kind: "steady", acceleration: { x: 14, y: 0 } },
  collisionModel: "relative-pad",
};

export const matchaNebulaMission: MissionDefinitionV2 = {
  id: "matcha-nebula",
  order: 3,
  title: "Matcha Nebula Drift",
  shortTitle: "Matcha Nebula",
  senderId: "nori",
  routeId: "matcha-nebula-route",
  landingId: "matcha-nebula-landing",
  themeId: "matchaNebula",
  recipientName: "Nori, the listening-post moth",
  deliveryItemName: "a warm matcha flask",
  requestText: "The fog is louder than usual. Could you bring something warm enough to hold?",
  memoryRewardId: "memory-matcha-nebula-postcard",
  unlocksMissionIds: ["black-hole-bakery"],
  resultLines: expandResultLines(
    "The matcha arrives with its little cloud intact.",
    "Nori says the extra foam looks thoughtful.",
    "Two hands around a warm flask. Nothing else needs explaining.",
  ),
  landingLines: {
    soft: "a quiet arrival through the mist",
    bumpy: "the porch rattled, the welcome did not",
    incident: "a foamy landing, gently retried",
  },
  dashboard: {
    routeStart: "Into the matcha mist. The indicator still knows the way.",
    mechanicIntro: "The wisps show the current. Your drift arrow shows what it's doing.",
    mechanicActive: "Point a little against the flow, then check your drift.",
    checkpoint: "Clear air. The kettle has stopped navigating.",
    bump: "The flask sloshed in a very supportive way.",
    collectible: "A postcard, slightly damp, deeply green.",
    landingIntro: "Wind from the left. A small lean left will help.",
    landingTwist: "Lean into the wind, then puff.",
    gustWarning: "Lean into the wind, then puff.",
    landingCalm: "Steady. Let it come down.",
    afterTouchdown: "Nori holds the flask with both hands.",
  },
  pilotHints: pilotHints([
    waypoint({ x: 850, y: 1120 }),
    waypoint({ x: 1400, y: 1050 }, PILOT_DEFAULTS.crossingSpeed),
    waypoint({ x: 2200, y: 1000 }, PILOT_DEFAULTS.crossingSpeed),
    waypoint({ x: 2940, y: 820 }),
    waypoint(destination, PILOT_DEFAULTS.crossingSpeed),
  ]),
  closingLine: null,
};
