import { ASSET, ASSET_MANIFEST, type AssetKey } from "../data/assetManifest";
import { colorNumber, colors, motion } from "../game/designTokens";

/**
 * Typed tuning for every visual feedback recipe in `src/fx/` (owner: audio-fx package).
 * Pure data: no Phaser imports, so tests can verify budgets and ranges.
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
  readonly alpha: { readonly start: number; readonly end: number };
  readonly animMs: number;
};

export const THRUST_TUNING: ThrustTuning = {
  defaultOffset: 40,
  ratePerSecond: 44,
  minRateFactor: 0.45,
  lifespanMs: { min: 380, max: 560 },
  speed: { min: 70, max: 110 },
  intensitySpeed: 60,
  spreadDegrees: 9,
  nozzleJitter: 3,
  drag: 0.9,
  // Mild warm wash: keeps authored colours, warms grey art, dims the tail toward dusk.
  color: [0xffffff, 0xfff0d8, 0xf3d2bc, 0xc9b8c8],
  alpha: { start: 1, end: 0 },
  animMs: 470,
};

export type BurstTuning = {
  readonly sheet: ParticleSheetId;
  readonly count: number;
  readonly speed: Range;
  readonly lifespanMs: Range;
  readonly gravityY: number;
  readonly tints: readonly number[];
  readonly alpha: { readonly start: number; readonly end: number };
  /** Frames play once across this duration; `loop` frames repeat (twinkles). */
  readonly anim: { readonly durationMs: number; readonly loop: boolean };
  /** Initial upward bias (px/s) so bursts bloom instead of spraying flat. */
  readonly lift: number;
};

export type BurstKind = "dust" | "sparkle" | "incidentFlour" | "incidentConfetti" | "star";

export const BURST_TUNING: Readonly<Record<BurstKind, BurstTuning>> = {
  dust: {
    sheet: "dust",
    count: 10,
    speed: { min: 20, max: 80 },
    lifespanMs: { min: 520, max: 820 },
    gravityY: -12,
    // Near-white washes keep the authored cream; heavier tints read as grey smoke.
    tints: [0xffffff, 0xfdf6e8, 0xf6ecd8],
    alpha: { start: 0.95, end: 0 },
    // Longer than the lifespan so puffs spend their life in the cream frames, not the grey tail.
    anim: { durationMs: 1050, loop: false },
    lift: 18,
  },
  sparkle: {
    sheet: "sparkle",
    count: 14,
    speed: { min: 40, max: 120 },
    lifespanMs: { min: 600, max: 950 },
    gravityY: 90,
    // The art is already gold; tints only warm or cool it slightly (multiplying ember turns it brown).
    tints: [0xffffff, 0xfff3dc, 0xffe4b8, 0xfff8f0],
    alpha: { start: 1, end: 0 },
    anim: { durationMs: 480, loop: true },
    lift: 35,
  },
  incidentFlour: {
    sheet: "dust",
    count: 12,
    speed: { min: 40, max: 120 },
    lifespanMs: { min: 600, max: 950 },
    gravityY: -8,
    tints: [0xffffff, 0xfffaf0, 0xf7eedc],
    alpha: { start: 1, end: 0 },
    anim: { durationMs: 1100, loop: false },
    lift: 10,
  },
  incidentConfetti: {
    sheet: "star",
    count: 16,
    speed: { min: 70, max: 150 },
    lifespanMs: { min: 700, max: 1000 },
    gravityY: 240,
    tints: [colorNumber(colors.ember), colorNumber(colors.sage), colorNumber(colors.terracotta), colorNumber(colors.amber), colorNumber(colors.plum)],
    alpha: { start: 1, end: 0.2 },
    anim: { durationMs: 260, loop: true },
    lift: 90,
  },
  star: {
    sheet: "star",
    count: 10,
    speed: { min: 30, max: 110 },
    lifespanMs: { min: 700, max: 1200 },
    gravityY: 0,
    tints: [colorNumber(colors.plaster), 0xffe6a8, colorNumber(colors.duskBlue)],
    alpha: { start: 1, end: 0 },
    anim: { durationMs: 420, loop: true },
    lift: 0,
  },
};

export const STEAM_TUNING = {
  intervalMs: 300,
  lifespanMs: { min: 1300, max: 1800 },
  riseSpeed: { min: 16, max: 28 },
  sway: { min: -7, max: 7 },
  tints: [0xffffff, colorNumber(colors.parchmentWarm)],
  alpha: { start: 0.85, end: 0 },
  // Outlasts the lifespan so wisps fade out on alpha before the grey breakup frames dominate.
  animMs: 2000,
} as const;

export const SHAKE_TUNING = {
  soft: { durationMs: motion.fast - 30, intensity: 0.002 },
  medium: { durationMs: motion.base - 40, intensity: 0.0045 },
  strong: { durationMs: motion.slow - 80, intensity: 0.008 },
} as const;

export const FLASH_TUNING = {
  defaultDurationMs: motion.base - 40,
} as const;

export const TRANSITION_TUNING = {
  warmFadeMs: motion.slow + 100,
  irisMs: motion.slow * 2,
  warpMs: motion.slow * 2 + 60,
  warpZoom: 1.08,
  /** Warm ink rather than pure black so cuts feel like dusk, not a power-off. */
  color: colors.ink,
  rimColor: colors.ember,
  rimWidth: 6,
  rimAlpha: 0.85,
  /** Safety net: a transition promise always settles after its duration plus this. */
  settleGraceMs: 400,
} as const;
