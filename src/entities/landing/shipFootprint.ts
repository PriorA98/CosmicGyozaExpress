import type Phaser from "phaser";

const cache = new Map<string, number>();
const OPAQUE_ALPHA = 24;

/**
 * Distance (texture px) from a texture's centre down to its lowest opaque row: where the ship's feet are.
 * Measured once per texture from the source image so the landing contact line follows the real art,
 * whatever canvas padding it ships with. Falls back to `fallbackRatio * height` if the pixels are unreadable.
 */
export function measureFootOffset(scene: Phaser.Scene, textureKey: string, fallbackRatio: number): number {
  const cached = cache.get(textureKey);
  if (cached !== undefined) return cached;

  const frame = scene.textures.getFrame(textureKey);
  const height = frame?.height ?? 0;
  const fallback = height * fallbackRatio;
  let result = fallback;

  try {
    const source = scene.textures.get(textureKey).getSourceImage();
    if (frame && typeof document !== "undefined" && "width" in source && source.width > 0) {
      const canvas = document.createElement("canvas");
      canvas.width = frame.width;
      canvas.height = frame.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (context) {
        context.drawImage(source as CanvasImageSource, frame.cutX, frame.cutY, frame.width, frame.height, 0, 0, frame.width, frame.height);
        const pixels = context.getImageData(0, 0, frame.width, frame.height).data;
        const lowest = lowestOpaqueRow(pixels, frame.width, frame.height);
        if (lowest >= 0) result = lowest + 1 - frame.height / 2;
      }
    }
  } catch {
    result = fallback;
  }

  cache.set(textureKey, result);
  return result;
}

function lowestOpaqueRow(pixels: Uint8ClampedArray, width: number, height: number): number {
  for (let y = height - 1; y >= 0; y -= 1) {
    const rowStart = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      if ((pixels[rowStart + x * 4 + 3] ?? 0) > OPAQUE_ALPHA) return y;
    }
  }
  return -1;
}
