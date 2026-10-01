import { ASSET, ASSET_MANIFEST, type AssetKey } from "../data/assetManifest";
import { colorNumber, colors, motion } from "../game/designTokens";

/**
 * Typed tuning for every visual feedback recipe in `src/fx/` (owner: audio-fx package).
 * Pure data: no Phaser imports, so tests can verify budgets and ranges.
 *
 * Pixel contract: every particle renders at its sheet's integer `artScale` (2 = 1 art px is
 * 2 screen px, the same grid as the ship, asteroids and scenery). There are no random scale
 * ranges; bursts grow and shrink through their authored frames only.
 */

export type ParticleSheetId = "thrust" | "dust" | "sparkle" | "steam" | "star";

export type ParticleSheet = {
  readonly key: AssetKey;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly frameCount: number;
  readonly artScale: number;
};

const SHEET_KEYS: Readonly<Record<ParticleSheetId, AssetKey>> = {
  thrust: ASSET.fxThrust,
  dust: ASSET.fxDust,
  sparkle: ASSET.fxSparkle,
  steam: ASSET.fxSteam,
  star: ASSET.fxStar,
};

function sheetFor(id: ParticleSheetId): ParticleSheet {
  const key = SHEET_KEYS[id];
  const entry = ASSET_MANIFEST.find((candidate) => candidate.key === key);
  if (!entry || entry.kind !== "spritesheet") {
    return { key, frameWidth: 8, frameHeight: 8, frameCount: 1, artScale: 2 };
  }
  return { key, frameWidth: entry.frameWidth, frameHeight: entry.frameHeight, frameCount: entry.frameCount, artScale: entry.artScale };
}

export const PARTICLE_SHEETS: Readonly<Record<ParticleSheetId, ParticleSheet>> = {
  thrust: sheetFor("thrust"),
  dust: sheetFor("dust"),
  sparkle: sheetFor("sparkle"),
  steam: sheetFor("steam"),
  star: sheetFor("star"),
};

/**
 * Sheets whose neutral-grey tail pixels are recoloured into a warm oat/plaster ramp at load
 * (see `fxTextures.ts`), so cooling smoke reads as cozy flour and steam instead of soot on
 * dark space. Saturated pixels (cream, blue shading, ember, gold) are left untouched.
 */
export const WARM_RECOLOR = {
  sheets: ["thrust", "dust", "steam"] as readonly ParticleSheetId[],
  /** A pixel counts as neutral grey when max(r,g,b) - min(r,g,b) is at most this (0..255). */
  neutralSpread: 30,
  /** Neutral luminance 0..1 is lifted into lift.min..lift.max before mapping onto the ramp. */
  lift: { min: 0.42, max: 1 },
  /** Warm ramp, dark to light (luminance positions 0..1). */
  ramp: [
    { at: 0.42, color: colors.borderStrong },
    { at: 0.72, color: colors.wallpaper },
    { at: 1, color: colors.plaster },
  ],
} as const;

export const FX_BUDGET = {
  /** Hard ceiling of live particles across every fx emitter in one scene (ARCHITECTURE.md 8). */
  maxLiveParticlesPerScene: 300,
  thrustMaxAlive: 90,
  steamMaxAlivePerSource: 14,
  burstMaxCount: 48,
  /** Reduced motion keeps feedback but thins it out. */
  reducedMotionFactor: 0.5,
} as const;

export type Range = { readonly min: number; readonly max: number };

/**
 * Stepped (pixel-honest) fade: opacity holds at `start` until `holdUntil` of the particle's
 * life, then drops in `steps` hard steps to 0. Avoids long half-transparent tails that mix
 * into muddy greys and browns over navy skies.
 */
export type SteppedFade = { readonly start: number; readonly holdUntil: number; readonly steps: number };

export type ThrustTuning = {
  readonly defaultOffset: number;
  /** Puffs per second at intensity 1 (scaled down to `minRateFactor` at intensity 0). */
  readonly ratePerSecond: number;
  readonly minRateFactor: number;
  readonly lifespanMs: Range;
  readonly speed: Range;
  /** Extra exhaust speed at full intensity. */
  readonly intensitySpeed: number;
  readonly spreadDegrees: number;
  /** Sideways jitter at the nozzle (px). */
  readonly nozzleJitter: number;
  readonly drag: number;
  readonly color: readonly number[];
  readonly fade: SteppedFade;
  /** Sheet frames played once across `animMs` (flame tongue -> warm puff -> oat wisp). */
  readonly frames: readonly number[];
  readonly animMs: number;
};

export const THRUST_TUNING: ThrustTuning = {
  defaultOffset: 40,
  ratePerSecond: 40,
  minRateFactor: 0.45,
  lifespanMs: { min: 380, max: 540 },
  speed: { min: 70, max: 110 },
  intensitySpeed: 60,
  spreadDegrees: 8,
  nozzleJitter: 2,
  drag: 0.9,
  // Warm wash only: keeps the authored ember/amber and lets the tail settle on cream, not dusk grey.
  color: [0xffffff, 0xfff4e0, 0xfbe6d0, 0xf4e2cc],
  fade: { start: 1, holdUntil: 0.55, steps: 3 },
  frames: [0, 1, 2, 3, 4, 5, 6],
  animMs: 520,
};

export type BurstTuning = {
  readonly sheet: ParticleSheetId;
  readonly count: number;
  readonly speed: Range;
  readonly lifespanMs: Range;
  readonly gravityY: number;
  readonly tints: readonly number[];
  readonly fade: SteppedFade;
  /**
   * `frames` play once across `durationMs`, or repeat when `loop` (twinkles). Frames are an
   * explicit list so tail frames that read as soot or dirt on dark space can be left out.
   */
  readonly anim: { readonly frames: readonly number[]; readonly durationMs: number; readonly loop: boolean };
  /** Initial upward bias (px/s) so bursts bloom instead of spraying flat. */
  readonly lift: number;
};

export type BurstKind = "dust" | "sparkle" | "incidentFlour" | "incidentConfetti" | "star";

export const BURST_TUNING: Readonly<Record<BurstKind, BurstTuning>> = {
  dust: {
    sheet: "dust",
    count: 10,
    speed: { min: 20, max: 80 },
    lifespanMs: { min: 480, max: 760 },
    gravityY: -12,
    // Near-white washes keep the authored cream; heavier tints read as grey smoke.
    tints: [0xffffff, 0xfdf6e8, 0xf8eedc],
    fade: { start: 1, holdUntil: 0.6, steps: 3 },
    // Cream frames only: the split-puff tail frames read as charcoal hearts on dark space.
    anim: { frames: [0, 1, 2, 3], durationMs: 760, loop: false },
    lift: 18,
  },
  sparkle: {
    sheet: "sparkle",
    count: 14,
    speed: { min: 40, max: 120 },
    lifespanMs: { min: 520, max: 820 },
    gravityY: 90,
    // Untinted gold: multiplying ember or cream into the art turns it brown over navy.
    tints: [0xffffff],
    fade: { start: 1, holdUntil: 0.7, steps: 2 },
    // Twinkle between the bright frames; the dim last frame reads as a dirt cross.
    anim: { frames: [0, 1, 2, 1], durationMs: 360, loop: true },
    lift: 35,
  },
  incidentFlour: {
    sheet: "dust",
    count: 12,
    speed: { min: 40, max: 120 },
    lifespanMs: { min: 560, max: 880 },
    gravityY: -8,
    tints: [0xffffff, 0xfffaf0, 0xf9f0de],
    fade: { start: 1, holdUntil: 0.6, steps: 3 },
    anim: { frames: [0, 1, 2, 3], durationMs: 880, loop: false },
    lift: 10,
  },
  incidentConfetti: {
    sheet: "star",
    count: 16,
    speed: { min: 70, max: 150 },
    lifespanMs: { min: 700, max: 1000 },
    gravityY: 240,
    tints: [colorNumber(colors.ember), colorNumber(colors.sage), colorNumber(colors.terracotta), colorNumber(colors.amber), colorNumber(colors.plum)],
    fade: { start: 1, holdUntil: 0.75, steps: 2 },
    anim: { frames: [0, 1, 2, 1], durationMs: 260, loop: true },
    lift: 90,
  },
  star: {
    sheet: "star",
    count: 10,
    speed: { min: 30, max: 110 },
    lifespanMs: { min: 700, max: 1100 },
    gravityY: 0,
    tints: [colorNumber(colors.plaster), 0xffe6a8, 0xfff3dc],
    fade: { start: 1, holdUntil: 0.65, steps: 3 },
    anim: { frames: [0, 1, 2, 1], durationMs: 420, loop: true },
    lift: 0,
  },
};

export const STEAM_TUNING = {
  intervalMs: 300,
  lifespanMs: { min: 1300, max: 1800 },
  riseSpeed: { min: 16, max: 28 },
  sway: { min: -7, max: 7 },
  tints: [0xffffff, colorNumber(colors.parchmentWarm)],
  fade: { start: 0.9, holdUntil: 0.5, steps: 3 },
  // Rising wisp frames; the breakup frames are recoloured warm and fade out stepped.
  frames: [0, 1, 2, 3, 4],
  animMs: 1800,
} as const;

/**
 * World shake (`shakeCamera`): the camera scroll jitters by whole pixels, so anything with
 * scrollFactor 0 (HUD, gauges, cards, touch controls, screen-fixed skies) stays perfectly still.
 * Offsets are multiples of the 2 px art grid and decay to zero. Layers that scroll with the
 * world should overscan the viewport by `SHAKE_MAX_OFFSET_PX` so edges never show.
 */
export const SHAKE_TUNING = {
  soft: { durationMs: motion.fast + 60, amplitudePx: 2 },
  medium: { durationMs: motion.base + 60, amplitudePx: 4 },
  strong: { durationMs: motion.slow + 20, amplitudePx: 8 },
  /** A new offset is picked this often (ms): chunky, readable steps rather than per-frame noise. */
  stepMs: 34,
  /** Offsets snap to this grid (screen px). */
  gridPx: 2,
} as const;

export const SHAKE_MAX_OFFSET_PX: number = Math.max(SHAKE_TUNING.soft.amplitudePx, SHAKE_TUNING.medium.amplitudePx, SHAKE_TUNING.strong.amplitudePx);

/**
 * Warm screen flash: oat cream with a terracotta bias (never neutral grey), short and
 * stepped. Peak opacity stays well below 1 so the scene keeps reading through it.
 */
export const FLASH_TUNING = {
  defaultDurationMs: motion.base - 20,
  color: "#FFE2BE",
  peakAlpha: 0.62,
  /** Alpha drops in this many hard steps after the peak frame. */
  steps: 4,
} as const;

export const TRANSITION_TUNING = {
  warmFadeMs: motion.slow + 100,
  irisMs: motion.slow * 2,
  warpMs: motion.slow * 2 + 60,
  /** handoff = warm flash pop, then the pixel iris closes on the focus point. */
  handoffMs: motion.slow * 2 + 120,
  handoffFlashMs: motion.fast + 40,
  /** Warm ink rather than pure black so cuts feel like dusk, not a power-off. */
  color: colors.ink,
  /** Iris edge rings from the hole outwards (hard-edged, `blockPx` thick each). */
  rimColors: [colors.amber, colors.ember, colors.terracottaDeep] as readonly string[],
  /** Iris pixel block (screen px): the edge is quantised to this grid, radius moves in these steps. */
  blockPx: 4,
  /** Warp streak overlay: hard-edged warm dashes rushing out from the centre. */
  warp: { streaks: 26, thicknessPx: 4, minLengthPx: 24, maxLengthPx: 120, colors: [colors.plaster, colors.parchmentDeep, colors.amber] as readonly string[] },
  /** Safety net: a transition promise always settles after its duration plus this. */
  settleGraceMs: 400,
} as const;

/**
 * Pixel nozzle flame (`createPixelFlame`): the flame-tongue frames of the thrust sheet, shown
 * at the sheet's integer artScale and anchored at the nozzle, plus an optional hard-edged
 * stepped glow. Power picks the frame; nothing is scaled by a non-integer factor.
 */
export const PIXEL_FLAME_TUNING = {
  /** Thrust sheet frames used as the tongue, smallest to largest. */
  frames: [0, 1, 2] as readonly number[],
  /** Power at or above which each frame shows (index-aligned with `frames`). */
  powerThresholds: [0.05, 0.4, 0.75] as readonly number[],
  /** Above the top threshold the tongue flickers between the two largest frames this often. */
  flickerMs: 70,
  /** Ignition pop: the largest frame shows first for this long. */
  popMs: 90,
  /** Tongue anchor (fraction of frame height) that sits on the nozzle. */
  originY: 0.2,
  ignitePerSecond: 7,
  fadePerSecond: 5,
  glow: {
    /** Art-pixel radius of the outer ring; displayed at the thrust sheet's artScale. */
    radiusArt: 14,
    /** Hard-edged rings from outside in: radius fraction and alpha. */
    rings: [
      { radius: 1, alpha: 0.16 },
      { radius: 0.68, alpha: 0.26 },
      { radius: 0.38, alpha: 0.4 },
    ] as readonly { readonly radius: number; readonly alpha: number }[],
    color: colors.ember,
    /** Glow centre sits this far (art px) below the nozzle, inside the tongue. */
    offsetArt: 4,
  },
} as const;
