import type Phaser from "phaser";

/**
 * PreloadScene replaces missing art with a generated canvas texture of the same size.
 * Real art is always decoded from an image file, so a canvas source means "still a fallback".
 */
export function isFallbackTexture(scene: Phaser.Scene, key: string): boolean {
  if (!scene.textures.exists(key)) return true;
  const source = scene.textures.get(key).getSourceImage();
  return typeof HTMLCanvasElement !== "undefined" && source instanceof HTMLCanvasElement;
}

/** Small deterministic PRNG (mulberry32) so stand-in art is identical every run. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type StandInStarOptions = {
  readonly key: string;
  readonly width: number;
  readonly height: number;
  readonly count: number;
  readonly seed: number;
  readonly palette: readonly string[];
  readonly alphaMin: number;
  readonly alphaMax: number;
};

/**
 * Builds (once) a transparent, tileable star tile in art pixels: mostly single pixels with a
 * few tiny plus-shaped sparkles. Used only while the authored star layer is missing.
 */
export function ensureStandInStarTile(scene: Phaser.Scene, options: StandInStarOptions): string {
  if (scene.textures.exists(options.key)) return options.key;

  const texture = scene.textures.createCanvas(options.key, options.width, options.height);
  if (!texture) return options.key;

  const context = texture.getContext();
  const random = seededRandom(options.seed);
  context.clearRect(0, 0, options.width, options.height);

  for (let i = 0; i < options.count; i += 1) {
    const x = Math.floor(random() * options.width);
    const y = Math.floor(random() * options.height);
    const color = options.palette[Math.floor(random() * options.palette.length)] ?? "#FBF7EC";
    context.globalAlpha = options.alphaMin + random() * (options.alphaMax - options.alphaMin);
    context.fillStyle = color;
    context.fillRect(x, y, 1, 1);

    const sparkle = random() < 0.12;
    if (sparkle && x > 0 && y > 0 && x < options.width - 1 && y < options.height - 1) {
      context.globalAlpha *= 0.45;
      context.fillRect(x - 1, y, 1, 1);
      context.fillRect(x + 1, y, 1, 1);
      context.fillRect(x, y - 1, 1, 1);
      context.fillRect(x, y + 1, 1, 1);
    }
  }

  context.globalAlpha = 1;
  texture.refresh();
  return options.key;
}

/**
 * Builds (once) a smooth white radial glow (opaque centre fading to transparent edge). Tint it
 * and draw with additive blending for engine glows and halos; `size` is the texture diameter.
 */
export function ensureRadialGlowTexture(scene: Phaser.Scene, key: string, size: number): string {
  if (scene.textures.exists(key)) return key;

  const texture = scene.textures.createCanvas(key, size, size);
  if (!texture) return key;

  const context = texture.getContext();
  const half = size / 2;
  const gradient = context.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.55)");
  gradient.addColorStop(0.7, "rgba(255,255,255,0.14)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.clearRect(0, 0, size, size);
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  texture.refresh();
  return key;
}

export type StandInPlanetOptions = {
  readonly key: string;
  /** Canvas size in art pixels (matches the manifest entry so layout never shifts). */
  readonly size: number;
  /** Body radius as a fraction of the canvas. */
  readonly bodyFill: number;
  /** Five tones, darkest outline/shadow first, brightest highlight last. */
  readonly palette: readonly [string, string, string, string, string];
  readonly craters: number;
  /** Soft horizontal bands (gas-giant look) instead of a cratered surface. */
  readonly banded: boolean;
  readonly seed: number;
};

/** 4x4 Bayer matrix (0..15) for pixel-art dithering between shade bands. */
const BAYER_4: readonly number[] = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/**
 * Builds (once) a pixel-art planet stand-in: a dithered, top-left lit sphere with a dark outline,
 * optional craters or bands, and a cool rim light. Used only while the authored celestial art is
 * still a PreloadScene fallback, so destination and distant bodies never render as flat discs.
 */
export function ensureStandInPlanet(scene: Phaser.Scene, options: StandInPlanetOptions): string {
  if (scene.textures.exists(options.key)) return options.key;

  const texture = scene.textures.createCanvas(options.key, options.size, options.size);
  if (!texture) return options.key;

  const context = texture.getContext();
  const random = seededRandom(options.seed);
  const centre = options.size / 2;
  const radius = Math.floor(options.size * options.bodyFill * 0.5);
  const craters = Array.from({ length: options.craters }, () => {
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * radius * 0.72;
    return {
      x: centre + Math.cos(angle) * distance,
      y: centre + Math.sin(angle) * distance,
      r: radius * (0.07 + random() * 0.12),
    };
  });
  const bandPhase = random() * Math.PI * 2;
  const light = normalize3(-0.55, -0.62, 0.56);

  context.clearRect(0, 0, options.size, options.size);
  for (let py = 0; py < options.size; py += 1) {
    for (let px = 0; px < options.size; px += 1) {
      const dx = px + 0.5 - centre;
      const dy = py + 0.5 - centre;
      const distance = Math.hypot(dx, dy);
      if (distance > radius) continue;

      const nx = dx / radius;
      const ny = dy / radius;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      let shade = nx * light.x + ny * light.y + nz * light.z;

      if (options.banded) {
        shade += Math.sin(ny * 9 + bandPhase + Math.sin(nx * 3) * 0.6) * 0.12;
      }
      for (const crater of craters) {
        const cd = Math.hypot(px + 0.5 - crater.x, py + 0.5 - crater.y);
        if (cd < crater.r) {
          // Bowl: darker on the lit side, a lighter lip on the far side.
          const towardLight = ((px - crater.x) * light.x + (py - crater.y) * light.y) / crater.r;
          shade += towardLight < 0 ? -0.22 : 0.08;
        }
      }

      const threshold = (BAYER_4[(py % 4) * 4 + (px % 4)] ?? 0) / 16 - 0.5;
      const level = clampIndex(Math.floor((shade + 0.25) * 3.2 + threshold * 0.55) + 1, 1, 4);
      const isOutline = distance > radius - 1.2;
      const rim = !isOutline && distance > radius - 2.4 && nx > 0.25 && ny > 0.1;
      const tone = isOutline ? options.palette[0] : rim ? options.palette[3] : options.palette[level];
      context.fillStyle = tone ?? options.palette[2];
      context.fillRect(px, py, 1, 1);
    }
  }

  texture.refresh();
  return options.key;
}

function normalize3(x: number, y: number, z: number): { readonly x: number; readonly y: number; readonly z: number } {
  const length = Math.hypot(x, y, z) || 1;
  return { x: x / length, y: y / length, z: z / length };
}

function clampIndex(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** The authored texture when it loaded, otherwise its procedural planet stand-in. */
export function planetTextureOrStandIn(scene: Phaser.Scene, key: string, standIn: Omit<StandInPlanetOptions, "key">): string {
  if (!isFallbackTexture(scene, key)) return key;
  return ensureStandInPlanet(scene, { ...standIn, key: `${key}--stand-in` });
}
