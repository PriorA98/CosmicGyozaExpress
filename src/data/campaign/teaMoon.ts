/** Tea Moon expressed in the campaign contracts. Every authored number is the slice's original value. */
import { flightPrototypeRoute } from "../flightPrototypeRoute";
import { landingTuning } from "../landingTuning";
import { cameraTuning } from "../tuning";
import type { FlightRouteDefinition, LandingDefinition, MissionDefinitionV2 } from "../../types/campaign";
import { CAMPAIGN_MAX_ENVIRONMENT_ACCELERATION, pilotHints, waypoint } from "./campaignHelpers";

export const TEA_MOON_MISSION_ID = "tea-moon";

export const teaMoonRoute: FlightRouteDefinition = {
  ...flightPrototypeRoute,
  id: "phase-1-tea-moon-test-route",
  themeId: "teaMoon",
  movingObstacles: [],
  forceZones: [],
  seekers: [],
  collectibles: [],
  visibility: { kind: "clear" },
  checkpoints: [],
  beacons: [],
  cameraFraming: {
    point: cameraTuning.moonFramingPoint,
    radius: cameraTuning.moonFramingRadius,
    maxBlendX: cameraTuning.moonFramingMaxBlendX,
    maxBlendY: cameraTuning.moonFramingMaxBlendY,
  },
  maxEnvironmentAcceleration: CAMPAIGN_MAX_ENVIRONMENT_ACCELERATION,
};

export const teaMoonLanding: LandingDefinition = {
  id: "tea-moon-landing",
  themeId: "teaMoon",
  tuning: landingTuning,
  pad: { centerX: landingTuning.startX, surfaceY: landingTuning.surfaceY, width: landingTuning.padWidth },
  padMotion: { kind: "fixed" },
  surfaceTiltRadians: 0,
  wind: { kind: "none" },
  collisionModel: "legacy-horizontal",
};

export const teaMoonMission: MissionDefinitionV2 = {
  id: TEA_MOON_MISSION_ID,
  order: 1,
  title: "Tea Moon Tutorial",
  shortTitle: "Tea Moon",
  senderId: "sleepy-moon-rabbit",
  routeId: "phase-1-tea-moon-test-route",
  landingId: "tea-moon-landing",
  themeId: "teaMoon",
  recipientName: "Sleepy Moon Rabbit",
  deliveryItemName: "hot tea and moon mochi",
  requestText: "A tiny kettle is blinking from the moon. Someone needs tea before the stars get too loud.",
  memoryRewardId: "memory-tea-moon-postcard",
  unlocksMissionIds: ["bento-belt"],
  resultLines: {
    Perfect: "The tea is still steaming politely.",
    "Slightly shaken": "The tea learned about turbulence and remained brave.",
    "Emotionally rotated": "The mochi rotated through several feelings, then settled.",
    "Warm but confused": "The package is unsure what happened, but it is warm.",
    "Still delicious": "The snack arrangement is abstract and accepted.",
    "Dramatically rearranged": "The mochi has become a small lunar sculpture.",
    "Basically fine": "Everything important survived, including dinner.",
  },
  landingLines: {
    soft: "moon-approved soft landing",
    bumpy: "spirited landing, warmly accepted",
    incident: "reassembled landing with extra steam",
  },
  // Tea Moon scenes keep their bespoke copy modules (flightScenery / landingCopy); these lines are for the board.
  dashboard: {
    routeStart: "Thrust pushes away from the bottom. Point, puff, drift.",
    mechanicIntro: "Rotate first, then thrust: the bottom decides where you go.",
    mechanicActive: "Brake gently before the moon.",
    checkpoint: "Route remembered.",
    bump: "The mochi felt that.",
    collectible: "A souvenir for the dashboard.",
    landingIntro: "W lifts, A/D slide, S steadies.",
    landingTwist: "Slide over the blanket; tap W for a soft drop.",
    gustWarning: "Slide over the blanket; tap W for a soft drop.",
    landingCalm: "Nice and slow now.",
    afterTouchdown: "The kettle is on.",
  },
  pilotHints: pilotHints([waypoint({ x: 1000, y: 1350 }), waypoint({ x: 2300, y: 1350 }), waypoint({ x: 2700, y: 900 }, 110)]),
  closingLine: null,
};
