/** Level 4 — Black Hole Bakery: gravity pull that changes direction with position (plan §2). */
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

const destination = { x: 3600, y: 780 } as const;
export const BAKERY_WELL_CENTER = { x: 2100, y: 1140 } as const;

export const blackHoleBakeryRoute: FlightRouteDefinition = {
  id: "black-hole-bakery-route",
  label: "Black Hole Bakery",
  themeId: "blackHoleBakery",
  world: { width: 4000, height: 2200 },
  start: rest(320, 1500),
  checkpoint: rest(320, 1500),
  destination: { id: "black-hole-bakery-dock", label: "Pip's bakery", ...destination, ...CAMPAIGN_DESTINATION },
  obstacles: [
    { id: "bakery-static-01", label: "burnt crust", x: 1050, y: 1350, radius: 72 },
    { id: "bakery-static-02", label: "sourdough boulder", x: 1880, y: 1670, radius: 90 },
    { id: "bakery-static-03", label: "flour sack rock", x: 2830, y: 1310, radius: 70 },
  ],
  movingObstacles: [
    {
      id: "bakery-orbit-a",
      label: "orbiting bun",
      radius: 60,
      textureKey: ASSET.asteroidSleepy,
      path: {
        kind: "orbit",
        center: BAKERY_WELL_CENTER,
        radiusX: 490,
        radiusY: 490,
        periodMs: 44000,
        phaseRadians: Math.PI / 2,
        clockwise: true,
      },
    },
  ],
  forceZones: [
    {
      kind: "radial-gravity",
      id: "bakery-well",
      center: BAKERY_WELL_CENTER,
      radius: 900,
      coreRadius: 180,
      peakAcceleration: 70,
      edgeBlendPx: 140,
    },
  ],
  collectibles: [
    {
      id: "postcard-bakery",
      kind: "postcard",
      position: { x: 2110, y: 400 },
      radius: 36,
      memoryId: "collectible-bakery-postcard",
      textureKey: ASSET.campaignPickups,
      frame: 0,
    },
  ],
  visibility: { kind: "clear" },
  checkpoints: [
    { id: "bakery-checkpoint", activation: { kind: "rect", x: 3120, y: 0, width: 180, height: 2200 }, respawn: rest(3200, 780) },
  ],
  beacons: [],
  cameraFraming: framingNear(destination),
  maxEnvironmentAcceleration: CAMPAIGN_MAX_ENVIRONMENT_ACCELERATION,
};

export const blackHoleBakeryLanding: LandingDefinition = {
  id: "black-hole-bakery-landing",
  themeId: "blackHoleBakery",
  // Light gravity on the station apron: short puffs go a long way.
  tuning: campaignLandingTuning({ padWidth: 340, gravityAcceleration: 92, startVelocityY: 14 }),
  pad: { centerX: 640, surfaceY: 612, width: 340 },
  padMotion: { kind: "fixed" },
  surfaceTiltRadians: 0,
  wind: { kind: "none" },
  collisionModel: "relative-pad",
};

export const blackHoleBakeryMission: MissionDefinitionV2 = {
  id: "black-hole-bakery",
  order: 4,
  title: "Black Hole Bakery",
  shortTitle: "Black Hole Bakery",
  senderId: "pip",
  routeId: "black-hole-bakery-route",
  landingId: "black-hole-bakery-landing",
  themeId: "blackHoleBakery",
  recipientName: "Pip, the very small baker",
  deliveryItemName: "a jar of patient sourdough starter",
  requestText: "Everything is being drawn toward the oven, including me. Please bring the starter around the outside.",
  memoryRewardId: "memory-black-hole-bakery-postcard",
  unlocksMissionIds: ["im-fine"],
  resultLines: expandResultLines(
    "The starter has arrived with excellent patience.",
    "Pip says a well-traveled starter has character.",
    "The jar is warm. The bakery already smells like tomorrow.",
  ),
  landingLines: {
    soft: "a flour-soft arrival",
    bumpy: "a small thump, followed by fresh bread",
    incident: "a floury bounce, kindly retried",
  },
  dashboard: {
    routeStart: "The bakery is past the oven. Go around the outside.",
    mechanicIntro: "The rings point toward the pull. Steer across them.",
    mechanicActive: "A little counter-thrust keeps the oven at a polite distance.",
    checkpoint: "Out of the pull. Smells like bread.",
    bump: "The starter is still rising. Mostly emotionally.",
    collectible: "A postcard dusted with flour.",
    landingIntro: "Light gravity here. Short puffs go a long way.",
    landingTwist: "Tiny puffs. The flour floats, and so do you.",
    gustWarning: "Tiny puffs. The flour floats, and so do you.",
    landingCalm: "Drift down like a crumb.",
    afterTouchdown: "Pip is already slicing.",
  },
  pilotHints: pilotHints([
    waypoint({ x: 900, y: 1100 }),
    waypoint({ x: 1350, y: 650 }),
    waypoint({ x: 2110, y: 400 }, PILOT_DEFAULTS.crossingSpeed),
    waypoint({ x: 2750, y: 530 }),
    waypoint({ x: 3200, y: 780 }),
    waypoint(destination, PILOT_DEFAULTS.crossingSpeed),
  ]),
  closingLine: null,
};
