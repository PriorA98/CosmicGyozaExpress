/** Level 3 — Matcha Nebula "The Quiet River": engines wake the tea-koi; the current is the silent way (phase-4 §3). */
import { ASSET } from "../assetManifest";
import type { FlightRouteDefinition, LandingDefinition, MissionDefinitionV2 } from "../../types/campaign";
import type { Point } from "../../types/flight";
import {
  CAMPAIGN_DESTINATION,
  PILOT_DEFAULTS,
  ROUTE_ENVIRONMENT_CAP,
  campaignLandingTuning,
  checkpointStrip,
  riverBanks,
  expandResultLines,
  framingNear,
  pilotHints,
  rest,
  waypoint,
} from "./campaignHelpers";

const destination = { x: 3440, y: 820 } as const;

/** The quiet river: centreline of the bending channel (the current flows along it, start to dock). */
export const MATCHA_RIVER: readonly Point[] = [
  { x: 640, y: 1120 },
  { x: 1500, y: 1120 },
  { x: 2100, y: 1450 },
  { x: 2800, y: 1100 },
  { x: 3060, y: 900 },
];
const RIVER_HALF_WIDTH = 190;
const REED_RADIUS = 55;
/** Openings in the upper bank: the loud shortcut across the koi pool between the two bends. */
const BANK_GAPS: readonly Point[] = [{ x: 1640, y: 960 }, { x: 2420, y: 1080 }];

/** Tea-koi share one temperament; only their homes differ. */
const KOI = {
  radius: 46,
  hearingRadius: 480,
  wakeThrustMs: 450,
  listenWindowMs: 1500,
  alertMs: 900,
  chaseSpeed: 175,
  chaseAcceleration: 260,
  giveUpMs: 1700,
  returnSpeed: 80,
  leashRadius: 700,
} as const;

const koi = (id: string, home: Point) => ({ id, label: "sleepy tea-koi", home, ...KOI });

const reeds = riverBanks(MATCHA_RIVER, RIVER_HALF_WIDTH + REED_RADIUS, REED_RADIUS, 100).filter(
  (reed) => !BANK_GAPS.some((gap) => Math.hypot(reed.x - gap.x, reed.y - gap.y) < 110),
);

export const matchaNebulaRoute: FlightRouteDefinition = {
  id: "matcha-nebula-route",
  label: "Matcha Nebula Drift",
  themeId: "matchaNebula",
  world: { width: 3800, height: 2000 },
  start: rest(320, 1120),
  checkpoint: rest(320, 1120),
  destination: { id: "matcha-nebula-dock", label: "Nori's listening post", ...destination, ...CAMPAIGN_DESTINATION },
  obstacles: reeds.map((reed, index) => ({ id: `matcha-reed-${String(index).padStart(2, "0")}`, label: "reed stone", x: reed.x, y: reed.y, radius: REED_RADIUS })),
  movingObstacles: [],
  forceZones: [
    { kind: "directional-current", id: "matcha-river-1", area: { kind: "rect", x: 600, y: 900, width: 920, height: 440 }, acceleration: { x: 140, y: 0 }, edgeBlendPx: 60, flowSpeed: 200 },
    // The still pool (x 1720..2260) has no current: steer yourself there, softly, between two sleeping koi.
    { kind: "directional-current", id: "matcha-river-2", area: { kind: "rect", x: 1500, y: 1000, width: 220, height: 680 }, acceleration: { x: 123, y: 67 }, edgeBlendPx: 60, flowSpeed: 200 },
    { kind: "directional-current", id: "matcha-river-3", area: { kind: "rect", x: 2260, y: 880, width: 540, height: 820 }, acceleration: { x: 125, y: -63 }, edgeBlendPx: 60, flowSpeed: 200 },
    { kind: "directional-current", id: "matcha-river-4", area: { kind: "rect", x: 2800, y: 760, width: 280, height: 560 }, acceleration: { x: 110, y: -85 }, edgeBlendPx: 60, flowSpeed: 200 },
  ],
  seekers: [
    koi("matcha-koi-1", { x: 1100, y: 640 }),
    koi("matcha-koi-2", { x: 1850, y: 860 }),
    koi("matcha-koi-3", { x: 1800, y: 1860 }),
    koi("matcha-koi-4", { x: 2650, y: 680 }),
    koi("matcha-koi-5", { x: 2500, y: 1780 }),
  ],
  collectibles: [
    {
      id: "postcard-matcha",
      kind: "postcard",
      position: { x: 2000, y: 1000 },
      radius: 36,
      memoryId: "collectible-matcha-postcard",
      textureKey: ASSET.campaignPickups,
      frame: 0,
    },
  ],
  visibility: {
    kind: "fog",
    area: { kind: "rect", x: 560, y: 0, width: 2640, height: 2000 },
    textureKey: ASSET.campaignFog,
    maxAlpha: 0.32,
    driftPixelsPerSecond: { x: 6, y: 2 },
    dense: { shipRadius: 300, lanternRadius: 210, alpha: 0.86, lanterns: MATCHA_RIVER },
  },
  checkpoints: [
    checkpointStrip("matcha-checkpoint-entry", 700, 100, { x: 760, y: 1120 }),
    checkpointStrip("matcha-checkpoint-bend", 1560, 80, { x: 1600, y: 1175 }),
    checkpointStrip("matcha-checkpoint-low", 2080, 80, { x: 2110, y: 1440 }),
    checkpointStrip("matcha-checkpoint", 3000, 120, { x: 3080, y: 880 }),
  ],
  beacons: [],
  cameraFraming: framingNear(destination),
  maxEnvironmentAcceleration: ROUTE_ENVIRONMENT_CAP.river,
};

export const matchaNebulaLanding: LandingDefinition = {
  id: "matcha-nebula-landing",
  themeId: "matchaNebula",
  tuning: campaignLandingTuning({ padWidth: 300 }),
  pad: { centerX: 640, surfaceY: 612, width: 300 },
  padMotion: { kind: "fixed" },
  surfaceTiltRadians: 0,
  // Two-layer mist: pushes right up high, left near the porch. Lean one way, then the other.
  wind: { kind: "bands", splitAltitude: 260, blendPx: 80, upper: { x: 75, y: 0 }, lower: { x: -55, y: 0 } },
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
    routeStart: "Koi sleep in this mist. They wake to engine noise. Let the river carry you.",
    mechanicIntro: "Tap, don't burn. Long thrusts wake the koi.",
    mechanicActive: "A koi is listening. Coast, and it will lose interest.",
    checkpoint: "A lantern. The river remembers you here.",
    bump: "The flask sloshed in a very supportive way. The koi did not notice. Probably.",
    collectible: "A postcard, slightly damp, deeply green.",
    landingIntro: "Two mists. High up it pushes right, low down it pushes left.",
    landingTwist: "The mist turns halfway down. Switch your lean.",
    gustWarning: "The mist turns halfway down. Switch your lean.",
    landingCalm: "Lower mist now. Lean right, then let it come down.",
    afterTouchdown: "Nori holds the flask with both hands.",
  },
  pilotHints: pilotHints([
    waypoint({ x: 760, y: 1120 }, 160),
    waypoint({ x: 1450, y: 1125 }, 200, { quiet: true }),
    waypoint({ x: 2080, y: 1425 }, 200, { quiet: true }),
    waypoint({ x: 2760, y: 1115 }, 200, { quiet: true }),
    waypoint({ x: 3080, y: 880 }, 200, { quiet: true }),
    waypoint(destination, PILOT_DEFAULTS.crossingSpeed),
  ]),
  closingLine: null,
};
