/** Level 2 — Asteroid Bento Belt "The Lunch Rush": timing through moving traffic (phase-4 §3). */
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

const destination = { x: 3260, y: 900 } as const;
const BELT_TEXTURES = [ASSET.asteroidMochi, ASSET.asteroidRice, ASSET.asteroidCrumb] as const;
/** Two sushi-conveyor loops: rocks stream up one lane and down the other; the interior is a calm seat. */
export const BENTO_LOOP_A = { x: 1750, y: 900 } as const;
export const BENTO_LOOP_B = { x: 2500, y: 900 } as const;

export const bentoBeltRoute: FlightRouteDefinition = {
  id: "bento-belt-route",
  label: "Asteroid Bento Belt",
  themeId: "bentoBelt",
  world: { width: 3600, height: 1800 },
  start: rest(320, 900),
  checkpoint: rest(320, 900),
  destination: { id: "bento-belt-dock", label: "Mallow's lunch dock", ...destination, ...CAMPAIGN_DESTINATION },
  obstacles: [
    // Chopstick wall: full height, one doorway at y 700..1100 that the chopsticks open and close.
    ...rockWall("bento-wall-top", "rice ball rock", { x: 1000, y: 40 }, { x: 1000, y: 620 }, 70, 130),
    ...rockWall("bento-wall-bottom", "pickle pebble", { x: 1000, y: 1180 }, { x: 1000, y: 1760 }, 70, 130),
    { id: "bento-static-01", label: "chopstick rest", x: 2960, y: 560, radius: 62 },
    { id: "bento-static-02", label: "soy dish rock", x: 3020, y: 1280, radius: 64 },
  ],
  movingObstacles: [
    // Chopsticks: close together every 5 s (open gap 270 px, closed gap none).
    {
      id: "bento-chopstick-top",
      label: "chopstick rock",
      radius: 75,
      textureKey: ASSET.asteroidRice,
      path: { kind: "ping-pong", from: { x: 1000, y: 690 }, to: { x: 1000, y: 840 }, periodMs: 5000, phaseOffsetMs: 0 },
    },
    {
      id: "bento-chopstick-bottom",
      label: "chopstick rock",
      radius: 75,
      textureKey: ASSET.asteroidRice,
      path: { kind: "ping-pong", from: { x: 1000, y: 1110 }, to: { x: 1000, y: 960 }, periodMs: 5000, phaseOffsetMs: 0 },
    },
    ...conveyorLoop({ prefix: "bento-loop-a", label: "lunch-tray rock", center: BENTO_LOOP_A, radiusX: 170, radiusY: 830, periodMs: 30000, slots: 9, radius: 58, textureKeys: BELT_TEXTURES, clockwise: true }),
    ...conveyorLoop({ prefix: "bento-loop-b", label: "tamago tumbler", center: BENTO_LOOP_B, radiusX: 170, radiusY: 830, periodMs: 27000, slots: 9, radius: 58, textureKeys: BELT_TEXTURES, clockwise: false, phaseRadians: 0.35 }),
  ],
  forceZones: [
    // Lane currents: inside a lane the ship drifts with the stream (clockwise A: right lane down, left lane up).
    { kind: "directional-current", id: "bento-lane-a-left", area: { kind: "rect", x: BENTO_LOOP_A.x - 230, y: 260, width: 120, height: 1280 }, acceleration: { x: 0, y: -70 }, edgeBlendPx: 40, flowSpeed: 170 },
    { kind: "directional-current", id: "bento-lane-a-right", area: { kind: "rect", x: BENTO_LOOP_A.x + 110, y: 260, width: 120, height: 1280 }, acceleration: { x: 0, y: 70 }, edgeBlendPx: 40, flowSpeed: 170 },
    { kind: "directional-current", id: "bento-lane-b-left", area: { kind: "rect", x: BENTO_LOOP_B.x - 230, y: 260, width: 120, height: 1280 }, acceleration: { x: 0, y: 70 }, edgeBlendPx: 40, flowSpeed: 170 },
    { kind: "directional-current", id: "bento-lane-b-right", area: { kind: "rect", x: BENTO_LOOP_B.x + 110, y: 260, width: 120, height: 1280 }, acceleration: { x: 0, y: -70 }, edgeBlendPx: 40, flowSpeed: 170 },
  ],
  seekers: [],
  collectibles: [
    {
      id: "postcard-bento",
      kind: "postcard",
      position: { x: BENTO_LOOP_B.x, y: 520 },
      radius: 36,
      memoryId: "collectible-bento-postcard",
      textureKey: ASSET.campaignPickups,
      frame: 0,
    },
  ],
  visibility: { kind: "clear" },
  checkpoints: [
    checkpointStrip("bento-checkpoint-gate", 1130, 160, { x: 1260, y: 900 }),
    checkpointStrip("bento-checkpoint-seat", 2020, 200, { x: 2125, y: 900 }),
    checkpointStrip("bento-checkpoint", 2760, 160, { x: 2860, y: 900 }),
  ],
  beacons: [],
  cameraFraming: framingNear(destination),
  maxEnvironmentAcceleration: ROUTE_ENVIRONMENT_CAP.gentle,
};

export const bentoBeltLanding: LandingDefinition = {
  id: "bento-belt-landing",
  themeId: "bentoBelt",
  tuning: campaignLandingTuning({ padWidth: 260 }),
  pad: { centerX: 480, surfaceY: 612, width: 260 },
  // Lazy-Susan tray: slides 480 <-> 800 and back every 12 s (peak about 84 px/s, faster than the 68 px/s sideways limit).
  padMotion: {
    kind: "path",
    path: { kind: "ping-pong", from: { x: 480, y: 612 }, to: { x: 800, y: 612 }, periodMs: 12000, phaseOffsetMs: 0 },
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
    routeStart: "Lunch rush. The chopsticks open and close. Wait for the gap.",
    mechanicIntro: "Watch the stream. Go when the gap reaches you, not before.",
    mechanicActive: "The lanes carry you with the traffic. Cross them quickly.",
    checkpoint: "Seat saved. Breathe, then pick the next gap.",
    bump: "The bento has requested a seating chart.",
    collectible: "Postcard tucked into the lunch lid.",
    landingIntro: "The tray swings fast. Match its slide before you drop.",
    landingTwist: "Ride along with the tray, then drop.",
    gustWarning: "Ride along with the tray, then drop.",
    landingCalm: "Riding along nicely. Ease down.",
    afterTouchdown: "Lunch is served, mid-slide.",
  },
  pilotHints: pilotHints([
    waypoint({ x: 820, y: 900 }, PILOT_DEFAULTS.cruiseSpeed, { hold: true, radius: 60 }),
    waypoint({ x: 1260, y: 900 }, 200),
    waypoint({ x: 1420, y: 900 }, PILOT_DEFAULTS.crossingSpeed, { hold: true, radius: 60 }),
    waypoint(BENTO_LOOP_A, 200, { hold: true, radius: 60 }),
    waypoint({ x: 2125, y: 900 }, 200, { hold: true, radius: 60 }),
    waypoint(BENTO_LOOP_B, 200, { hold: true, radius: 60 }),
    waypoint({ x: 3000, y: 900 }, 200),
    waypoint(destination, PILOT_DEFAULTS.crossingSpeed),
  ]),
  closingLine: null,
};
