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
  /** Cool blue-grey shading (blue above red by more than this) is warmed too: no cold soot on navy. */
  coolBias: 12,
  /**
   * Alpha is snapped to opaque at or above this (0..255) and dropped below it. Half-transparent
   * cream over navy space reads as grey smoke; opaque pixels fade out through the stepped fade.
   */
  alphaThreshold: 110,
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

/**
 * Pixel pop-out: fully opaque for the whole life, then gone. Any partial opacity of cream, gold
 * or confetti over navy space blends into grey or brown dirt, so particles end through their
 * authored frames (shrinking wisps, deflating puffs) instead of an alpha fade.
 */
export const POP_OUT: SteppedFade = { start: 1, holdUntil: 1, steps: 1 };

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
  /** Random sideways drift (px/s, perpendicular to the exhaust) so puffs wander apart into clumps. */
  readonly lateralSpeed: number;
  /**
   * Chance (0..1) that a scheduled puff is skipped. Small irregular gaps break the exhaust into
   * separate cozy puffs instead of one continuous rope. The ignition puff is never skipped.
   */
  readonly gapChance: number;
  readonly drag: number;
  readonly color: readonly number[];
  readonly fade: SteppedFade;
  /**
   * Puff variants (sheet frame lists), one picked at random per puff and played once across
   * `animMs`: size variance comes from the authored frames, never from a fractional scale.
   * Every variant ends on the cream puff: no rust streaks, split debris or soot wisps.
   */
  readonly variants: readonly (readonly number[])[];
  readonly animMs: number;
};

export const THRUST_TUNING: ThrustTuning = {
  defaultOffset: 40,
  ratePerSecond: 44,
  minRateFactor: 0.45,
  // About 40% shorter than round 2: a few ship-heights of puffs, not a rocket jet.
  lifespanMs: { min: 230, max: 330 },
  speed: { min: 60, max: 96 },
  intensitySpeed: 48,
  spreadDegrees: 10,
  nozzleJitter: 3,
  lateralSpeed: 26,
  gapChance: 0.16,
  drag: 0.9,
  // Warm wash only: keeps the authored gold core and lets the tail settle on cream, not dusk grey.
  color: [0xffffff, 0xfff6e2, 0xfdf0dc],
  // Opaque through the frames, then gone: no muddy translucent tail.
  fade: POP_OUT,
  // Frames: 0-2 gold-cored tongue (small to large), 3 ember ring puff, 4 rust dome, 5 oat puff
  // (warm-recoloured cream), 6-7 split wisps. Rust and split frames read as rope and debris.
  variants: [
    [1, 3, 3, 3, 5],
    [0, 3, 3, 5],
    [2, 3, 5, 5],
  ],
  animMs: 230,
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
    fade: POP_OUT,
    // Cream frames only (the split-puff tail frames read as charcoal hearts on dark space):
    // the puff blooms, then deflates back down before it pops out.
    anim: { frames: [0, 1, 2, 3, 2, 1], durationMs: 760, loop: false },
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
    fade: POP_OUT,
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
    fade: POP_OUT,
    anim: { frames: [0, 1, 2, 3, 2, 1], durationMs: 880, loop: false },
    lift: 10,
  },
  incidentConfetti: {
    sheet: "star",
    count: 16,
    speed: { min: 70, max: 150 },
    lifespanMs: { min: 700, max: 1000 },
    gravityY: 240,
    tints: [colorNumber(colors.ember), colorNumber(colors.sage), colorNumber(colors.terracotta), colorNumber(colors.amber), colorNumber(colors.plum)],
    fade: POP_OUT,
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
    fade: POP_OUT,
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
  fade: POP_OUT,
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
  defaultDurationMs: motion.fast + 20,
  /** Peach-cream (oat with a terracotta bias). */
  color: "#FFD99A",
  /**
   * Additive: the flash adds warm light to the frame. A normal-blend cream veil over navy space
   * mixes into a grey-brown wash at any partial opacity.
   */
  additive: true,
  peakAlpha: 0.85,
  /** Alpha drops in this many hard steps after the peak frame. */
  steps: 3,
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
  warp: {
    streaks: 28,
    thicknessPx: 4,
    minLengthPx: 32,
    maxLengthPx: 136,
    colors: [colors.plaster, colors.amber, colors.parchmentWarm, colors.ember] as readonly string[],
    /** The ink veil under the streaks closes/lifts in this many hard opacity steps. */
    veilSteps: 5,
  },
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
    /** Art-pixel radius of the outer ring at the largest flicker frame; displayed at artScale. */
    radiusArt: 9,
    /**
     * Glow sheet frames (radius multipliers): frame 0 is the small pilot light, frames 1-2 the
     * full glow the flame flickers between. Hard rings at art resolution, no gradient.
     */
    frameScales: [0.6, 1, 0.86] as readonly number[],
    /** Hard-edged rings from outside in: radius fraction and alpha (painted in plaster, tinted). */
    rings: [
      { radius: 1, alpha: 0.3 },
      { radius: 0.68, alpha: 0.55 },
      { radius: 0.4, alpha: 0.85 },
    ] as readonly { readonly radius: number; readonly alpha: number }[],
    /**
     * Ember: high red, low blue, so the added light stays warm over navy. A wide, faint glow
     * reads as a smoky grey halo; this one is small and bright, a hot core around the tongue.
     */
    color: colors.ember,
    /** Glow centre sits this far (art px) below the nozzle, inside the tongue. */
    offsetArt: 3,
    /** Full glow alternates frames 1 and 2 this often (irregular hash, not a smooth pulse). */
    flickerMs: 90,
    /** The only two brightness levels (object alpha): no continuous fades or scale ramps. */
    levels: { idle: 0.5, full: 1 },
  },
} as const;

/**
 * Directional bursts (`BurstOptions.fan`): angle windows in degrees (0 = right, 90 = down).
 * Sideways fans hug the ground so touchdown dust rolls out from the feet instead of blooming
 * over the hull; `liftFactor` scales the burst's upward lift down to a gentle drift.
 */
export const BURST_FANS = {
  left: { min: 168, max: 196 },
  right: { min: -16, max: 12 },
  liftFactor: 0.25,
} as const;

/** Comedic incident poof: flour blooms on a ring around the contact point, confetti rides above. */
export const INCIDENT_TUNING = {
  /** Flour spawn ring (px) unless the caller passes `spawnRadius`. */
  flourSpawnRadius: 8,
  /** Share of an explicit `count` that goes to flour (the rest is confetti). */
  flourShare: 0.45,
  flourSpreadFactor: 0.8,
  defaultSpread: 110,
} as const;
