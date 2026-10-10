/** Level 6 — Final Delivery: Package for the Gyoza Ship. No new demand; a quiet homecoming (plan §2). */
import type { FlightRouteDefinition, LandingDefinition, MissionDefinitionV2 } from "../../types/campaign";
import {
  CAMPAIGN_MAX_ENVIRONMENT_ACCELERATION,
  PILOT_DEFAULTS,
  campaignLandingTuning,
  expandResultLines,
  framingNear,
  pilotHints,
  rest,
  waypoint,
} from "./campaignHelpers";

const destination = { x: 2250, y: 780 } as const;

export const homeDeliveryRoute: FlightRouteDefinition = {
  id: "home-delivery-route",
  label: "The way home",
  themeId: "home",
  world: { width: 2600, height: 1600 },
  start: rest(320, 900),
  checkpoint: rest(320, 900),
  destination: {
    id: "home-dock",
    label: "Home station",
    ...destination,
    radius: 180,
    approachRadius: 430,
    requiredBottomFacingRadians: Math.PI / 2,
  },
  obstacles: [],
  movingObstacles: [],
  // Victory lap (phase-4 §3): gentle echoes of every world that cannot go wrong. A tailwind river toward home
  // and the kettle's small warm pull to swing around, if you like.
  forceZones: [
    { kind: "directional-current", id: "home-tailwind", area: { kind: "rect", x: 520, y: 640, width: 1500, height: 520 }, acceleration: { x: 45, y: 0 }, edgeBlendPx: 120, flowSpeed: 150 },
    { kind: "radial-gravity", id: "home-kettle", center: { x: 1400, y: 1300 }, radius: 360, coreRadius: 120, peakAcceleration: 70, falloff: "inverse", edgeBlendPx: 120, warp: null },
  ],
  seekers: [],
  collectibles: [],
  visibility: { kind: "clear" },
  checkpoints: [],
  beacons: [
    { id: "home-note-kettle", position: { x: 760, y: 900 }, radius: 220, message: "The kettle is on whenever you need it." },
    { id: "home-note-seat", position: { x: 1230, y: 780 }, radius: 220, message: "We saved you a seat." },
    { id: "home-note-hungry", position: { x: 1710, y: 840 }, radius: 220, message: "Come hungry. Come as you are." },
  ],
  cameraFraming: framingNear(destination),
  maxEnvironmentAcceleration: CAMPAIGN_MAX_ENVIRONMENT_ACCELERATION,
};

export const homeDeliveryLanding: LandingDefinition = {
  id: "home-delivery-landing",
  themeId: "home",
  // Raised, wide loading berth; gentle gravity; no wind.
  tuning: campaignLandingTuning({ padWidth: 480, surfaceY: 540, startY: 140, startVelocityY: 16, gravityAcceleration: 110 }),
  pad: { centerX: 640, surfaceY: 540, width: 480 },
  padMotion: { kind: "fixed" },
  surfaceTiltRadians: 0,
  wind: { kind: "none" },
  collisionModel: "relative-pad",
};

export const homeDeliveryMission: MissionDefinitionV2 = {
  id: "home-delivery",
  order: 6,
  title: "Final Delivery: Package for the Gyoza Ship",
  shortTitle: "Home",
  senderId: "everyone",
  routeId: "home-delivery-route",
  landingId: "home-delivery-landing",
  themeId: "home",
  recipientName: "You",
  deliveryItemName: "a parcel with your name on it",
  requestText: "One last package. The address looks familiar.",
  memoryRewardId: "memory-home-delivery-postcard",
  unlocksMissionIds: [],
  resultLines: expandResultLines(
    "For the one who kept showing up.",
    "For the one who kept showing up, even sideways.",
    "The parcel was never expecting a perfect journey.",
  ),
  landingLines: {
    soft: "home, gently",
    bumpy: "home, with a familiar little thump",
    incident: "home, after one more try",
  },
  dashboard: {
    routeStart: "Destination confirmed. Oh. It's us.",
    mechanicIntro: "Destination confirmed. Oh. It's us.",
    mechanicActive: "No rush. Nothing out here but thank-you notes.",
    checkpoint: "Almost home.",
    bump: "Even the parcel is laughing.",
    collectible: "A note for the dashboard.",
    landingIntro: "Home has left the wide berth open.",
    landingTwist: "The berth is raised. Land on the top deck.",
    gustWarning: "The berth is raised. Land on the top deck.",
    landingCalm: "Home has left the wide berth open.",
    afterTouchdown: "Contents: snacks, gratitude, one unreasonable amount of ribbon.",
  },
  pilotHints: pilotHints([waypoint({ x: 850, y: 900 }), waypoint({ x: 1500, y: 820 }), waypoint(destination, PILOT_DEFAULTS.crossingSpeed)]),
  closingLine: "You brought warmth to a small corner of the universe. Welcome home.",
};
