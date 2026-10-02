/** Level 5 — Planet "I'm Fine": anticipate a telegraphed change in force (plan §2). */
import { ASSET } from "../assetManifest";
import type { FlightRouteDefinition, GustCycle, LandingDefinition, MissionDefinitionV2 } from "../../types/campaign";
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

const destination = { x: 3260, y: 960 } as const;

/** 10 s cycle: 2 s warning, 0.8 s attack, 2 s sustain, 1.2 s release, 4 s calm. Starts at the warning. */
export const IM_FINE_GUST_CYCLE: GustCycle = {
  warningMs: 2000,
  attackMs: 800,
  sustainMs: 2000,
  releaseMs: 1200,
  calmMs: 4000,
  phaseOffsetMs: 0,
};

export const imFineRoute: FlightRouteDefinition = {
  id: "im-fine-route",
  label: "Planet “I’m Fine”",
  themeId: "imFine",
  world: { width: 3600, height: 2000 },
  start: rest(320, 1100),
  checkpoint: rest(320, 1100),
  destination: { id: "im-fine-dock", label: "Iona's lit window", ...destination, ...CAMPAIGN_DESTINATION },
  obstacles: [
    { id: "im-fine-static-01", label: "storm cloud rock", x: 1240, y: 620, radius: 70 },
    { id: "im-fine-static-02", label: "umbrella stone", x: 2260, y: 1460, radius: 82 },
  ],
  movingObstacles: [
    {
      id: "im-fine-moving-a",
      label: "drifting rain barrel",
      radius: 56,
      textureKey: ASSET.asteroidRice,
      path: { kind: "ping-pong", from: { x: 1950, y: 620 }, to: { x: 2270, y: 620 }, periodMs: 24000, phaseOffsetMs: 0 },
    },
  ],
  forceZones: [
    {
      kind: "gust",
      id: "im-fine-storm",
      area: { kind: "rect", x: 950, y: 500, width: 1750, height: 1100 },
      peakAcceleration: { x: 0, y: -58 },
      edgeBlendPx: 140,
      cycle: IM_FINE_GUST_CYCLE,
      telegraph: "windsock-and-arrows",
    },
  ],
  collectibles: [
    {
      id: "postcard-im-fine",
      kind: "postcard",
      position: { x: 1770, y: 1160 },
      radius: 36,
      memoryId: "collectible-im-fine-postcard",
      textureKey: ASSET.campaignPickups,
      frame: 0,
    },
  ],
  visibility: { kind: "clear" },
  checkpoints: [
    { id: "im-fine-checkpoint", activation: { kind: "rect", x: 2880, y: 0, width: 180, height: 2000 }, respawn: rest(2960, 960) },
  ],
  beacons: [],
  cameraFraming: framingNear(destination),
  maxEnvironmentAcceleration: CAMPAIGN_MAX_ENVIRONMENT_ACCELERATION,
};

export const imFineLanding: LandingDefinition = {
  id: "im-fine-landing",
  themeId: "imFine",
  tuning: campaignLandingTuning({ padWidth: 360 }),
  pad: { centerX: 640, surfaceY: 612, width: 360 },
  padMotion: { kind: "fixed" },
  surfaceTiltRadians: 0,
  // Gusts start with a full warning; the porch awning shelters the last 100 px (fully exposed above 180 px).
  wind: {
    kind: "gust",
    peakAcceleration: { x: 26, y: 0 },
    cycle: IM_FINE_GUST_CYCLE,
    shelter: { calmBelowAltitude: 100, fullyExposedAltitude: 180 },
  },
  collisionModel: "relative-pad",
};

export const imFineMission: MissionDefinitionV2 = {
  id: "im-fine",
  order: 5,
  title: "Planet “I’m Fine”",
  shortTitle: "Planet I'm Fine",
  senderId: "iona",
  routeId: "im-fine-route",
  landingId: "im-fine-landing",
  themeId: "imFine",
  recipientName: "Iona, the keeper of one lit window",
  deliveryItemName: "soup and an extra spoon",
  requestText: "I'm fine. If you happen to pass, you could leave something by the door.",
  memoryRewardId: "memory-im-fine-postcard",
  unlocksMissionIds: ["home-delivery"],
  resultLines: expandResultLines(
    "Iona opens the door before you knock.",
    "The soup has traveled. Someone is glad it did.",
    "‘You came,’ Iona says. The bowl arrangement does not come up.",
  ),
  landingLines: {
    soft: "a quiet arrival at the lit window",
    bumpy: "the porch creaked, Iona brought another chair",
    incident: "a windswept landing, gently retried",
  },
  dashboard: {
    routeStart: "Storm ahead. The windsock always warns first.",
    mechanicIntro: "Gust gathering. You have a moment to settle.",
    mechanicActive: "Lean gently into it. There is room.",
    checkpoint: "Out of the storm. The window is still lit.",
    bump: "The soup is fine. It says so itself.",
    collectible: "A postcard that smells like rain.",
    landingIntro: "Gusts up high. The porch blocks the wind lower down.",
    landingTwist: "Lean gently into it. There is room.",
    gustWarning: "Gust gathering. You have a moment to settle.",
    landingCalm: "The porch blocks the wind. Take your time.",
    afterTouchdown: "Someone left the light on.",
  },
  pilotHints: pilotHints([
    waypoint({ x: 820, y: 1100 }),
    waypoint({ x: 1550, y: 1130 }, PILOT_DEFAULTS.crossingSpeed),
    waypoint({ x: 2400, y: 1050 }, PILOT_DEFAULTS.crossingSpeed),
    waypoint({ x: 2960, y: 960 }),
    waypoint(destination, PILOT_DEFAULTS.crossingSpeed),
  ]),
  closingLine: "I said I was fine. I'm glad you came anyway.",
};
