/** Level 4 — Black Hole Bakery "The Oven": real gravity, a rotating crust ring, a white-hole toaster (phase-4 §3). */
import { ASSET } from "../assetManifest";
import type { FlightRouteDefinition, LandingDefinition, MissionDefinitionV2 } from "../../types/campaign";
import {
  CAMPAIGN_DESTINATION,
  PILOT_DEFAULTS,
  ROUTE_ENVIRONMENT_CAP,
  campaignLandingTuning,
  checkpointStrip,
  conveyorLoop,
  rockWall,
  expandResultLines,
  framingNear,
  pilotHints,
  rest,
  waypoint,
} from "./campaignHelpers";

const destination = { x: 3600, y: 780 } as const;
export const BAKERY_WELL_CENTER = { x: 2100, y: 1140 } as const;
/** Crust ring (Brittle Hollow): 18 slots at 620 px, three double-slot gaps, one turn every 30 s. */
export const BAKERY_RING_RADIUS = 620;

export const blackHoleBakeryRoute: FlightRouteDefinition = {
  id: "black-hole-bakery-route",
  label: "Black Hole Bakery",
  themeId: "blackHoleBakery",
  world: { width: 4000, height: 2200 },
  start: rest(320, 1500),
  checkpoint: rest(320, 1500),
  destination: { id: "black-hole-bakery-dock", label: "Pip's bakery", ...destination, ...CAMPAIGN_DESTINATION },
  obstacles: [
    // Crust cliffs above and below the ring: the only way past the oven is through the ring itself.
    ...rockWall("bakery-cliff-top", "burnt crust", { x: BAKERY_WELL_CENTER.x, y: 40 }, { x: BAKERY_WELL_CENTER.x, y: 380 }, 70, 115),
    ...rockWall("bakery-cliff-bottom", "sourdough boulder", { x: BAKERY_WELL_CENTER.x, y: 1900 }, { x: BAKERY_WELL_CENTER.x, y: 2160 }, 70, 115),
    { id: "bakery-static-01", label: "burnt crust", x: 900, y: 1760, radius: 72 },
    { id: "bakery-static-02", label: "flour sack rock", x: 3200, y: 1560, radius: 70 },
    { id: "bakery-static-03", label: "crumb rock", x: 3260, y: 380, radius: 64 },
  ],
  movingObstacles: conveyorLoop({
    prefix: "bakery-crust",
    label: "orbiting crust",
    center: BAKERY_WELL_CENTER,
    radiusX: BAKERY_RING_RADIUS,
    radiusY: BAKERY_RING_RADIUS,
    periodMs: 30000,
    slots: 18,
    skip: [0, 1, 6, 7, 12, 13],
    radius: 64,
    textureKeys: [ASSET.asteroidSleepy, ASSET.asteroidCrumb, ASSET.asteroidDebris],
    clockwise: true,
  }),
  forceZones: [
    {
      kind: "radial-gravity",
      id: "bakery-well",
      center: BAKERY_WELL_CENTER,
      radius: 1100,
      coreRadius: 200,
      // 300 at the core edge (71% of thrust), 150 at 400 px, 97 at the ring, 79 by the cliffs.
      peakAcceleration: 300,
      falloff: "inverse",
      edgeBlendPx: 160,
      // The oven mouth: fall in and the white-hole toaster pops you out near the start of the well.
      warp: { radius: 140, exit: { x: 820, y: 760, rotation: Math.PI / 2, velocityX: 70, velocityY: 0 } },
    },
  ],
  seekers: [],
  collectibles: [
    {
      id: "postcard-bakery",
      kind: "postcard",
      position: { x: BAKERY_WELL_CENTER.x, y: BAKERY_WELL_CENTER.y + 270 },
      radius: 36,
      memoryId: "collectible-bakery-postcard",
      textureKey: ASSET.campaignPickups,
      frame: 0,
    },
  ],
  visibility: { kind: "clear" },
  checkpoints: [
    checkpointStrip("bakery-checkpoint-ring", 1060, 140, { x: 1150, y: 1140 }),
    checkpointStrip("bakery-checkpoint", 2960, 140, { x: 3060, y: 960 }),
  ],
  beacons: [],
  cameraFraming: framingNear(destination),
  maxEnvironmentAcceleration: ROUTE_ENVIRONMENT_CAP.well,
};

export const blackHoleBakeryLanding: LandingDefinition = {
  id: "black-hole-bakery-landing",
  themeId: "blackHoleBakery",
  // Light gravity on the station apron, and the oven leans on everything: a steady sideways pull.
  tuning: campaignLandingTuning({ padWidth: 300, gravityAcceleration: 100, startVelocityY: 14 }),
  pad: { centerX: 640, surfaceY: 612, width: 300 },
  padMotion: { kind: "fixed" },
  surfaceTiltRadians: 0,
  wind: { kind: "steady", acceleration: { x: -60, y: 0 } },
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
  requestText: "Everything is being drawn toward the oven, including me. The only way in is through the crust ring. Mind the oven door.",
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
    routeStart: "The bakery is past the oven. Slip through a gap in the crust ring.",
    mechanicIntro: "The pull grows near the oven. Keep sideways speed and it bends you around.",
    mechanicActive: "Too close to the oven door. Thrust outward, or swing around it.",
    checkpoint: "Out of the pull. Smells like bread.",
    bump: "The starter is still rising. Mostly emotionally.",
    collectible: "A postcard dusted with flour.",
    landingIntro: "The oven pulls everything left. Slide right to hold your line.",
    landingTwist: "Slide right against the oven's pull. S steadies the final drift.",
    gustWarning: "Slide right against the oven's pull. S steadies the final drift.",
    landingCalm: "Nearly there. Level out and drift down like a crumb.",
    afterTouchdown: "Pip is already slicing.",
  },
  pilotHints: pilotHints([
    waypoint({ x: 1000, y: 1250 }),
    waypoint({ x: 1340, y: 1140 }, PILOT_DEFAULTS.crossingSpeed, { hold: true, radius: 60 }),
    waypoint({ x: 1760, y: 1140 }, 190, { radius: 90 }),
    waypoint({ x: 1850, y: 860 }, 200, { radius: 110 }),
    waypoint({ x: 2100, y: 770 }, 200, { radius: 110 }),
    waypoint({ x: 2440, y: 1140 }, PILOT_DEFAULTS.crossingSpeed, { hold: true, radius: 60 }),
    waypoint({ x: 2880, y: 1140 }, 190),
    waypoint({ x: 3200, y: 900 }),
    waypoint(destination, PILOT_DEFAULTS.crossingSpeed),
  ]),
  closingLine: null,
};
