import { ASSET, type AssetKey } from "./assetManifest";
import { colors } from "../game/designTokens";
import type { DockingStateKind } from "../types/flight";
import type { ThemeId } from "../types/campaign";

/**
 * Authored scenery, visual tuning, and copy for the Tea Moon route flight.
 * Gameplay geometry (start, obstacles, destination) lives in `flightPrototypeRoute.ts`;
 * nothing here changes collision or arrival rules.
 */

/** Integer display scale for pixel art (1 art px = 2 screen px). */
export const FLIGHT_ART_SCALE = 2;

export type ParallaxLayerDefinition = {
  readonly id: string;
  readonly textureKey: AssetKey;
  /** Fraction of camera scroll applied to the tiling texture. */
  readonly scrollFactorX: number;
  readonly scrollFactorY: number;
  readonly alpha: number;
  /**
   * `tile` repeats in both axes. `mirror` is for art that only tiles horizontally (the nebula):
   * it is stacked with its own vertical mirror at runtime, so it repeats in Y without a seam and
   * always covers the viewport however far the camera scrolls.
   */
  readonly mode: "tile" | "mirror";
  /** Slow autonomous drift in art px per second (keeps the sky alive while parked). */
  readonly driftX: number;
  /**
   * Stars per tile for the seeded stand-in used only while the layer's art is still a
   * PreloadScene fallback (0 hides the layer instead), so the sky never renders as a flat slab.
   */
  readonly fallbackStars: number;
};

export const flightParallaxLayers: readonly ParallaxLayerDefinition[] = [
  {
    id: "stars-far",
    textureKey: ASSET.spaceStarsFar,
    scrollFactorX: 0.05,
    scrollFactorY: 0.05,
    alpha: 1,
    mode: "tile",
    driftX: 0.6,
    fallbackStars: 34,
  },
  {
    id: "nebula",
    textureKey: ASSET.spaceNebula,
    scrollFactorX: 0.15,
    scrollFactorY: 0.06,
    alpha: 0.5,
    mode: "mirror",
    driftX: 0,
    fallbackStars: 0,
  },
  {
    id: "stars-near",
    textureKey: ASSET.spaceStarsNear,
    scrollFactorX: 0.35,
    scrollFactorY: 0.35,
    alpha: 0.72,
    mode: "tile",
    driftX: 0,
    fallbackStars: 9,
  },
];

/** Seeded stand-in star tile settings (see `ParallaxLayerDefinition.fallbackStars`). */
export const fallbackStarfield = {
  seed: 1337,
  colors: [colors.plaster, colors.duskBlue, colors.parchmentDeep, colors.plum] as const,
  alphaMin: 0.25,
  alphaMax: 0.85,
} as const;

/**
 * Distant bodies barely move with the camera (scroll factor <= 0.1), so their screen positions are
 * effectively fixed: lay them out against the HUD safe zones, not against the world.
 */
export type CelestialBodyDefinition = {
  readonly id: string;
  readonly textureKey: AssetKey;
  /** Position in parallax space: screen position when the camera scroll is (0, 0). */
  readonly x: number;
  readonly y: number;
  readonly scrollFactor: number;
  readonly scale: number;
  /**
   * Multiply tint that pushes distant bodies back into the sky. Bodies stay fully opaque (they sit
   * in front of the star layers), so depth comes from this tint, never from transparency.
   */
  readonly tint: string;
  /** Visual-only slow drift range in px and its period. */
  readonly driftPx: number;
  readonly driftPeriodMs: number;
  /** Procedural pixel stand-in used only while the authored art is still a fallback. */
  readonly standIn: PlanetStandInDefinition;
};

export type PlanetStandInDefinition = {
  /** Canvas size in art px (same as the manifest entry). */
  readonly size: number;
  readonly bodyFill: number;
  /** Darkest outline first, highlight last. */
  readonly palette: readonly [string, string, string, string, string];
  readonly craters: number;
  readonly banded: boolean;
  readonly seed: number;
};

export const flightCelestialBodies: readonly CelestialBodyDefinition[] = [
  {
    id: "far-plum",
    textureKey: ASSET.planetFarPlum,
    // Upper right: clear of the route-note ticker (desktop top centre, phones beside the panel), the
    // instrument panel, the edge indicator and the Tea Moon halo when the dock is framed.
    x: 1000,
    y: 155,
    scrollFactor: 0.04,
    scale: FLIGHT_ART_SCALE,
    tint: "#B4AECB",
    driftPx: 4,
    driftPeriodMs: 9000,
    standIn: {
      size: 96,
      bodyFill: 0.86,
      palette: ["#1E1B30", "#3A3352", "#554A73", "#7B6E9C", "#A99DC6"],
      craters: 0,
      banded: true,
      seed: 41,
    },
  },
  {
    id: "im-fine",
    textureKey: ASSET.celestialImFine,
    // Low centre, a distant world under the route: above the hint strip, between the phone touch
    // pads, and clear of the hero asteroids in every showcase framing (start, cruise, bump,
    // incident, approach).
    x: 611,
    y: 580,
    scrollFactor: 0.1,
    scale: FLIGHT_ART_SCALE,
    tint: "#C3C1D6",
    driftPx: 6,
    driftPeriodMs: 12000,
    standIn: {
      size: 128,
      bodyFill: 0.84,
      palette: ["#1A1F2E", "#2E3A4C", "#43566A", "#62798C", "#8DA4B3"],
      craters: 6,
      banded: false,
      seed: 77,
    },
  },
];

/** Tea Moon destination body. The delivery ring (dock 2840,850 r132) hugs its left limb. */
export const teaMoonScenery = {
  textureKey: ASSET.celestialTeaMoon,
  x: 3050,
  y: 850,
  scale: FLIGHT_ART_SCALE,
  haloColor: "#C2CFAE",
  /** Stepped halo discs beyond the moon body, in ART px (drawn on the 2x pixel grid). */
  haloSteps: [3, 7, 12, 18, 25, 33] as const,
  haloAlpha: 0.05,
  /**
   * Visible moon body in screen px relative to the image centre. The authored art (192px canvas)
   * has a 144 art-px body sitting low to leave room for the teahouse, so the halo follows the body.
   */
  artBody: { offsetX: -13, offsetY: 30, radius: 144 },
  /** Same for the procedural stand-in (centred body, 90% of the canvas). */
  standInBody: { offsetX: 0, offsetY: 0, radius: 172 },
  breathAlpha: 0.35,
  standIn: {
    size: 192,
    bodyFill: 0.9,
    palette: ["#2C3A30", "#55704F", "#7F9A6C", "#A9BC8C", "#D6E0B6"],
    craters: 9,
    banded: false,
    seed: 2840,
  } satisfies PlanetStandInDefinition,
} as const;

export type AsteroidVisualDefinition = {
  readonly obstacleId: string;
  readonly textureKey: AssetKey;
  /** Sleepy bob amplitude in ART px (moves in whole art pixels, never sub-pixel). */
  readonly bobArtPx: number;
  readonly bobPeriodMs: number;
  readonly flipX: boolean;
};

export const asteroidArt = {
  /**
   * Contract art (assetManifest): one canvas per rock whose body diameter in art px equals the
   * obstacle radius, displayed at exactly 2x. Legacy 72px canvases (body ~88%) are scaled to fit
   * their collision circle only until the per-rock art lands.
   */
  legacyCanvasPx: 72,
  legacyBodyFillRatio: 0.88,
  fallbackTextureKey: ASSET.asteroidSleepy,
  squashScale: 0.12,
  squashMs: 120,
  /**
   * Screen-blend warm flash: a mid-warm lift for `flashPeakMs`, then a softer step until `flashMs`
   * (cream would wash the rock to a blank disc; this keeps its face and craters readable).
   */
  flashColor: "#6E5638",
  flashSettleColor: "#382C20",
  flashPeakMs: 50,
  flashMs: 150,
  nudgePx: { "soft-bump": 6, "dramatic-bump": 10, "gyoza-incident": 14 } as const,
} as const;

export const asteroidVisuals: readonly AsteroidVisualDefinition[] = [
  { obstacleId: "soft-asteroid-01", textureKey: ASSET.asteroidSleepy, bobArtPx: 2, bobPeriodMs: 3600, flipX: false },
  { obstacleId: "soft-asteroid-02", textureKey: ASSET.asteroidRice, bobArtPx: 2, bobPeriodMs: 4200, flipX: false },
  { obstacleId: "soft-asteroid-03", textureKey: ASSET.asteroidTea, bobArtPx: 3, bobPeriodMs: 4700, flipX: false },
  { obstacleId: "soft-asteroid-04", textureKey: ASSET.asteroidMochi, bobArtPx: 2, bobPeriodMs: 3900, flipX: true },
  { obstacleId: "soft-asteroid-05", textureKey: ASSET.asteroidCrumb, bobArtPx: 2, bobPeriodMs: 3300, flipX: false },
];

export type DebrisDefinition = {
  readonly frame: number;
  /** Parallax-space position (screen position at camera scroll 0,0). */
  readonly x: number;
  readonly y: number;
  readonly scrollFactor: number;
  /** Index into `debrisStyle.tints` (a warm plum/ink ramp; debris stays fully opaque). */
  readonly tint: number;
  readonly driftX: number;
  readonly driftY: number;
  readonly driftPeriodMs: number;
  /**
   * Quarter-turn tumble interval in ms (0 = none). Debris turns in 90 degree steps only, so the
   * pixel grid is never resampled by an arbitrary rotation.
   */
  readonly tumbleMs: number;
};

export const debrisTextureKey: AssetKey = ASSET.asteroidDebris;
// Only the warm frames (0 mauve chip, 1 cream pebble) are used: frames 2-3 are green/blue-grey,
// outside the plum/ink palette, and turn muddy under the tint.

/**
 * Midground debris look: opaque (partial alpha over navy turned the rocks into flat grey-green
 * lumps) and multiply-tinted per instance from a soft plum/lilac ramp, so their authored cream
 * highlights and ink outline survive while they sit back behind the hero asteroids.
 */
export const debrisStyle = {
  tints: ["#C9B9D9", "#B5A6C9", "#D8C6CF"] as const,
} as const;

export const flightDebris: readonly DebrisDefinition[] = [
  { frame: 0, x: 210, y: 150, scrollFactor: 0.6, tint: 0, driftX: 18, driftY: 8, driftPeriodMs: 9000, tumbleMs: 2600 },
  { frame: 0, x: 760, y: 470, scrollFactor: 0.55, tint: 1, driftX: -14, driftY: 10, driftPeriodMs: 11000, tumbleMs: 3400 },
  { frame: 1, x: 1180, y: 250, scrollFactor: 0.65, tint: 2, driftX: 20, driftY: -6, driftPeriodMs: 10000, tumbleMs: 0 },
  { frame: 1, x: 1520, y: 820, scrollFactor: 0.6, tint: 0, driftX: -10, driftY: -12, driftPeriodMs: 12500, tumbleMs: 3000 },
  { frame: 0, x: 1890, y: 420, scrollFactor: 0.7, tint: 1, driftX: 16, driftY: 10, driftPeriodMs: 9500, tumbleMs: 0 },
  { frame: 0, x: 2240, y: 980, scrollFactor: 0.6, tint: 2, driftX: -18, driftY: 6, driftPeriodMs: 13000, tumbleMs: 3800 },
  { frame: 1, x: 2620, y: 300, scrollFactor: 0.68, tint: 0, driftX: 12, driftY: 14, driftPeriodMs: 10500, tumbleMs: 2800 },
  { frame: 1, x: 980, y: 1080, scrollFactor: 0.62, tint: 1, driftX: 14, driftY: -10, driftPeriodMs: 11500, tumbleMs: 0 },
  { frame: 0, x: 2980, y: 760, scrollFactor: 0.66, tint: 2, driftX: -12, driftY: -8, driftPeriodMs: 12000, tumbleMs: 3200 },
  { frame: 0, x: 420, y: 760, scrollFactor: 0.58, tint: 0, driftX: 10, driftY: 12, driftPeriodMs: 10000, tumbleMs: 0 },
];

/** Colour per docking state, shared by the arrival beacon, indicator, and HUD status pill. */
export const dockingStateColors: Readonly<Record<DockingStateKind, string>> = {
  "too-far": colors.duskBlue,
  approaching: colors.ember,
  "slow-down": colors.brick,
  align: colors.plum,
  ready: colors.sage,
};

/** Delivery beacon. All lengths are ART px (displayed at FLIGHT_ART_SCALE on the pixel grid). */
export const arrivalBeaconStyle = {
  /** Dashed ring: number of dashes and the fraction of each slot that is drawn. */
  dashCount: 32,
  dashFill: 0.55,
  dashFillReady: 0.8,
  ringThickness: 2,
  /** Dark underlay band so the ring reads over the bright moon limb. */
  ringShadowThickness: 4,
  ringShadowAlpha: 0.55,
  /** Outer approach ring (very faint dotted circle). */
  approachDashCount: 96,
  approachDashFill: 0.25,
  approachAlpha: 0.18,
  lanternCount: 8,
  /** Lanterns light up in a slow chase. */
  lanternChaseMs: 1400,
  /**
   * Chevron badge sits inside the ring, this far from the centre along the bottom direction: in the
   * gap between the ghost and the moon limb (the limb is ~28 art px from the dock centre).
   */
  badgeDistance: 17,
  plateRadius: 9,
  plateAlpha: 0.9,
  plateRimAlpha: 0.45,
  chevronLength: 5,
  chevronHalfWidth: 5,
  chevronThickness: 2,
  chevronSpacing: 4,
  chevronBobArtPx: 1,
  chevronBobMs: 900,
  /** Progress arc band just outside the ring. */
  progressGap: 5,
  progressThickness: 3,
  /**
   * Ghost target pose traced from the ship's pre-rotated idle cell: cream 1-art-px outline plus a
   * checker fill, pulsing gently. It sits `ghostBackArt` art px back from the centre (away from the moon).
   */
  ghostColor: colors.parchment,
  ghostFillAlpha: 0.18,
  /** Inked interior detail of the source art (dark pixels) is traced at this alpha, so the pleated crust, dome and legs read. */
  ghostDetailAlpha: 0.75,
  ghostBackArt: 9,
  ghostAlphaMin: 0.55,
  ghostAlphaMax: 0.95,
  ghostPulseMs: 1600,
  idleAlpha: 0.55,
  activeAlpha: 0.95,
  /** Label pill sits this far (screen px) below the ring's outer edge (or above it when blocked). */
  labelGap: 24,
  /** Screen px the label keeps from HUD controls and the screen edge before it hops above the ring. */
  labelClearancePx: 8,
} as const;

export const destinationIndicatorStyle = {
  margin: 58,
  bottomReserve: 72,
  discRadius: 17,
  /** Extra length of the pin's point beyond the disc edge. */
  pinTipLength: 10,
  moonGlyphRadius: 9,
  chevronGap: 5,
  chevronTravel: 4,
  chevronLength: 6,
  chevronHalfWidth: 7,
  chevronThickness: 3,
  /** Text pill centred under (or above) the pin. */
  labelGap: 30,
  pillPaddingX: 10,
  pillPaddingY: 5,
  pillLineGap: 1,
  pillRadius: 6,
  pillAlpha: 0.82,
  /** Campaign only: opaque pill + backing plate so world art never shows through the indicator. */
  campaignPillAlpha: 0.95,
  plateAlpha: 0.92,
  plateExtraRadius: 12,
  pulseMs: 1200,
  /** Half width (px before uiScale) of the pin + label column, for HUD avoidance. */
  footprintHalfWidth: 48,
  /** Pin centre keeps this far (px before uiScale) above HUD controls in its column. */
  avoidClearance: 46,
  /** Fiction units: 100 world px = 1 "km" on the instrument readout. */
  pxPerUnit: 100,
  unitLabel: "km",
} as const;

export const shipVisualStyle = {
  /**
   * Display scale for pre-contract ship art (144x160 canvases). Contract art (SHIP_ART, 64x80)
   * always displays at its integer artScale (2); this only applies until the redraw lands.
   */
  legacyFlightScale: 0.72,
  /** Idle micro-bob of the sprite only (never moves the physics body or camera target). */
  bobPx: 2,
  bobPeriodMs: 2400,
  tiltBobRadians: 0.025,
  /** Engine glow and particle trail positions below the saucer centre, in ART px. */
  engineOffsetArt: 14,
  trailOffsetArt: 30,
  /** Same offsets in screen px for the legacy art at legacyFlightScale. */
  legacyEngineOffset: 36,
  legacyTrailOffset: 46,
  /**
   * Nozzle glow (fx stepped pixel glow at FLIGHT_ART_SCALE): fixed alpha per hard level, never a
   * continuous fade. `pilot` is the idle pilot light; thrust flickers between the two thrust levels.
   */
  engineGlowLevels: { pilot: 0.35, thrust: 1, thrustLow: 0.7 } as const,
  engineFlickerMs: 70,
  squash: { "soft-bump": 0.16, "dramatic-bump": 0.22, "gyoza-incident": 0.26 } as const,
  squashMs: 130,
  /**
   * Brief warm flash on the hull when bumped (ms), its colour and blend: `screen` with a mid-warm
   * colour lifts the hull without washing it out (face, dome and pleats stay readable), then steps
   * down to a softer warm for the rest of the flash. Bright colours read as a blank silhouette.
   */
  bumpFlashMs: { "soft-bump": 120, "dramatic-bump": 160 } as const,
  bumpFlashColor: "#7A5C38",
  bumpFlashSettleColor: "#3E3022",
  bumpFlashPeakMs: 50,
  bumpFlashMode: "screen",
  /** Thrust intensity reaches 1 at this speed (px/s). */
  intensitySpeed: 260,
} as const;

/** Flight dashboard layout (screen px at 1280x720 before compactUiScale). */
export const flightHudLayout = {
  margin: 16,
  panelWidth: 268,
  /** Narrower instrument panel on phones (before compactUiScale), so four rows stay compact. */
  compactPanelWidth: 236,
  stackGap: 8,
  /** Keycap hint strip, bottom centre (keyboard devices only). */
  hintBottom: 14,
  hintGap: 6,
  hintGroupGap: 18,
  hintPaddingX: 12,
  hintPaddingY: 6,
  hintAlpha: 0.9,
  /** Dashboard ticker (top centre on desktop, beside the panel on compact displays). */
  tickerWidth: 480,
  /** Touch pads (touch devices only), anchored to the bottom corners. */
  touchRadius: 52,
  touchInset: 74,
  touchSpacing: 118,
} as const;

/** Package meter accent by condition (0..100), warmest band first. */
export const packageMeterBands: readonly { readonly min: number; readonly accent: "sage" | "amber" | "ember" }[] = [
  { min: 70, accent: "sage" },
  { min: 40, accent: "amber" },
  { min: 0, accent: "ember" },
];

export type FlightHintGroup = { readonly keys: readonly string[]; readonly label: string };

export const flightHudCopy = {
  title: "tea moon route",
  speed: "speed",
  distance: "moon",
  bottom: "bottom",
  package: "package",
  speedUnit: "km/s",
  incidentPill: "gyoza incident",
  arrivingPill: "landing window open",
  hints: [
    { keys: ["W"], label: "thrust" },
    { keys: ["S"], label: "brake" },
    { keys: ["A", "D"], label: "rotate" },
    { keys: ["R"], label: "restart" },
  ] satisfies readonly FlightHintGroup[],
  touch: { rotateLeft: "left", rotateRight: "right", brake: "brake", thrust: "thrust" },
  /** Arrival status pill label per docking state. */
  pill: {
    "too-far": "cruising",
    approaching: "approaching",
    "slow-down": "slow down",
    align: "align bottom",
    ready: "ready",
  } satisfies Readonly<Record<DockingStateKind, string>>,
  beaconLabel: "bottom to moon",
  indicatorLabel: "tea moon",
  ready: "hold steady...",
} as const;

export const flightLines = {
  start: "tea moon beacon is humming",
  boundsBump: "edge bounce registered",
  softBump: "soft bump, snack morale intact",
  dramaticBump: "dramatic bump, still dinner",
  boundsIncident: "route wall requested a softer approach",
  incident: "gyoza incident: dumpling briefly became weather",
  respawn: "gyoza reassembled. dignity optional",
  align: "point bottom at the landing guide",
  slowDown: "dock says: tiny brakes, please",
  pause: "pause menu is still in the pantry",
  debugOn: "debug vectors on",
  debugOff: "debug vectors tucked away",
  arrival: "landing window open. here we go",
} as const;

// --- Campaign routes (non-legacy themes) -------------------------------------------------

/** Generic flight copy for campaign destinations (Tea Moon keeps `flightHudCopy`). */
export const campaignFlightCopy = {
  distance: "dock",
  beaconLabel: "bottom to dock",
  forceLabel: { "radial-gravity": "pull", "directional-current": "drift", gust: "gust" },
  gustWarningLabel: "gust soon",
} as const;

/** Route rock textures and their canvas size in art px (contract: body diameter in art px == radius). */
export const campaignRockTextures: readonly { readonly key: AssetKey; readonly canvasArtPx: number }[] = [
  { key: ASSET.asteroidSleepy, canvasArtPx: 76 },
  { key: ASSET.asteroidRice, canvasArtPx: 92 },
  { key: ASSET.asteroidTea, canvasArtPx: 100 },
  { key: ASSET.asteroidMochi, canvasArtPx: 84 },
  { key: ASSET.asteroidCrumb, canvasArtPx: 66 },
];

/** Presentation for campaign route mechanics. Colours default to the route theme palette at runtime. */
export const campaignFlightStyle = {
  destination: {
    /** Destination art is 160 art px square at 2x. */
    halfSizePx: 160,
    /** Gap between the arrival ring and the body centre offset (px), like the Tea Moon limb. */
    gapPx: 30,
    haloRadiusArt: 60,
    haloSteps: [4, 9, 15, 22] as const,
    haloAlpha: 0.05,
    breathAlpha: 0.3,
  },
  rockBob: { bobArtPx: 2, basePeriodMs: 3400, periodStepMs: 380 },
  track: { alpha: 0.75, orbitAlpha: 0.55, dashPx: 16, gapPx: 8, dotPx: 6, bulbRadiusPx: 10, bulbAlpha: 0.9 },
  flow: { spacingPx: 300, currentSpacingPx: 210, currentLanes: 4, alpha: 0.72, speedPxPerSecond: 52, edgeInsetPx: 54 },
  gust: {
    spacingPx: 190,
    lanes: 5,
    speedPxPerSecond: 110,
    windsockInsetPx: 90,
    /** Windsock sits this far below the entry line, out of the indicator label band and off the flight line. */
    windsockDropPx: 150,
    streakSpacingPx: 120,
    streakSpeedScale: 1.6,
    bandFillAlpha: 0.07,
    bandEdgeAlpha: 0.55,
  },
  gravity: {
    ringFractions: [0.92, 0.64, 0.38] as const,
    ringAlphas: [0.16, 0.22, 0.3] as const,
    dotPx: 4,
    dotSpacingPx: 14,
    arrowsPerRing: 8,
    arrowSizePx: 14,
    breathAlpha: 0.25,
    breathMs: 2600,
  },
  /** Fog = soft stepped puffs (art-px radii), jittered and thinned at the fringe; colour is a pale tea mist. */
  fog: { puffSpacingPx: 260, puffRadiiArt: [14, 22, 30] as const, puffSteps: [0, 4, 8, 12, 16, 20, 24, 28, 32] as const, companionOffset: [0.8, 0.3] as const, color: "#DCE7CB", driftScale: 1, edgeFadePx: 140, seed: 23 },
  pickup: { bobArtPx: 2, bobPeriodMs: 2600, haloRadiusArt: 10, haloSteps: [2, 5] as const, haloAlpha: 0.12 },
  lantern: { bodyColor: "#3A2E2A", noteColor: "#F4E6C8", glowRadiusArt: 14, glowSteps: [3, 8, 14, 20] as const, glowAlpha: 0.1, idleAlpha: 0.85 },
  gauge: { width: 164, height: 68, gap: 6, arrowPx: 9 },
} as const;

export type CampaignBackdropProp = "lunch-crate" | "tea-leaf" | "flour-comet" | "rain" | "ribbon-lantern";

/**
 * Per-route colour mood for the campaign space backdrop. Parallax layers are multiply-tinted with
 * mid-tones (never the dark sky colour) so every route keeps Tea Moon-like depth with its own hue.
 * `layerTextureKeys` lets the final-art wave swap in painted layers per theme (code layer = fallback).
 */
export type CampaignBackdropMood = {
  readonly cosmos: string;
  readonly layerTints: Readonly<Record<string, string>>;
  readonly layerTextureKeys?: Readonly<Partial<Record<string, AssetKey>>>;
  /** Celestial bodies reused from `flightCelestialBodies` by id, re-tinted and re-placed (screen px). */
  readonly bodies: readonly { readonly id: string; readonly x: number; readonly y: number; readonly tint: string }[];
  readonly debrisTints: readonly [string, string, string];
  readonly debrisAlpha: number;
  readonly prop: CampaignBackdropProp | null;
};

export const campaignBackdropMoods: Readonly<Record<ThemeId, CampaignBackdropMood | null>> = {
  teaMoon: null,
  bentoBelt: {
    cosmos: "#211C2A",
    layerTints: { "stars-far": "#F4E2CC", nebula: "#F0A878", "stars-near": "#FBEBD8" },
    bodies: [{ id: "far-plum", x: 960, y: 150, tint: "#E2B49A" }, { id: "im-fine", x: 300, y: 600, tint: "#C9A48F" }],
    debrisTints: ["#E3BFA2", "#CDA58C", "#EBD0B8"],
    debrisAlpha: 0.85,
    prop: "lunch-crate",
  },
  matchaNebula: {
    cosmos: "#16211E",
    layerTints: { "stars-far": "#E2EFD4", nebula: "#9FC690", "stars-near": "#EEF6E2" },
    bodies: [{ id: "far-plum", x: 1010, y: 160, tint: "#AFCB9F" }, { id: "im-fine", x: 560, y: 600, tint: "#98B48C" }],
    debrisTints: ["#B9D0A6", "#A3BD92", "#CBDDB8"],
    debrisAlpha: 0.8,
    prop: "tea-leaf",
  },
  blackHoleBakery: {
    cosmos: "#1B1428",
    layerTints: { "stars-far": "#EADCF2", nebula: "#A684D6", "stars-near": "#F3E8F8" },
    bodies: [{ id: "far-plum", x: 980, y: 140, tint: "#C3A6DE" }, { id: "im-fine", x: 260, y: 610, tint: "#A790C4" }],
    debrisTints: ["#D2BDE4", "#BCA4D2", "#E6D2C6"],
    debrisAlpha: 0.85,
    prop: "flour-comet",
  },
  imFine: {
    cosmos: "#162030",
    layerTints: { "stars-far": "#D9E4F0", nebula: "#7FA2D0", "stars-near": "#E7EEF6" },
    bodies: [{ id: "far-plum", x: 980, y: 150, tint: "#A6B8D2" }],
    debrisTints: ["#AFC1D6", "#9BB0C8", "#C6D3E2"],
    debrisAlpha: 0.8,
    prop: "rain",
  },
  home: {
    cosmos: "#221A2C",
    layerTints: { "stars-far": "#F4E0E6", nebula: "#E893B2", "stars-near": "#F8EAEE" },
    bodies: [{ id: "far-plum", x: 960, y: 150, tint: "#DDB0C2" }, { id: "im-fine", x: 620, y: 610, tint: "#BFA0B4" }],
    debrisTints: ["#E2C0CC", "#CFA9B8", "#EED6C8"],
    debrisAlpha: 0.85,
    prop: "ribbon-lantern",
  },
};

/** Far parallax props: deep scroll factor, low alpha, placed per route clear of gameplay. */
export const campaignPropStyle = { scrollFactor: 0.45, alpha: 0.4, count: 4, radiusPx: 60, keepOutPadPx: 50, gridStepPx: 120 } as const;
export const campaignCuePalette = { matcha: "#B7C69A", cream: "#F4E6C8", fog: "#80966B" } as const;

/** Static rock look for a campaign route obstacle: deterministic texture by size, gentle bob. */
export function campaignAsteroidVisual(obstacleId: string, radius: number, index: number, textureKey: AssetKey): AsteroidVisualDefinition {
  const bob = campaignFlightStyle.rockBob;
  return {
    obstacleId,
    textureKey,
    bobArtPx: bob.bobArtPx,
    bobPeriodMs: bob.basePeriodMs + (index % 4) * bob.periodStepMs + Math.round(radius),
    flipX: index % 2 === 1,
  };
}
