/** Level 5 — Planet "I'm Fine" "The Storm Sea": alternating gusts, calm eyes, a tornado to the sky lane (phase-4 §3). */
import { ASSET } from "../assetManifest";
import type { FlightRouteDefinition, GustCycle, LandingDefinition, MissionDefinitionV2 } from "../../types/campaign";
import {
  CAMPAIGN_DESTINATION,
  PILOT_DEFAULTS,
  ROUTE_ENVIRONMENT_CAP,
  campaignLandingTuning,
  checkpointStrip,
  rockWall,
  expandResultLines,
  framingNear,
  pilotHints,
  rest,
  waypoint,
} from "./campaignHelpers";

const destination = { x: 3260, y: 960 } as const;

/** 7.5 s storm cycle: 1.5 s warning, 0.5 s attack, 1.8 s sustain, 0.7 s release, 3 s calm. Alternates up / down. */
export const IM_FINE_GUST_CYCLE: GustCycle = {
  warningMs: 1500,
  attackMs: 500,
  sustainMs: 1800,
  releaseMs: 700,
  calmMs: 3000,
  phaseOffsetMs: 0,
  alternate: true,
};

/** Storm strips across the sea; the gaps between them are the calm eyes beside the lighthouses. */
const STORM_STRIPS = [
  { id: "im-fine-storm-a", x: 1300, width: 350 },
  { id: "im-fine-storm-b", x: 1850, width: 400 },
  { id: "im-fine-storm-c", x: 2450, width: 350 },
] as const;
/** Reef line between the sea and the sky lane (y). */
const REEF_Y = 440;
/** Doorway through the sea stacks (y range of rock centres left out). */
const STACK_DOOR = [1000, 1200] as const;

export const imFineRoute: FlightRouteDefinition = {
  id: "im-fine-route",
  label: "Planet “I’m Fine”",
  themeId: "imFine",
  world: { width: 3600, height: 2000 },
  start: rest(320, 1100),
  checkpoint: rest(320, 1100),
  destination: { id: "im-fine-dock", label: "Iona's lit window", ...destination, ...CAMPAIGN_DESTINATION },
  obstacles: [
    // Sea cliff: the sky lane can only be reached by riding the tornado up through the reef.
    ...rockWall("im-fine-cliff", "storm cloud rock", { x: 900, y: 40 }, { x: 900, y: 400 }, 70, 120),
    // Reef: openings above the tornado (x 960..1140) and at the far end (x 2480..2660).
    ...rockWall("im-fine-reef", "umbrella stone", { x: 900, y: REEF_Y }, { x: 2760, y: REEF_Y }, 60, 110, [[50, 250], [1570, 1770]]),
    // Sea stacks down the middle of each storm strip, one doorway at eye level (y about 1000..1240).
    ...STORM_STRIPS.flatMap((strip) =>
      rockWall(`${strip.id}-stacks`, "sea stack", { x: strip.x + strip.width / 2, y: REEF_Y + 70 }, { x: strip.x + strip.width / 2, y: 1950 }, 60, 110, [[STACK_DOOR[0] - REEF_Y - 70, STACK_DOOR[1] - REEF_Y - 70]]),
    ),
    // Lighthouse islands mark the calm eyes between storm strips.
    { id: "im-fine-light-1", label: "lighthouse island", x: 1750, y: 720, radius: 70 },
    { id: "im-fine-light-2", label: "lighthouse island", x: 1750, y: 1600, radius: 70 },
    { id: "im-fine-light-3", label: "lighthouse island", x: 2350, y: 720, radius: 70 },
    { id: "im-fine-light-4", label: "lighthouse island", x: 2350, y: 1600, radius: 70 },
  ],
  movingObstacles: [
    // Islands flung about in the sky lane: they bob across it on short cycles.
    { id: "im-fine-sky-a", label: "flung island", radius: 50, textureKey: ASSET.asteroidRice, path: { kind: "ping-pong", from: { x: 1500, y: 110 }, to: { x: 1500, y: 330 }, periodMs: 4500, phaseOffsetMs: 0 } },
    { id: "im-fine-sky-b", label: "flung island", radius: 50, textureKey: ASSET.asteroidTea, path: { kind: "ping-pong", from: { x: 1880, y: 110 }, to: { x: 1880, y: 330 }, periodMs: 5200, phaseOffsetMs: 1500 } },
    { id: "im-fine-sky-c", label: "flung island", radius: 50, textureKey: ASSET.asteroidRice, path: { kind: "ping-pong", from: { x: 2260, y: 110 }, to: { x: 2260, y: 330 }, periodMs: 4800, phaseOffsetMs: 3000 } },
  ],
  forceZones: [
    // Tornado (Giant's Deep): a column that flings the ship up into the sky lane.
    { kind: "directional-current", id: "im-fine-tornado", area: { kind: "rect", x: 960, y: REEF_Y, width: 180, height: 2000 - REEF_Y }, acceleration: { x: 0, y: -260 }, edgeBlendPx: 40, flowSpeed: 300 },
    ...STORM_STRIPS.map((strip) => ({
      kind: "gust" as const,
      id: strip.id,
      area: { kind: "rect" as const, x: strip.x, y: REEF_Y, width: strip.width, height: 2000 - REEF_Y },
      peakAcceleration: { x: 0, y: -300 },
      edgeBlendPx: 60,
      cycle: IM_FINE_GUST_CYCLE,
      telegraph: "windsock-and-arrows" as const,
    })),
  ],
  seekers: [],
  collectibles: [
    {
      id: "postcard-im-fine",
      kind: "postcard",
      position: { x: 2080, y: 220 },
      radius: 36,
      memoryId: "collectible-im-fine-postcard",
      textureKey: ASSET.campaignPickups,
      frame: 0,
    },
  ],
  visibility: { kind: "clear" },
  checkpoints: [
    checkpointStrip("im-fine-checkpoint-shore", 1180, 70, { x: 1220, y: 1100 }, [REEF_Y, 2000]),
    checkpointStrip("im-fine-checkpoint-sky", 1300, 80, { x: 1340, y: 240 }, [0, REEF_Y]),
    checkpointStrip("im-fine-checkpoint-eye-1", 1700, 100, { x: 1750, y: 1120 }, [REEF_Y, 2000]),
    checkpointStrip("im-fine-checkpoint-eye-2", 2300, 100, { x: 2350, y: 1120 }, [REEF_Y, 2000]),
    checkpointStrip("im-fine-checkpoint", 2850, 100, { x: 2900, y: 980 }),
  ],
  beacons: [],
  cameraFraming: framingNear(destination),
  maxEnvironmentAcceleration: ROUTE_ENVIRONMENT_CAP.storm,
};

export const imFineLanding: LandingDefinition = {
  id: "im-fine-landing",
  themeId: "imFine",
  tuning: campaignLandingTuning({ padWidth: 300 }),
  pad: { centerX: 640, surfaceY: 612, width: 300 },
  padMotion: { kind: "fixed" },
  surfaceTiltRadians: 0,
  // A squall that swaps sides every gust; the porch awning only shelters the last 40 px (exposed above 110 px).
  wind: {
    kind: "gust",
    peakAcceleration: { x: 140, y: 0 },
    cycle: { ...IM_FINE_GUST_CYCLE, warningMs: 800, sustainMs: 2500, calmMs: 1500 },
    shelter: { calmBelowAltitude: 40, fullyExposedAltitude: 110 },
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
    routeStart: "Storm sea. Wait in the calm eyes by the lighthouses, cross when the wind rests.",
    mechanicIntro: "Gust gathering. The arrows show which way it will push this time.",
    mechanicActive: "It flips every gust. Lean against it hard, or hurry to the next calm eye.",
    checkpoint: "A calm eye. The window is still lit.",
    bump: "The soup is fine. It says so itself.",
    collectible: "A postcard that smells like rain.",
    landingIntro: "Squalls swap sides each gust. The porch only shelters the very end.",
    landingTwist: "Slide against this gust. The next one comes from the other side.",
    gustWarning: "Gust gathering. Check which way the arrows point.",
    landingCalm: "Under the porch. Take your time.",
    afterTouchdown: "Someone left the light on.",
  },
  pilotHints: pilotHints([
    waypoint({ x: 820, y: 1100 }),
    waypoint({ x: 1220, y: 1100 }, PILOT_DEFAULTS.crossingSpeed, { hold: true, radius: 60 }),
    waypoint({ x: 1750, y: 1120 }, 200, { hold: true, radius: 60 }),
    waypoint({ x: 2350, y: 1120 }, 200, { hold: true, radius: 60 }),
    waypoint({ x: 2960, y: 980 }, 200),
    waypoint(destination, PILOT_DEFAULTS.crossingSpeed),
  ]),
  closingLine: "I said I was fine. I'm glad you came anyway.",
};
