import { ASSET } from "./assetManifest";
import { colors } from "../game/designTokens";
import type { ThemeId } from "../types/campaign";
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
    /** Top-left corner kept free of twinkles: the HUD panel (desktop and the scaled-up compact one) sits there. */
    hudClearRight: 500,
    hudClearBottom: 260,
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
    steamOffsetX: 68,
    steamOffsetY: 134,
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
    /** Panel + ticker width; chatter wraps onto a second ticker line instead of growing the panel (unit-tested). */
    width: 300,
    /** The chatter ticker wraps long punchlines onto a second line rather than ending in an ellipsis. */
    tickerLines: 2 as const,
    /** Narrower panel on phone-class displays (it is scaled up there). */
    compactWidth: 264,
    /** Keep the spawn/descent lane clear even at the largest phone HUD scale. */
    compactLaneHalfWidth: 140,
    /** Opaque backing under the translucent HudPanel / ticker surfaces, inset past their rounded corners. */
    backingInsetPx: 6,
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
  /** Touch tiles (screen px of the logical canvas). Left: slide pair. Right edge: steady stacked over thrust. */
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

/**
 * Generic campaign landing presentation (theme.legacy === false). Everything is derived from the landing
 * definition + theme palette; the per-theme record only holds decoration that has no gameplay meaning.
 * Screen px unless noted; art px are multiplied by LANDING_ART_SCALE.
 */
export const campaignLandingScenery = {
  /** Top of the ground band (world y); pads at y 612 sit on it, the raised home berth stands above it on legs. */
  groundTopY: 648,
  skyBands: 32,
  starCount: 26,
  /** Default landmark anchor; each theme places its destination via `CampaignLandingDecor.landmark`. */
  landmark: { x: 1040, y: 250, scrollFactor: 0.45 },
  silhouette: { scrollFactor: 0.7, baseOffsetPx: 10, stepPx: 8 },
  berth: {
    key: ASSET.campaignBerthTiles,
    tileArtWidth: 32,
    tileArtHeight: 24,
    /** Walkable top face row inside the tile art (aligned to pad.surfaceY). */
    surfaceRowArtPx: 2,
    /** Row where feet and the contact shadow visually rest. */
    contactRowArtPx: 4,
    lampInsetPx: 12,
    lampSizePx: 6,
    /** Raised berths (bottom above the ground band) get legs this far apart and an underside beam. */
    legSpacingPx: 112,
    legWidthPx: 10,
    beamPx: 8,
  },
  rail: { heightPx: 6, tieSpacingPx: 24, bulbRadiusPx: 6, overhangPx: 20 },
  recipient: { x: 1080, touchX: 1010, frameIdle: 0, frameWelcome: 1, waveSwaps: 5, waveStepMs: 180 },
  recipientWindow: { width: 104, height: 100, bottomAboveGround: 24, cropRows: 44, framePx: 4, railPx: 14 },
  homeBanner: { width: 132, height: 36, postHeight: 54 },
  /** Sock art is drawn at 2x the landing art scale (integer) so it reads at a glance; warm wooden mast. */
  windsock: {
    key: ASSET.campaignWindsock, sockScale: LANDING_ART_SCALE * 2,
    /** Frame anchor (art px in a 24x32 frame): the sock's own pole is centred on this column, its top at this row. */
    // Final PNG alpha: each frame has a different two-column pole, measured left-to-right.
    poleArtX: [9, 6, 2, 1], poleTopArtY: [0, 0, 2, 1], frameArtWidth: 24, frameArtHeight: 32,
    poleColor: "#7D4B3E", poleShadow: "#48252F",
  },
  awning: { overhangPastPadPx: 20, depthPx: 18, stripePx: 16, postSpacingPx: 36 },
  flour: { count: 12, riseSpeedPx: 14, swayPx: 28, sizePx: 16, alpha: 0.7, topY: 504 },
  /** Light-gravity landings (gravity below this, px/s²) show floating flour specks. */
  lowGravityBelow: 120,
  windIndicator: { topPx: 90, compactTopPx: 116, width: 178, height: 34 },
  introCard: { width: 540, height: 164, figureWidth: 96 },
  touchdownOpacityMs: 100,
  welcomeTable: { width: 136, height: 66 },
  /** Dashboard: the mission's landingIntro line shows for this long after descent starts. */
  introNoteMs: 3600,
  /** Below this altitude (px) fixed-pad landings show the mission's landingCalm line. */
  calmNoteAltitude: 150,
} as const;

/**
 * Optional painted backdrop layers per theme. The final-art wave adds manifest keys and fills these in;
 * while a key is null (or its texture is missing) the code-drawn fallback renders that layer.
 */
export type CampaignLandingBackdrop = {
  readonly skyTexture: string | null;
  readonly farHillsTexture: string | null;
  readonly groundTexture: string | null;
};

/** Atmosphere tones layered on top of the theme palette (sky horizon glow, far/near hill bodies, rim light). */
export type CampaignLandingTones = {
  readonly horizon: string;
  readonly farHill: string;
  readonly nearHill: string;
  readonly rim: string;
};

/** Per-theme berth finish: tile tint plus a painted trim band (use trim "none" once final berth art lands). */
export type CampaignBerthFinish = {
  readonly tint: string;
  readonly rim: string;
  readonly skirt: string;
  readonly trim: "chevrons" | "slats" | "scallops" | "planks" | "stripes" | "none";
  readonly trimColor: string;
  readonly trimAlt: string;
};

export type CampaignPorchStyle = "shed" | "listening-post" | "dome-bakery" | "cottage" | "dock";
export type CampaignRockShape = "shard" | "mossy" | "crumb" | "boulder" | "pebbles";
export type CampaignGroundPattern = "plates" | "moss" | "tiles" | "wet" | "deck";
/** Ambient motes: dust drifting sideways, blinking fireflies / lantern motes, or rain slanting with the sampled wind. */
export type CampaignAmbient = { readonly kind: "drift" | "firefly" | "rain"; readonly count: number; readonly color: "light" | "accent" | "plaster" } | null;

/** Per-theme decoration (no collision). Windsock altitudes are px above the pad surface. */
export type CampaignLandingDecor = {
  readonly warmHorizon?: boolean;
  readonly backdrop: CampaignLandingBackdrop;
  readonly tones: CampaignLandingTones;
  readonly landmark: { readonly x: number; readonly y: number };
  /** Far silhouette hump heights (px), repeated across the width. */
  readonly silhouette: readonly number[];
  readonly ridgeShape: "rounded" | "crag" | "terraced";
  readonly nearHills: readonly number[];
  readonly ground: CampaignGroundPattern;
  readonly berth: CampaignBerthFinish;
  /** The recipient's building, centred on the recipient x (touch layouts shift it with the recipient). */
  readonly porch: { readonly style: CampaignPorchStyle; readonly width: number; readonly height: number };
  readonly props: readonly LandingDecorProp[];
  readonly rockShape: CampaignRockShape;
  readonly rocks: readonly { readonly x: number; readonly y: number; readonly size: number }[];
  readonly flour: boolean;
  readonly ambient: CampaignAmbient;
  /** "mast": own pole from the ground at x; "ridge": short mast on the porch roof ridge (x ignored). */
  readonly windsocks: readonly { readonly x: number; readonly altitude: number; readonly mount: "mast" | "ridge" }[];
  /** Porch awning + windbreak on the windward side (shelter landings). */
  readonly shelter: { readonly windbreakX: number; readonly windbreakWidth: number } | null;
  readonly canopy: { readonly x0: number; readonly x1: number; readonly y: number } | null;
};

export type LandingDecorProp = {
  readonly kind: "crate" | "bolts" | "lamp" | "chair" | "lantern" | "bush" | "mist" | "chimney" | "bread-rack" | "oven" | "puddle" | "bunting" | "mailbox";
  readonly x: number;
  readonly y: number;
  /**
   * Touch layouts: authored position clear of the slide / thrust pads (null hides the prop). When omitted,
   * props right of the pad follow the recipient's touch shift and the rest stay put.
   */
  readonly touchX?: number | null;
  readonly touchY?: number;
};

const NO_BACKDROP: CampaignLandingBackdrop = { skyTexture: null, farHillsTexture: null, groundTexture: null };

export const campaignLandingDecor: Readonly<Record<Exclude<ThemeId, "teaMoon">, CampaignLandingDecor>> = {
  bentoBelt: {
    backdrop: { skyTexture: ASSET.campaignLandingSkyBento, farHillsTexture: ASSET.campaignLandingHillsBento, groundTexture: null },
    tones: { horizon: "#7A4E48", farHill: "#2A2537", nearHill: "#46393C", rim: "#E0A866" },
    landmark: { x: 1040, y: 250 },
    silhouette: [116, 174, 110, 196, 134, 100, 166, 114], ridgeShape: "crag", nearHills: [94, 66, 38, 48, 72, 100, 58],
    ground: "plates",
    berth: { tint: "#EFD2A8", rim: "#F6DDA8", skirt: "#2A2230", trim: "chevrons", trimColor: "#D69A57", trimAlt: "#2A2230" },
    porch: { style: "shed", width: 172, height: 124 },
    props: [
      { kind: "crate", x: 146, y: 648, touchX: 318 }, { kind: "crate", x: 214, y: 648, touchX: 318, touchY: 596 },
      { kind: "bolts", x: 258, y: 662, touchX: null }, { kind: "lamp", x: 290, y: 648, touchX: 370 }, { kind: "chair", x: 916, y: 648 },
    ],
    rockShape: "shard",
    rocks: [{ x: 44, y: 684, size: 30 }, { x: 362, y: 692, size: 18 }, { x: 870, y: 694, size: 14 }, { x: 1236, y: 682, size: 34 }],
    flour: false, ambient: { kind: "drift", count: 18, color: "accent" },
    windsocks: [], shelter: null, canopy: null,
  },
  matchaNebula: {
    backdrop: { skyTexture: ASSET.campaignLandingSkyMatcha, farHillsTexture: ASSET.campaignLandingHillsMatcha, groundTexture: null },
    tones: { horizon: "#C59169", farHill: "#1E2B34", nearHill: "#2C3A2B", rim: "#E2DD9A" },
    warmHorizon: true,
    landmark: { x: 1066, y: 236 },
    silhouette: [160, 212, 170, 140, 184, 220, 152, 166], ridgeShape: "rounded", nearHills: [108, 72, 50, 36, 72, 116, 90],
    ground: "moss",
    berth: { tint: "#EDE4BC", rim: "#FAF2CC", skirt: "#18221C", trim: "slats", trimColor: "#C4CE92", trimAlt: "#2C3828" },
    porch: { style: "listening-post", width: 168, height: 128 },
    props: [
      { kind: "lantern", x: 152, y: 648, touchX: 330 }, { kind: "lantern", x: 236, y: 648, touchX: 414 },
      { kind: "bush", x: 108, y: 652, touchX: 384 }, { kind: "bush", x: 220, y: 658, touchX: null }, { kind: "bush", x: 1200, y: 650, touchX: null },
      { kind: "mist", x: 170, y: 564, touchX: 330 }, { kind: "mist", x: 910, y: 574 },
    ],
    rockShape: "mossy",
    rocks: [{ x: 60, y: 690, size: 26 }, { x: 420, y: 688, size: 20 }, { x: 1250, y: 692, size: 28 }],
    flour: false, ambient: { kind: "firefly", count: 14, color: "light" },
    // Two mists: a low sock by the post reads the lower layer, a tall mast on the right reads the upper one.
    windsocks: [{ x: 284, altitude: 150, mount: "mast" }, { x: 880, altitude: 380, mount: "mast" }], shelter: null, canopy: null,
  },
  blackHoleBakery: {
    backdrop: { skyTexture: ASSET.campaignLandingSkyBakery, farHillsTexture: ASSET.campaignLandingHillsBakery, groundTexture: null },
    tones: { horizon: "#6E4A66", farHill: "#221A2E", nearHill: "#382B3A", rim: "#EBC27E" },
    landmark: { x: 1000, y: 226 },
    silhouette: [106, 106, 174, 174, 100, 186, 120, 120], ridgeShape: "terraced", nearHills: [60, 96, 38, 30, 42, 96, 70],
    ground: "tiles",
    berth: { tint: "#E2C3D2", rim: "#F6E2B6", skirt: "#2A1F33", trim: "scallops", trimColor: "#F6EAD2", trimAlt: "#7A4E5E" },
    porch: { style: "dome-bakery", width: 196, height: 148 },
    props: [
      { kind: "bread-rack", x: 182, y: 648, touchX: 414 }, { kind: "bread-rack", x: 292, y: 648, touchX: null },
      { kind: "oven", x: 100, y: 648, touchX: 328 }, { kind: "lamp", x: 916, y: 648 },
    ],
    rockShape: "crumb",
    rocks: [{ x: 26, y: 690, size: 22 }, { x: 392, y: 696, size: 16 }, { x: 870, y: 692, size: 24 }, { x: 1250, y: 694, size: 18 }],
    flour: true, ambient: null,
    // A flour streamer shows the oven's sideways pull.
    windsocks: [{ x: 1000, altitude: 190, mount: "mast" }], shelter: null, canopy: null,
  },
  imFine: {
    backdrop: { skyTexture: ASSET.campaignLandingSkyImFine, farHillsTexture: ASSET.campaignLandingHillsImFine, groundTexture: null },
    tones: { horizon: "#566A7E", farHill: "#202833", nearHill: "#2D3642", rim: "#A9BCCF" },
    landmark: { x: 1000, y: 214 },
    silhouette: [150, 184, 144, 192, 158, 148, 210, 174], ridgeShape: "crag",
    nearHills: [110, 80, 52, 40, 64, 112, 76],
    ground: "wet",
    berth: { tint: "#C2CCD8", rim: "#E2EAF2", skirt: "#1B212B", trim: "planks", trimColor: "#71829A", trimAlt: "#28303E" },
    porch: { style: "cottage", width: 156, height: 118 },
    props: [{ kind: "puddle", x: 156, y: 680, touchX: 350 }, { kind: "puddle", x: 970, y: 682 }, { kind: "chair", x: 908, y: 648 }, { kind: "lamp", x: 1210, y: 648, touchX: null }],
    rockShape: "boulder",
    rocks: [{ x: 70, y: 668, size: 50 }, { x: 236, y: 696, size: 34 }, { x: 1236, y: 692, size: 40 }],
    flour: false, ambient: { kind: "rain", count: 40, color: "plaster" },
    windsocks: [
      // High sock on the cottage roof ridge: fully exposed to the gusts, clear of the planet.
      { x: 0, altitude: 214, mount: "ridge" },
      { x: 382, altitude: 44, mount: "mast" },
    ],
    shelter: { windbreakX: 300, windbreakWidth: 120 },
    canopy: null,
  },
  home: {
    backdrop: { skyTexture: ASSET.campaignLandingSkyHome, farHillsTexture: ASSET.campaignLandingHillsHome, groundTexture: null },
    tones: { horizon: "#86607A", farHill: "#282140", nearHill: "#3A3148", rim: "#ECCD96" },
    landmark: { x: 1000, y: 236 },
    silhouette: [130, 166, 182, 148, 174, 136, 158, 144], ridgeShape: "rounded", nearHills: [78, 56, 42, 30, 54, 92, 68],
    ground: "deck",
    berth: { tint: "#F2DCC4", rim: "#FFF1D4", skirt: "#2B2236", trim: "stripes", trimColor: "#BA8798", trimAlt: "#E5C68F" },
    porch: { style: "dock", width: 204, height: 136 },
    props: [
      { kind: "bunting", x: 120, y: 344 }, { kind: "lamp", x: 186, y: 648, touchX: 300 }, { kind: "lamp", x: 340, y: 648, touchX: null },
      { kind: "lamp", x: 906, y: 648 }, { kind: "mailbox", x: 1200, y: 648, touchX: null }, { kind: "bunting", x: 930, y: 472 },
    ],
    rockShape: "pebbles",
    rocks: [{ x: 96, y: 690, size: 18 }, { x: 300, y: 694, size: 14 }, { x: 1240, y: 688, size: 16 }],
    flour: false, ambient: { kind: "firefly", count: 12, color: "light" },
    windsocks: [], shelter: null, canopy: { x0: 120, x1: 380, y: 300 },
  },
};
