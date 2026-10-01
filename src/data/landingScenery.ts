import { ASSET } from "./assetManifest";
import { colors } from "../game/designTokens";
import type { LandingIncidentKind, LandingResultKind } from "../types/landing";

/**
 * Tea Moon landing presentation: layout, art anchors, landing-aid styling, and copy.
 * Rules and thresholds live in `landingTuning.ts`; this file only says where things sit and how they look.
 *
 * Units: screen px at the 1280x720 logical canvas unless a field says "art px" (1 art px = `artScale` screen px).
 * Depths are offsets inside the shared `depth` bands from `src/game/designTokens.ts`.
 */
export const LANDING_ART_SCALE = 2;

export const landingScenery = {
  sky: {
    key: ASSET.lunarSky,
  },
  /** A few faint twinkles over the painted sky; deliberately sparse and dim so they never compete with the ship. */
  twinkles: {
    count: 12,
    maxY: 360,
    marginX: 40,
    minAlpha: 0.12,
    maxAlpha: 0.42,
    sizePx: 2,
    minPeriodMs: 2600,
    maxPeriodMs: 5200,
  },
  hills: {
    key: ASSET.lunarHillsFar,
    /** Art rows of the band that sit below the walkable surface line (hidden behind the ground). */
    overlapBelowSurfaceArtPx: 10,
    /** Screen px the hills slide per screen px the ship is off-centre: a gentle depth cue. */
    parallax: -0.05,
    alpha: 1,
  },
  ground: {
    key: ASSET.lunarGround,
    /** Walkable surface line inside the ground art. */
    surfaceRowArtPx: 8,
  },
  pad: {
    key: ASSET.lunarPad,
    /** Landing surface line inside the pad art. */
    surfaceRowArtPx: 6,
  },
  lanterns: {
    key: ASSET.lunarLantern,
    dimFrame: 0,
    litFrame: 1,
    /** Screen px from each pad-art end to the lantern centre, outward. */
    outsetFromPadEnd: 10,
    /** Lantern base sinks this far below the surface line so it reads as planted. */
    baseSinkPx: 2,
    /** Stagger between left and right lantern lighting on touchdown. */
    lightStaggerMs: 160,
    glowRadius: 26,
    glowLitAlpha: 0.32,
    glowDimAlpha: 0.08,
    /** Lamp centre measured from the lantern base, upward (screen px). */
    lampHeightPx: 38,
  },
  teahouse: {
    key: ASSET.lunarTeahouse,
    x: 1062,
    baseSinkPx: 4,
    steamOffsetX: 42,
    steamOffsetY: 150,
  },
  rabbit: {
    key: ASSET.rabbitSprite,
    x: 924,
    baseSinkPx: 2,
    /** Flip so the rabbit faces the pad (art is authored facing right). */
    flipX: true,
    idleFrames: [0, 1] as const,
    waveFrames: [2, 3] as const,
    idleFrameRate: 2,
    waveFrameRate: 6,
    /** Delay after touchdown before the rabbit waves (lets the dust settle first). */
    waveDelayMs: 220,
    /** Surprised hop height on incidents (screen px). */
    hopHeightPx: 14,
    idleAnimKey: "landing-rabbit-idle",
    waveAnimKey: "landing-rabbit-wave",
  },
  rocksKey: ASSET.lunarRocks,
  /** Foreground rock clusters: frame is one of the 3 variants; y is relative to the surface line. */
  rocks: [
    { x: 92, offsetY: 64, frame: 0, flipX: false },
    { x: 214, offsetY: 84, frame: 2, flipX: true },
    { x: 410, offsetY: 92, frame: 1, flipX: false },
    { x: 1168, offsetY: 78, frame: 1, flipX: true },
    { x: 1236, offsetY: 60, frame: 0, flipX: false },
  ] as const,
  rockAlpha: 1,
  /** Soft guide light standing over the pad. */
  guideLight: {
    height: 470,
    baseWidthRatio: 0.92,
    topWidthRatio: 1.45,
    bands: 7,
    bandAlpha: 0.026,
    color: "#F9F3E5",
    /** Alpha multiplier while the ship is off the pad vs aligned over it. */
    idleIntensity: 0.55,
    alignedIntensity: 1,
    landedIntensity: 0.25,
    breathMs: 2400,
  },
  /** Corner brackets on the pad surface: ember when unaligned, sage when the ship is over the pad. */
  padBrackets: {
    armPx: 16,
    lineWidth: 4,
    insetPx: 6,
    liftPx: 8,
    unalignedAlpha: 0.55,
    alignedAlpha: 0.95,
  },
  /** Ground shadow + touchdown ring under the ship (the main altitude cue). */
  shadow: {
    minWidth: 34,
    maxWidth: 132,
    heightRatio: 0.24,
    minAlpha: 0.08,
    maxAlpha: 0.42,
    /** Altitude (px) at which the shadow reaches its smallest/faintest. */
    fadeAltitude: 420,
    ringLineWidth: 3,
    ringAlpha: 0.9,
    dropLineDashPx: 8,
    dropLineGapPx: 8,
    dropLineAlpha: 0.38,
  },
  /** Warm flame light pooling on the ground while thrusting low. */
  thrustWash: {
    maxAltitude: 210,
    width: 170,
    height: 26,
    maxAlpha: 0.32,
    dustIntervalMs: 110,
    dustCount: 4,
    dustSpread: 34,
  },
  /** Arrow next to the ship pointing back toward the pad while off it. */
  padArrow: {
    distanceFromShip: 92,
    size: 14,
    bobPx: 4,
    bobMs: 620,
  },
  /** Descent gauge that rides beside the ship. */
  instrument: {
    offsetX: 96,
    offsetY: -6,
    barWidth: 10,
    barHeight: 92,
    panelPadX: 9,
    panelPadY: 9,
    needleSize: 7,
    labelGap: 10,
    smoothing: 0.22,
    edgeMarginX: 70,
    alpha: 0.95,
  },
  /** Gyro ring drawn around the ship while S (stabilizer) is held. */
  gyro: {
    radiusX: 74,
    radiusY: 20,
    offsetY: 8,
    dashCount: 10,
    dashArc: 0.32,
    lineWidth: 3,
    alpha: 0.75,
    spinRadPerSecond: 3.2,
    fadePerSecond: 6,
    levelLineHalfWidth: 26,
  },
  ship: {
    /** Close-up side view. The ship art is authored for artScale 1; keep integer scale. */
    scale: 1,
    /** Fallback feet line (fraction of texture height below centre) if the texture cannot be measured. */
    fallbackFootRatio: 0.36,
    /** Thrust trail emitter sits this far above the measured feet line, inside the nozzle. */
    nozzleInsetPx: 10,
    squashAmount: 0.14,
    squashStretchRatio: 0.7,
    squashInMs: 70,
    squashOutMs: 340,
  },
  incident: {
    frameStepMs: 115,
    frameCount: 5,
    frameStartMs: { "hard-drop": 360, skid: 520, "tilt-tip": 470, "off-pad": 560 } satisfies Record<LandingIncidentKind, number>,
  },
  caption: {
    offsetY: 168,
    padX: 16,
    padY: 9,
    popMs: 220,
    retryBarHeight: 4,
  },
  touchdownDust: {
    soft: { count: 10, spread: 46 },
    bumpy: { count: 18, spread: 78 },
    footSpreadPx: 34,
  },
  dashboard: {
    x: 20,
    y: 20,
    width: 336,
    padX: 18,
    padY: 14,
    rowHeight: 25,
    titleGap: 30,
    labelWidth: 96,
    valueWidth: 120,
    dotRadius: 5,
    noteGap: 10,
    alpha: 0.82,
    radius: 8,
  },
  controlsHint: {
    bottomMargin: 26,
    keySize: 26,
    gap: 6,
    groupGap: 22,
    alpha: 0.9,
  },
  touch: {
    radius: 46,
    zoneHeight: 240,
    panelWidthRatio: 0.42,
    panelMaxWidth: 430,
    panelGap: 16,
    idleAlpha: 0.22,
    activeAlpha: 0.55,
  },
} as const;

export type LandingZoneCopyKey = "soft" | "bumpy" | "rough";

/** Landing-aid colour per live zone: sage safe, amber bumpy, brick too fast. */
export const landingZoneColors = {
  soft: colors.sage,
  bumpy: colors.amber,
  rough: colors.brick,
} as const satisfies Record<LandingZoneCopyKey, string>;

export const landingCopy = {
  dashboardTitle: "TEA MOON · LANDING",
  rows: {
    descent: "descent",
    drift: "drift",
    tilt: "tilt",
    altitude: "altitude",
    package: "package",
  },
  units: {
    speed: "px/s",
    degrees: "°",
    altitude: "px",
  },
  zone: {
    soft: "soft",
    bumpy: "bumpy",
    rough: "too fast",
  } satisfies Record<LandingZoneCopyKey, string>,
  /** Zone label when the ship is not over the pad. */
  offPad: "find the pad",
  limitingHint: {
    descent: "ease the descent",
    drift: "too much drift",
    tilt: "level the gyoza",
    pad: "pad is that way",
  },
  notes: {
    descendingIdle: "please apply soup-facing thrust",
    thrusting: "single-thruster confidence: moderate",
    stabilizing: "gyro humming, dumpling leveling",
    tilted: "bottom not pointed at problem",
    offPad: "the pad is the glowing blanket",
    settling: "landing blanket engaged",
    retry: "fresh attempt, same warm dumpling",
  },
  incidentNotes: {
    "hard-drop": "moon blanket says: softer, please",
    skid: "sideways soup maneuver detected",
    "tilt-tip": "bottom thruster argued with geometry",
    "off-pad": "landing blanket missed the snack",
  } satisfies Record<LandingIncidentKind, string>,
  incidentTitle: "gyoza incident",
  retrying: "re-steaming for another try",
  touchdown: {
    soft: "featherlight landing!",
    bumpy: "bumpy, but delivered",
    incident: "",
  } satisfies Record<LandingResultKind, string>,
  controls: [
    { keys: ["W"], label: "thrust" },
    { keys: ["A", "D"], label: "tilt" },
    { keys: ["S"], label: "steady" },
    { keys: ["R"], label: "retry" },
  ],
  touchLabels: {
    rotateLeft: { glyph: "<", label: "tilt left" },
    rotateRight: { glyph: ">", label: "tilt right" },
    stabilizer: { glyph: "S", label: "steady" },
    thrust: { glyph: "^", label: "thrust" },
  },
} as const;
