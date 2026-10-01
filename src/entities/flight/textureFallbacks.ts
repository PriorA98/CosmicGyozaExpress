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
