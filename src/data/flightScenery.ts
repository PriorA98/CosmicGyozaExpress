import { ASSET, type AssetKey } from "./assetManifest";
import { colors } from "../game/designTokens";
import type { DockingStateKind } from "../types/flight";

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
   * `tile` repeats in both axes. `band` repeats horizontally only: the layer moves vertically
   * as one band, centred on the viewport, so a horizontally tileable texture never shows a seam.
   */
  readonly mode: "tile" | "band";
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
    mode: "band",
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

export type CelestialBodyDefinition = {
  readonly id: string;
  readonly textureKey: AssetKey;
  /** Position in parallax space: screen position when the camera scroll is (0, 0). */
  readonly x: number;
  readonly y: number;
  readonly scrollFactor: number;
  readonly scale: number;
  readonly alpha: number;
  /** Multiply tint that pushes distant bodies back into the sky. */
  readonly tint: string;
  /** Visual-only slow drift range in px and its period. */
  readonly driftPx: number;
  readonly driftPeriodMs: number;
};

export const flightCelestialBodies: readonly CelestialBodyDefinition[] = [
  {
    id: "far-plum",
    textureKey: ASSET.planetFarPlum,
    x: 720,
    y: 112,
    scrollFactor: 0.04,
    scale: FLIGHT_ART_SCALE,
    alpha: 1,
    tint: "#8E8AA8",
    driftPx: 4,
    driftPeriodMs: 9000,
  },
  {
    id: "im-fine",
    textureKey: ASSET.celestialImFine,
    x: 150,
    y: 660,
    scrollFactor: 0.1,
    scale: FLIGHT_ART_SCALE,
    alpha: 1,
    tint: "#8F93AE",
    driftPx: 6,
    driftPeriodMs: 12000,
  },
];

/** Tea Moon destination body. The delivery ring (dock 2840,850 r132) hugs its left limb. */
export const teaMoonScenery = {
  textureKey: ASSET.celestialTeaMoon,
  x: 3050,
  y: 850,
  scale: FLIGHT_ART_SCALE,
  haloColor: "#C2CFAE",
  /** Halo rings drawn behind the moon, from inner to outer, as offsets beyond the moon radius. */
  haloSteps: [10, 24, 42, 66] as const,
  haloAlpha: 0.075,
  /** Visible moon body radius in screen px (art body ~ 90% of the 192px canvas, at 2x). */
  bodyRadius: 172,
  breathAlpha: 0.35,
} as const;

export type AsteroidVisualDefinition = {
  readonly obstacleId: string;
  readonly textureKey: AssetKey;
  readonly bobPx: number;
  readonly bobPeriodMs: number;
  readonly wobbleDegrees: number;
  readonly wobblePeriodMs: number;
  readonly flipX: boolean;
};

export const asteroidArt = {
  /** Asteroid art is 72x72; the rock body fills ~88% of the canvas. */
  canvasPx: 72,
  bodyFillRatio: 0.88,
  fallbackTextureKey: ASSET.asteroidSleepy,
  squashScale: 0.1,
  squashMs: 110,
  flashColor: colors.plaster,
  flashMs: 90,
  nudgePx: { "soft-bump": 4, "dramatic-bump": 9, "gyoza-incident": 14 } as const,
} as const;

export const asteroidVisuals: readonly AsteroidVisualDefinition[] = [
  { obstacleId: "soft-asteroid-01", textureKey: ASSET.asteroidSleepy, bobPx: 4, bobPeriodMs: 3600, wobbleDegrees: 3, wobblePeriodMs: 5200, flipX: false },
  { obstacleId: "soft-asteroid-02", textureKey: ASSET.asteroidRice, bobPx: 5, bobPeriodMs: 4200, wobbleDegrees: 2.5, wobblePeriodMs: 6100, flipX: false },
  { obstacleId: "soft-asteroid-03", textureKey: ASSET.asteroidTea, bobPx: 5, bobPeriodMs: 4700, wobbleDegrees: 2, wobblePeriodMs: 6800, flipX: false },
  { obstacleId: "soft-asteroid-04", textureKey: ASSET.asteroidMochi, bobPx: 4, bobPeriodMs: 3900, wobbleDegrees: 3, wobblePeriodMs: 5600, flipX: true },
  { obstacleId: "soft-asteroid-05", textureKey: ASSET.asteroidCrumb, bobPx: 3, bobPeriodMs: 3300, wobbleDegrees: 4, wobblePeriodMs: 4800, flipX: false },
];

export type DebrisDefinition = {
  readonly frame: number;
  /** Parallax-space position (screen position at camera scroll 0,0). */
  readonly x: number;
  readonly y: number;
  readonly scrollFactor: number;
  readonly scale: number;
  readonly alpha: number;
  readonly driftX: number;
  readonly driftY: number;
  readonly driftPeriodMs: number;
  /** Full turns per minute (visual only). */
  readonly spinRpm: number;
};

export const debrisTextureKey: AssetKey = ASSET.asteroidDebris;

export const flightDebris: readonly DebrisDefinition[] = [
  { frame: 0, x: 210, y: 150, scrollFactor: 0.6, scale: 2, alpha: 0.5, driftX: 18, driftY: 8, driftPeriodMs: 9000, spinRpm: 1.4 },
  { frame: 2, x: 760, y: 470, scrollFactor: 0.55, scale: 1, alpha: 0.45, driftX: -14, driftY: 10, driftPeriodMs: 11000, spinRpm: -2 },
  { frame: 1, x: 1180, y: 250, scrollFactor: 0.65, scale: 2, alpha: 0.5, driftX: 20, driftY: -6, driftPeriodMs: 10000, spinRpm: 1 },
  { frame: 3, x: 1520, y: 820, scrollFactor: 0.6, scale: 1, alpha: 0.42, driftX: -10, driftY: -12, driftPeriodMs: 12500, spinRpm: 2.4 },
  { frame: 0, x: 1890, y: 420, scrollFactor: 0.7, scale: 1, alpha: 0.48, driftX: 16, driftY: 10, driftPeriodMs: 9500, spinRpm: -1.6 },
  { frame: 2, x: 2240, y: 980, scrollFactor: 0.6, scale: 2, alpha: 0.46, driftX: -18, driftY: 6, driftPeriodMs: 13000, spinRpm: 1.2 },
  { frame: 1, x: 2620, y: 300, scrollFactor: 0.68, scale: 1, alpha: 0.44, driftX: 12, driftY: 14, driftPeriodMs: 10500, spinRpm: -2.2 },
  { frame: 3, x: 980, y: 1080, scrollFactor: 0.62, scale: 2, alpha: 0.46, driftX: 14, driftY: -10, driftPeriodMs: 11500, spinRpm: 1.8 },
  { frame: 0, x: 2980, y: 760, scrollFactor: 0.66, scale: 1, alpha: 0.42, driftX: -12, driftY: -8, driftPeriodMs: 12000, spinRpm: -1.2 },
  { frame: 2, x: 420, y: 760, scrollFactor: 0.58, scale: 1, alpha: 0.4, driftX: 10, driftY: 12, driftPeriodMs: 10000, spinRpm: 2 },
];

/** Colour per docking state, shared by the arrival beacon, indicator, and HUD status dot. */
export const dockingStateColors: Readonly<Record<DockingStateKind, string>> = {
  "too-far": colors.duskBlue,
  approaching: colors.ember,
  "slow-down": colors.brick,
  align: colors.plum,
  ready: colors.sage,
};

export const arrivalBeaconStyle = {
  /** Dashed ring: number of dashes and the fraction of each slot that is drawn. */
  dashCount: 36,
  dashFill: 0.58,
  ringWidth: 3,
  ringWidthReady: 4,
  /** Outer approach ring (very faint). */
  approachDashCount: 72,
  approachAlpha: 0.14,
  lanternCount: 8,
  lanternRadius: 4,
  lanternGlowRadius: 11,
  /** Lanterns light up in a slow chase toward the chevron. */
  lanternChaseMs: 1400,
  chevronInset: 16,
  chevronLength: 30,
  chevronHalfWidth: 20,
  chevronThickness: 7,
  chevronPlateRadius: 30,
  chevronBobPx: 5,
  chevronBobMs: 900,
  progressWidth: 6,
  progressGap: 9,
  ghostShipAlpha: 0.22,
  idleAlpha: 0.5,
  activeAlpha: 0.92,
  /** Beacon label sits this far below the chevron plate centre. */
  labelOffset: 46,
} as const;

export const destinationIndicatorStyle = {
  margin: 46,
  bottomReserve: 64,
  discRadius: 22,
  chevronLength: 13,
  chevronHalfWidth: 11,
  chevronThickness: 5,
  labelGap: 30,
  textBlockHeight: 30,
  readoutOffset: 13,
  pulseMs: 1200,
  /** Fiction units: 100 world px = 1 "km" on the instrument readout. */
  pxPerUnit: 100,
  unitLabel: "km",
} as const;

export const shipVisualStyle = {
  flightScale: 0.65,
  /** Idle micro-bob of the sprite only (never moves the physics body or camera target). */
  bobPx: 2.5,
  bobPeriodMs: 2400,
  tiltBobRadians: 0.025,
  /** Engine sits on the ship's bottom, this many px from the centre at flight scale. */
  engineOffset: 34,
  trailOffset: 44,
  engineGlowRadius: 15,
  engineGlowColor: colors.amber,
  engineGlowIdleAlpha: 0.12,
  engineGlowThrustAlpha: 0.5,
  engineFlickerMs: 70,
  squash: { "soft-bump": 0.08, "dramatic-bump": 0.16, "gyoza-incident": 0.2 } as const,
  squashMs: 120,
  /** Thrust intensity reaches 1 at this speed (px/s). */
  intensitySpeed: 260,
} as const;

export const flightHudStyle = {
  x: 18,
  y: 18,
  width: 272,
  paddingX: 16,
  paddingY: 14,
  rowHeight: 21,
  titleGap: 30,
  radius: 8,
  panelColor: "#141626",
  panelAlpha: 0.8,
  borderColor: "#F7F0DC",
  borderAlpha: 0.18,
  labelAlpha: 0.56,
  valueColumn: 92,
  noteGap: 10,
  noteWrap: 236,
  statusDotRadius: 4,
} as const;

export const flightHudCopy = {
  title: "tea moon route",
  speed: "speed",
  distance: "moon",
  bottom: "bottom",
  arrival: "arrival",
  package: "package",
  incidentMode: "incident",
  ready: "hold steady...",
  controlsKeyboard: "W/S thrust & brake  ·  A/D rotate  ·  R restart",
  controlsDevSuffix: "  ·  F1 debug",
  beaconLabel: "bottom side",
  indicatorLabel: "tea moon",
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
