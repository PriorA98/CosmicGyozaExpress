import { ASSET } from "./assetManifest";
import { colors } from "../game/designTokens";
import type { LandingIncidentKind } from "../types/landing";

export { landingCopy } from "./landingCopy";

/**
 * Tea Moon landing presentation: layout, art anchors, landing-aid styling, intro, HUD, and touch layout.
 * Rules and thresholds live in `landingTuning.ts`; copy lives in `landingCopy.ts`.
 *
 * Units: screen px at the 1280x720 logical canvas unless a field says "art px" (1 art px = `artScale` screen px).
 * Depths are offsets inside the shared `depth` bands from `src/game/designTokens.ts`.
 */
export const LANDING_ART_SCALE = 2;

export const landingScenery = {
  sky: {
    key: ASSET.lunarSky,
    /** Top row colour of the painted sky; fills the high sky above it (intro pan) and the shake overscan. */
    topColor: "#111326",
    /** Bottom row colour of the ground art; fills below the canvas so camera shake never shows the clear colour. */
    groundBelowColor: "#5F6176",
    /** Backdrop layers extend this far past every canvas edge (>= the strongest camera shake offset). */
    overscanPx: 16,
    /** Sparse pixel stars in the high sky above the painted sky (only seen during the arrival pan). */
    highStars: { count: 26, sizePx: 2, minAlpha: 0.25, maxAlpha: 0.75 },
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
    /** Landing surface line inside the pad art (the blanket's dark top outline). */
    surfaceRowArtPx: 6,
    /** Row of the blanket's top face where feet and the contact shadow visually rest (perspective depth). */
    contactRowArtPx: 10,
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
    /** Hard-edged stepped glow (pixel rings, additive). */
    glowRadiusX: 34,
    glowRadiusY: 30,
    glowRings: 3,
    glowRingAlpha: 0.22,
    glowLitAlpha: 1,
    glowDimAlpha: 0.22,
    /** Lamp centre measured from the lantern base, upward (screen px). */
    lampHeightPx: 38,
  },
  teahouse: {
    key: ASSET.lunarTeahouse,
    x: 1062,
    /** Moved inward on touch layouts so the right touch tiles keep a clear gap from it. */
    touchX: 992,
    baseSinkPx: 4,
    steamOffsetX: 42,
    steamOffsetY: 150,
  },
  rabbit: {
    key: ASSET.rabbitSprite,
    x: 924,
    touchX: 874,
    baseSinkPx: 2,
    /** Flip so the rabbit faces the pad (art is authored facing right). */
    flipX: true,
    idleFrames: [0, 1] as const,
    waveFrames: [2, 3] as const,
    idleFrameRate: 2,
    waveFrameRate: 6,
    /** Delay after touchdown before the rabbit waves (lets the dust settle first). */
    waveDelayMs: 220,
    /** Surprised hop height on incidents (screen px, even so it stays on the art grid). */
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
  /** Soft guide light standing on the pad, built from stepped pixel rows that dissolve toward the top. */
  guideLight: {
    height: 400,
    baseWidthRatio: 0.74,
    topWidthRatio: 1.02,
    /** Each band is a nested stepped wedge; more bands = brighter core. */
    bands: 4,
    bandAlpha: 0.03,
    /** Inner bands are this much shorter / narrower (share of the outer band, scaled by band index). */
    bandHeightFalloff: 0.5,
    bandWidthFalloff: 0.55,
    /** Row height of the stepped edge (screen px, multiple of the art scale). */
    stepPx: 4,
    /** Rows keep full strength up to this share of the height, then step down to 0 at the top. */
    fadeStart: 0.25,
    fadeSteps: 6,
    color: "#F9F3E5",
    /** Alpha multiplier while the ship is off the pad vs aligned over it. */
    idleIntensity: 0.55,
    alignedIntensity: 1,
    landedIntensity: 0.25,
    breathMs: 2400,
    breathAlpha: 0.12,
  },
  /** Corner brackets on the pad surface: ember when unaligned, sage when the ship is over the pad. */
  padBrackets: {
    armPx: 16,
    thicknessPx: 4,
    insetPx: 6,
    liftPx: 10,
    unalignedAlpha: 0.55,
    alignedAlpha: 0.95,
  },
  /** Ground shadow + touchdown ring under the ship (the main altitude cue), all pixel ellipses. */
  shadow: {
    minWidth: 36,
    maxWidth: 124,
    heightRatio: 0.2,
    minAlpha: 0.12,
    maxAlpha: 0.5,
    /** Altitude (px) at which the shadow reaches its smallest/faintest. */
    fadeAltitude: 420,
    /** The touchdown ring is this much wider than the shadow. */
    ringScale: 1.12,
    ringAlpha: 0.9,
    /** Dotted drop line: one 2x2 dot every `dropLineStepPx`. */
    dropLineStepPx: 10,
    dropLineGapPx: 10,
    dropLineAlpha: 0.45,
  },
  /** Warm flame light pooling on the ground while thrusting low. */
  thrustWash: {
    maxAltitude: 210,
    width: 160,
    height: 20,
    rings: 3,
    maxAlpha: 0.6,
    dustIntervalMs: 110,
    dustCount: 4,
    dustSpread: 34,
  },
  /** Pixel arrow next to the ship pointing back toward the pad while off it ("#" = filled art px). */
  padArrow: {
    distanceFromShip: 100,
    bobPx: 4,
    bobMs: 620,
    bitmap: ["#.....", "##....", "###...", "####..", "#####.", "####..", "###...", "##....", "#....."],
    shadowOffsetPx: 2,
  },
  /** Descent gauge that rides beside the ship. */
  instrument: {
    /** Clear of the gyro ring and level brackets (they reach ~84 px from the ship centre). */
    offsetX: 116,
    offsetY: -6,
    barWidth: 10,
    barHeight: 92,
    panelPadX: 10,
    panelPadY: 10,
    /** Space above the bar for the speed number. */
    headerPx: 24,
    needleSize: 6,
    labelGap: 8,
    chipPadX: 8,
    chipPadY: 4,
    smoothing: 0.22,
    edgeMarginX: 70,
    alpha: 0.95,
    /** Keeps the gauge (and its chip) above the pad surface by this margin. */
    surfaceMarginPx: 8,
  },
  /** Gyro stars (fx-star sprites, opaque) orbiting the ship while S (stabilizer) is held, plus level brackets. */
  gyro: {
    radiusX: 76,
    radiusY: 20,
    offsetY: 8,
    dotCount: 10,
    dotColor: colors.sage,
    dotAltColor: colors.teal,
    levelColor: colors.sage,
    spinRadPerSecond: 3.2,
    /** Stabilizer presence gained / lost per second (0..1): sets how many stars are out. */
    fadePerSecond: 6,
    /** fx-star frames cycled by the stars in front of the hull; the far side shows the small frame. */
    twinkleFrames: [2, 1, 2, 2, 1] as const,
    twinkleStepMs: 90,
    backFrame: 1,
    /** Level brackets: inner edge distance from the ship centre, half height, and arm length (screen px). */
    bracketInnerPx: 64,
    bracketHalfHeightPx: 8,
    bracketArmPx: 4,
    bracketShowAmount: 0.5,
  },
  /** Baked pixel flames (ship-fly-1..3) chosen by thrust power, plus the shared fx-thrust puffs. */
  thrust: {
    /** Power gained per second while W is held (0..1) and lost per second after release. */
    ignitePerSecond: 7,
    fadePerSecond: 9,
    /** Power at or above which ship-fly-2 / ship-fly-3 show; below `fly2` (but lit) shows ship-fly-1. */
    fly2Power: 0.4,
    fly3Power: 0.8,
    /** Below this power the flame is out (idle frame). */
    litPower: 0.04,
    /** Full-power flicker: the frame index (1..3) shown in each `flickerStepMs` slot. */
    flickerFrames: [3, 3, 2, 3, 3, 3, 2, 3] as const,
    flickerStepMs: 60,
    /** The fx puffs start this far inside the baked flame tip so they read as coming out of it. */
    trailInsetPx: 12,
    /** Trail intensity at full thrust power (fx-thrust puff rate/speed). */
    trailIntensity: 0.55,
  },
  ship: {
    /** Fallback feet line (fraction of texture height below the origin) if the texture cannot be measured. */
    fallbackFootRatio: 0.36,
    /** Touchdown "squash" is a downward dip in whole art px (no non-integer scaling of pixel art). */
    touchdownDipPx: { soft: 2, bumpy: 4 },
    dipInMs: 70,
    dipOutMs: 300,
  },
  incident: {
    /** Extra ship drop (screen px) on the hard-drop impact frame before the bounce. */
    hardDropImpactPx: 8,
    frameStepMs: 115,
    frameCount: 5,
    frameStartMs: { "hard-drop": 360, skid: 520, "tilt-tip": 470, "off-pad": 560 } satisfies Record<LandingIncidentKind, number>,
    /** Screen px the incident ship travels (integer-scale motion only: position + rotation). */
    hardDropBouncePx: 26,
    skidDistancePx: 170,
    tipShiftPx: 62,
    offPadShiftPx: 28,
    shockRingRadiusPx: 72,
    shockRingMs: 420,
    /** The skid leaves puffs this far behind the sliding ship. */
    skidTrailBehindPx: 40,
  },
  /**
   * Incident poof layers: flour blooms behind the hull at the contact point; the confetti fans up from a
   * ring around the ship (spawnRadius) in front of it, so nothing smears across the dumpling.
   */
  incidentPoof: {
    flourCount: 10,
    flourSpread: 110,
    flourSpawnRadiusPx: 20,
    confettiCount: 18,
    confettiSpread: 118,
    confettiSpawnRadiusPx: 58,
  },
  /** Per-incident dust (behind the ship unless `front`); kept small so the tumbling pose reads. */
  incidentDust: {
    hardDropImpact: { count: 10, spread: 110, spawnRadiusPx: 16, front: false },
    hardDropBounce: { count: 6, spread: 80, spawnRadiusPx: 16, front: false },
    skid: { count: 8, spread: 76, spawnRadiusPx: 12, front: false },
    skidTrail: { count: 3, spread: 40, spawnRadiusPx: 0, front: false },
    tiltTip: { count: 6, spread: 70, spawnRadiusPx: 12, front: false },
    offPad: { count: 12, spread: 104, spawnRadiusPx: 18, front: false },
    /** The final plop into soft moon dust is the one puff allowed in front of the ship. */
    offPadPlop: { count: 6, spread: 64, spawnRadiusPx: 36, front: true },
  },
  caption: {
    offsetY: 168,
    padX: 16,
    padY: 12,
    popMs: 220,
    retryBarHeight: 4,
    /** Keeps the caption this far from the canvas edges. */
    edgeMarginPx: 24,
  },
  /**
   * Touchdown dust, behind the hull at the feet: count per side scales with the touchdown speed (share of the
   * bumpy limit), so the gentlest landing gets the smallest puff. Bumpy landings add a few front puffs.
   */
  touchdownDust: {
    soft: { minCountPerSide: 3, maxCountPerSide: 4, spread: 34, lifespanMs: 460, footSpreadPx: 46 },
    bumpy: { minCountPerSide: 5, maxCountPerSide: 7, spread: 72, lifespanMs: 620, footSpreadPx: 44 },
    bumpyFront: { countPerSide: 2, spread: 52, lifespanMs: 380, footSpreadPx: 52 },
  },
  /** Arrival cinematic: camera eases down from the high sky while the ship drifts in from the top. */
  intro: {
    /** The camera starts this far above the play view. */
    risePx: 420,
    panMs: 1500,
    /** Ship starts this far above the top edge of the opening (raised) view... */
    shipStartAbovePx: 120,
    /** ...and this far to the side of its hand-off x, so it glides in on a gentle curve. */
    shipStartOffsetX: -72,
    shipMs: 1650,
    /** Thrust power of the braking flame while the ship glides in (0..1; ship-fly-1/2). */
    shipBrakePower: 0.5,
    /** Fade in from the flight hand-off colour (FlightScene's iris closes on ink). */
    fadeInMs: 380,
    fadeColor: colors.ink,
    cardDelayMs: 220,
    cardHoldMs: 1100,
    cardOutMs: 220,
    /** Card top edge (screen px): below the ship's glide path and its flame, above the pad, at any HUD scale. */
    cardTopPx: 300,
    cardWidth: 360,
    cardHeight: 104,
    /** Hard cap on the whole intro (the brief: <= 2 s). */
    totalMs: 1800,
    hudFadeMs: 260,
  },
  /** Landing -> result transition after the settle beat. */
  exit: {
    fadeMs: 420,
    color: colors.ink,
  },
  /** Display conversion for friendly readouts (shared by HUD and gauge). */
  readouts: {
    pixelsPerMeter: 24,
    risingDeadbandPxPerSecond: 4,
    driftArrowDeadbandPxPerSecond: 2,
  },
  hud: {
    x: 20,
    y: 20,
    /** Wide enough for the longest chatter line (see `tickerChromePx` / `tickerCharWidthPx`, unit-tested). */
    width: 332,
    /** Narrower panel on phone-class displays (it is scaled up there). */
    compactWidth: 264,
    /** Opaque backing under the translucent HudPanel / ticker surfaces, inset past their rounded corners. */
    backingInsetPx: 6,
    /** DashboardTicker space that is not text: prompt + left pad (28), right pad (12), caret gap + caret (11). */
    tickerChromePx: 51,
    /** JetBrains Mono 14 px advance (8.4 px) rounded up, so copy checks stay conservative. */
    tickerCharWidthPx: 8.5,
    /** Extra boost on top of `compactUiScale` so phone labels clear ~12 CSS px. */
    compactBoost: 1.12,
    tickerGap: 8,
    /** A changed chatter line must hold this long before the ticker retypes it (no flicker on taps). */
    noteDebounceMs: 380,
    /** How long after a retry the dashboard keeps its "fresh attempt" note. */
    retryNoteMs: 1600,
    /** Share of the soft tilt limit at which the dashboard starts nagging about tilt. */
    tiltNoteRatio: 0.75,
  },
  controlsHint: {
    bottomMargin: 18,
    /** Compact displays move the (enlarged) hint to the top-right corner so it never covers the pad. */
    topRightMargin: 20,
    gap: 6,
    groupGap: 18,
    labelGap: 8,
    padX: 12,
    padY: 8,
  },
  /** Touch-layout retry chip, pinned top-right (screen px of the logical canvas). */
  retryChip: {
    marginX: 22,
    marginY: 20,
  },
  /** Touch tiles (screen px of the logical canvas). Left: tilt pair. Right edge: steady stacked over thrust. */
  touch: {
    tileWidth: 116,
    tileHeight: 118,
    marginX: 18,
    marginBottom: 20,
    gap: 14,
  },
} as const;

export type LandingZoneCopyKey = "soft" | "bumpy" | "rough";

/** Landing-aid colour per live zone: sage safe, amber bumpy, brick too fast. */
export const landingZoneColors = {
  soft: colors.sage,
  bumpy: colors.amber,
  rough: colors.brick,
} as const satisfies Record<LandingZoneCopyKey, string>;

/** Readable HUD text colour per zone on the dark panel (brick is too dim for text, so too-fast uses ember). */
export const landingZoneTextColors = {
  soft: colors.plaster,
  bumpy: colors.amber,
  rough: colors.ember,
} as const satisfies Record<LandingZoneCopyKey, string>;
